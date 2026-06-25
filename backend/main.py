import ast
# Monkey patch AST nodes for Python 3.14 compatibility before importing docstring_parser (via aisuite)
if not hasattr(ast, "NameConstant"):
    ast.NameConstant = ast.Constant
if not hasattr(ast, "Num"):
    ast.Num = ast.Constant
if not hasattr(ast, "Str"):
    ast.Str = ast.Constant
if not hasattr(ast, "Bytes"):
    ast.Bytes = ast.Constant

import os
import json
import urllib.request
import urllib.error
import asyncio
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import aisuite as ai
import database

def get_aisuite_client(
    provider: str,
    x_gemini_key: str | None = None,
    x_openai_key: str | None = None,
    x_anthropic_key: str | None = None
) -> ai.Client:
    config = {
        "ollama": {
            "timeout": 300
        }
    }
    
    if provider == "gemini":
        key = x_gemini_key or os.getenv("GEMINI_API_KEY")
        if key:
            config["gemini"] = {"api_key": key}
    elif provider == "openai":
        env_key = os.getenv("OPENAI_API_KEY")
        key = x_openai_key
        if not key and env_key and env_key != "ollama":
            key = env_key
        if key:
            config["openai"] = {"api_key": key}
    elif provider == "anthropic":
        key = x_anthropic_key or os.getenv("ANTHROPIC_API_KEY")
        if key:
            config["anthropic"] = {"api_key": key}
            
    return ai.Client(config)

# Custom .env loader to load TAVILY_API_KEY from backend/.env or root .env
def load_env():
    paths = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        ".env",
        "backend/.env"
    ]
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip('"').strip("'")
            except Exception as e:
                print(f"Warning: Failed to load environment file {path}: {str(e)}")

# Load environment variables on startup
load_env()

# Set dummy key for providers that require it, though aisuite's ollama backend doesn't strictly need one
os.environ["OPENAI_API_KEY"] = "ollama"

app = FastAPI(title="Infinity Support Backend")

# Configure CORS
origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    origins = [o.strip() for o in origins_env.split(",") if o.strip()]
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Passcode Verification Dependency
def verify_password(x_app_password: str | None = Header(None)):
    app_password = os.getenv("APP_PASSWORD")
    if app_password:
        if not x_app_password or x_app_password != app_password:
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing App Passcode.")

@app.get("/api/config")
def get_config():
    """
    Returns application configuration, such as whether authentication is required.
    """
    app_password = os.getenv("APP_PASSWORD")
    return {
        "auth_required": bool(app_password)
    }

@app.get("/api/ollama/models")
def get_ollama_models():
    """
    Checks connection to local Ollama instance and returns the list of pulled models.
    """
    url = "http://127.0.0.1:11434/api/tags"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=2.0) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                models = [m.get("name") for m in data.get("models", [])]
                return {"status": "ONLINE", "models": models}
    except Exception as e:
        print("Ollama connection check failed:", str(e))
    return {"status": "OFFLINE", "models": []}

# Initialize aisuite client with a generous timeout (300 seconds) for Ollama model loading
client = ai.Client({
    "ollama": {
        "timeout": 300
    }
})
MODEL_NAME = "ollama:gemma4:e4b"

class MessageSchema(BaseModel):
    sender: str
    text: str
    timestamp: str
    sources: list[dict] | None = None

class SessionSaveSchema(BaseModel):
    id: int | None = None
    title: str
    messages: list[MessageSchema]

class ChatRequestSchema(BaseModel):
    messages: list[MessageSchema]
    web_search: bool = False
    provider: str | None = None
    model: str | None = None

def search_web(query: str, max_results: int = 5) -> list[dict]:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("Tavily API key is missing. Please configure TAVILY_API_KEY in the backend/.env file.")
    
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    # Safely bypass local macOS certificate verify check for this specific outgoing query
    import ssl
    ssl_context = ssl._create_unverified_context()
    
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_context) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            results = res_data.get("results", [])
            formatted = []
            for r in results:
                formatted.append({
                    "title": r.get("title", "No Title"),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", "")
                })
            return formatted
    except urllib.error.HTTPError as e:
        error_content = e.read().decode("utf-8") if e.fp else str(e)
        raise RuntimeError(f"Tavily search API error (Status {e.code}): {error_content}")
    except Exception as e:
        raise RuntimeError(f"Tavily search connection failed: {str(e)}")

@app.get("/api/sessions", dependencies=[Depends(verify_password)])
def get_sessions():
    try:
        return database.get_all_sessions()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sessions/{session_id}", dependencies=[Depends(verify_password)])
def get_session(session_id: int):
    try:
        session = database.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/sessions/{session_id}", dependencies=[Depends(verify_password)])
def delete_session(session_id: int):
    try:
        session = database.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        database.delete_session(session_id)
        return {"status": "success", "message": f"Session {session_id} successfully deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sessions", dependencies=[Depends(verify_password)])
