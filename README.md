# Infinity AI Assistant 🌌

Infinity is a lightweight, sleek, and feature-rich AI Chat Assistant designed for power users who want a simple, unified interface to chat with either local models or commercial LLMs. 

Built on a modern stack utilizing **React + Vite** for the frontend and **FastAPI** with Andrew Ng's **`aisuite`** for the backend, Infinity gives you full control over your models and credentials.

---

## 🚀 Key Features

* **Sidebar-Integrated Interface**: Sleek, distraction-free layout with the app header, chat history, and settings neatly organized in a left sidebar to maximize visible chat canvas.
* **Collapsible LLM Control Center**: Collapses into a single toggle button at the bottom of the sidebar to keep your workspace clean. Expand it anytime to switch between **Local (Ollama)**, **Gemini**, **OpenAI**, and **Anthropic**.
  * *Local Ollama*: Dynamically pulls your locally installed models in a grouped dropdown list (defaulting to `qwen2.5:14b`), includes built-in presets (Qwen 2.5, DeepSeek R1, Llama 3.3, Gemma 4, Mistral), a manual **Refresh** button, custom tag input, and real-time offline/online health indicators.
  * *Commercial Providers*: Integrated dropdown model choosers for the latest models (GPT-5 series, Gemini 3.x / 2.5 series, Claude 4/5 series) with in-app API key management and persistent saving options.
* **PDF & TXT File Ingestion**: Attach PDF, TXT, or MD documents (up to 20MB and 500 pages) to chat messages. Extracted text context is automatically structured and injected into the LLM prompt.
  * *Ollama Warning*: Displays context window warnings when Ollama is active to remind users of local resource constraints.
  * *Scanned PDF Detection*: Automatically checks for and blocks scanned/empty PDFs to guide users to upload searchable files.
* **Tavily RAG Web Search**: Real-time internet access with a manual toggle or auto-detection keywords (e.g. asking for "latest news", "today", "current weather"). Formats source citations and search snippets directly below response bubbles.
* **Passcode Protection**: Keep your conversations secure when hosting online. The app features a passcode gate modal that locks the application interface and credentials until a matching server-configured passcode is supplied.
* **Polished UX & Safe Markdown**: Responsive design, fluid transitions, and a secure custom markdown parser rendering code blocks, lists, and inline styles safely (100% XSS protected).
* **Local SQLite Chat History**: End and title your chat sessions to save them to a local SQLite database, allowing you to reload or delete conversations instantly.

---

## 🛠️ Installation & Setup

### Prerequisites
1. **Node.js** (v18+)
2. **Python** (3.10+)
3. **Ollama** (optional, for local LLM execution)

### 1. Clone the Repository
```bash
git clone https://github.com/bodhidude/InfinityChatAssistant.git
cd InfinityChatAssistant
```

### 2. Set Up the Backend
Initialize a Python virtual environment and install the required modules:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory to configure your keys:
```env
# Optional Tavily API Key for Web Search capabilities
TAVILY_API_KEY=your-tavily-api-key

# Optional Passcode to lock the application online
APP_PASSWORD=your-secure-passcode

# Optional Restricted CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Set Up the Frontend
Navigate back to the root directory and install dependencies:
```bash
cd ..
npm install
```

---

## 🏃 Running the Application

To start both the FastAPI backend server (port `8080`) and the Vite React frontend client (port `5173`) concurrently:
```bash
npm run start
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛡️ Security Notes

- **API Keys**: Keys entered in the sidebar are transmitted securely in HTTP headers (`X-OpenAI-Key`, etc.). If the "Save key" checkbox is checked, they are persisted locally in the browser's `localStorage` in plaintext. Serves best under HTTPS.
- **Passcode Protection**: When `APP_PASSWORD` is defined in the backend `.env`, all secure endpoints are guarded with a 401 gate. It is highly recommended to set this passcode if you deploy your instance on a public cloud server.
