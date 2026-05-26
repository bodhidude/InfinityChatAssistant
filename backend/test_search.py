import os
import json
import urllib.request
import urllib.error

def load_env():
    paths = [".env", "backend/.env", "../.env"]
    for path in paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")

def search_web(query: str, max_results: int = 5) -> list[dict]:
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("Tavily API key is missing.")
    
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
    
    import ssl
    ssl_context = ssl._create_unverified_context()
    
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

def main():
    load_env()
    print("Testing Tavily search...")
    print(f"API Key: {os.environ.get('TAVILY_API_KEY')[:15]}...")
    try:
        results = search_web("What are five of the top news stories for today?")
        print(f"\nSuccess! Found {len(results)} results:")
        for i, r in enumerate(results):
            print(f"\n[{i+1}] {r['title']}")
            print(f"URL: {r['url']}")
            print(f"Snippet: {r['snippet'][:150]}...")
    except Exception as e:
        print("Error during search:", str(e))

if __name__ == "__main__":
    main()