def save_session(session_data: SessionSaveSchema):
    try:
        messages_dict = [msg.model_dump() for msg in session_data.messages]
        session_id = database.save_session(session_data.id, session_data.title, messages_dict)
        return {"id": session_id, "title": session_data.title, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat", dependencies=[Depends(verify_password)])
async def chat(
    chat_data: ChatRequestSchema,
    x_gemini_key: str | None = Header(None),
    x_openai_key: str | None = Header(None),
    x_anthropic_key: str | None = Header(None)
):
    try:
        # Reload environment variables to ensure any newly written key is picked up
        load_env()
        
        provider = chat_data.provider or "ollama"
        model_name = chat_data.model or "gemma4:e4b"
        full_model_str = f"{provider}:{model_name}"
        
        print(f"\n--- Chat Request Received (provider={provider}, model={model_name}, web_search={chat_data.web_search}, messages={len(chat_data.messages)}) ---")
        
        search_context = ""
        sources = []
        
        # Check for user query and auto-detect time-sensitive queries
        user_query = ""
        if chat_data.messages:
            for msg in reversed(chat_data.messages):
                if msg.sender == "User":
                    user_query = msg.text
                    break
        
        force_search = False
        if user_query:
            query_lower = user_query.lower()
            # Keywords indicating real-time or time-sensitive informational needs
            time_keywords = [
                "today", "current", "latest", "now", "2026", "news", 
                "weather", "breaking", "strait", "hormuz", "recent", 
                "happen", "yesterday", "this week", "this month"
            ]
            if any(kw in query_lower for kw in time_keywords):
                force_search = True
                print(f"Time-sensitive query auto-detected! Forcing Tavily web search: '{user_query}'")
                
        should_search = chat_data.web_search or force_search
        
        if should_search and user_query:
            print(f"Executing Tavily web search for: '{user_query}'")
            try:
                sources = search_web(user_query)
                if sources:
                    # Format sources for LLM context
                    formatted_list = []
                    for idx, s in enumerate(sources, 1):
                        formatted_list.append(
                            f"Source [{idx}]:\nTitle: {s['title']}\nURL: {s['url']}\nSnippet: {s['snippet']}"
                        )
                    search_context = "\n\n".join(formatted_list)
                    print(f"Tavily search returned {len(sources)} sources.")
                else:
                    print("Tavily search returned no sources.")
            except Exception as search_err:
                print("Tavily search failed:", str(search_err))
                # Raise bad gateway exception so client knows web search specifically failed
                raise HTTPException(
                    status_code=502,
                    detail=f"Web search failed: {str(search_err)}"
                )

        # Build dynamic system instructions with RAG context
        if search_context:
            system_content = (
                "You are Infinity, a highly intelligent, helpful, and friendly AI assistant. "
                "You are connected to the live internet via the Tavily search engine, which has successfully "
                "retrieved real-time data for the user's latest query. "
                "You MUST answer the user's question directly and strictly using the provided search results below. "
                "Do NOT state that you lack real-time access, do NOT say you are an AI without real-time connection, "
                "and do NOT tell the user to go to other websites. You must act as the direct provider of this information. "
                "Synthesize your answer based ONLY on the facts and snippets provided in the search results. "
                "For each fact you reference, cite its source number (e.g. [1], [2], [3], etc.) "
                "directly inside your reply. "
                "If the search results do not contain the specific answer to the user's query, state clearly "
                "that you cannot find this information in active web search results—do not invent facts or URLs.\n\n"
                f"--- WEB SEARCH RESULTS ---\n{search_context}\n--------------------------"
            )
        elif should_search:
            system_content = (
                "You are Infinity, a highly intelligent, helpful, and friendly AI assistant. "
                "The web search returned no results. Inform the user politely that the web search did not return "
                "any matching pages for their query, and try to answer using your pre-existing knowledge but make sure "
                "to explicitly note that the live web search returned no results."
            )
        else:
            system_content = (
                "You are Infinity, a highly intelligent, helpful, and friendly AI assistant. "
                "Your goal is to provide accurate, clear, and comprehensive general information on any topic. "
                "Be encouraging, professional, and engaging. Keep your answers well-structured and easy to read."
            )

        # Convert frontend messages to aisuite format
        aisuite_messages = [
            {
                "role": "system",
                "content": system_content
            }
        ]
        
        for msg in chat_data.messages:
            role = "user" if msg.sender == "User" else "assistant"
            # Filter out any previous connection error notifications
            if msg.sender == "Infinity" and msg.text.startswith("Web search failed:"):
                continue
            aisuite_messages.append({
                "role": role,
                "content": msg.text
            })
            
        # Send chat completion request using aisuite
        local_client = get_aisuite_client(provider, x_gemini_key, x_openai_key, x_anthropic_key)
        response = await asyncio.to_thread(
            local_client.chat.completions.create,
            model=full_model_str,
            messages=aisuite_messages,
            temperature=0.7
        )
        
        reply_content = response.choices[0].message.content
        return {
            "reply": reply_content,
            "sources": sources
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print("Error during chat completion:", str(e))
        err_msg = str(e)
        if provider == "ollama":
            detail = (
                f"Failed to communicate with local Ollama: {err_msg}. "
                f"Make sure Ollama is running and you have pulled the model '{model_name}' "
                f"via 'ollama pull {model_name}'."
            )
        else:
            detail = f"Failed to communicate with LLM ({provider}:{model_name}): {err_msg}. Please verify your API key or network connection."
        raise HTTPException(status_code=500, detail=detail)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
