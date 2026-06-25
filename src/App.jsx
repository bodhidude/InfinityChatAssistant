import React, { useState, useEffect } from 'react';
import ChatHistory from './components/ChatHistory';
import ChatInterface from './components/ChatInterface';
import LlmControl from './components/LlmControl';
import './index.css';

function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotification, setSaveNotification] = useState("");
  const [webSearchActive, setWebSearchActive] = useState(false);

  // LLM Control Center States
  const [saveKeys, setSaveKeys] = useState(() => {
    const val = localStorage.getItem('inf_save_keys');
    return val !== 'false';
  });
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('inf_ai_provider') || 'ollama');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('inf_ai_model') || 'gemma4:e4b');
  const [openaiKey, setOpenaiKey] = useState(() => {
    const saved = localStorage.getItem('inf_openai_key');
    const savedToggle = localStorage.getItem('inf_save_keys') !== 'false';
    return savedToggle && saved ? saved : "";
  });
  const [geminiKey, setGeminiKey] = useState(() => {
    const saved = localStorage.getItem('inf_gemini_key');
    const savedToggle = localStorage.getItem('inf_save_keys') !== 'false';
    return savedToggle && saved ? saved : "";
  });
  const [anthropicKey, setAnthropicKey] = useState(() => {
    const saved = localStorage.getItem('inf_anthropic_key');
    const savedToggle = localStorage.getItem('inf_save_keys') !== 'false';
    return savedToggle && saved ? saved : "";
  });

  // Passcode Auth States
  const [appPassword, setAppPassword] = useState(() => localStorage.getItem('inf_app_password') || '');
  const [authRequired, setAuthRequired] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Sync API keys and LLM settings to local storage
  useEffect(() => {
    localStorage.setItem('inf_save_keys', saveKeys);
    localStorage.setItem('inf_ai_provider', aiProvider);
    localStorage.setItem('inf_ai_model', aiModel);
    
    if (saveKeys) {
      if (openaiKey) localStorage.setItem('inf_openai_key', openaiKey);
      else localStorage.removeItem('inf_openai_key');
      if (geminiKey) localStorage.setItem('inf_gemini_key', geminiKey);
      else localStorage.removeItem('inf_gemini_key');
      if (anthropicKey) localStorage.setItem('inf_anthropic_key', anthropicKey);
      else localStorage.removeItem('inf_anthropic_key');
    } else {
      localStorage.removeItem('inf_openai_key');
      localStorage.removeItem('inf_gemini_key');
      localStorage.removeItem('inf_anthropic_key');
    }
  }, [saveKeys, aiProvider, aiModel, openaiKey, geminiKey, anthropicKey]);

  // Check auth requirement on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setAuthRequired(data.auth_required);
          if (data.auth_required && !appPassword) {
            setShowAuthModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to check auth configuration:", err);
      }
    };
    checkAuth();
  }, [appPassword]);

  // Fetch sessions on auth load or key update
  useEffect(() => {
    if (!authRequired || appPassword) {
      fetchSessions();
    }
  }, [authRequired, appPassword]);

  const authenticatedFetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    if (appPassword) {
      headers['X-App-Password'] = appPassword;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setShowAuthModal(true);
      setSessions([]);
      throw new Error("Unauthorized: Invalid App Passcode.");
    }
    return res;
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const headers = { 'X-App-Password': tempPassword };
      const res = await fetch('/api/sessions', { headers });
      if (res.ok) {
        setAppPassword(tempPassword);
        localStorage.setItem('inf_app_password', tempPassword);
        setShowAuthModal(false);
        setAuthError('');
      } else {
        setAuthError('Invalid passcode. Please try again.');
      }
    } catch (err) {
      setAuthError('Connection failed. Verify the backend is active.');
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await authenticatedFetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  const handleSelectSession = async (id) => {
    try {
      const response = await authenticatedFetch(`/api/sessions/${id}`);
      if (response.ok) {
        const session = await response.json();
        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title);
        setMessages(session.messages);
      }
    } catch (error) {
      console.error("Failed to fetch session details:", error);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setActiveSessionTitle("");
    setMessages([]);
    setWebSearchActive(false);
  };

  const handleSendMessage = async (text, webSearchActive = false) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage = { sender: 'User', text, timestamp };
    
    // Add user message to UI immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsThinking(true);

    try {
      const headers = { 
        'Content-Type': 'application/json' 
      };
      if (openaiKey) headers['X-OpenAI-Key'] = openaiKey;
      if (geminiKey) headers['X-Gemini-Key'] = geminiKey;
      if (anthropicKey) headers['X-Anthropic-Key'] = anthropicKey;

      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          messages: updatedMessages,
          web_search: webSearchActive,
          provider: aiProvider,
          model: aiModel
        })
      });

      if (response.ok) {
        const data = await response.json();
        const botMessage = {
          sender: 'Infinity',
          text: data.reply,
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        let errorDetail = "Invalid response from server";
        try {
          const errJson = await response.json();
          if (errJson && errJson.detail) {
            errorDetail = errJson.detail;
          }
        } catch (e) {}
        throw new Error(errorDetail);
      }
    } catch (error) {
      console.error("Chat completion failed:", error);
      const errorMessage = {
        sender: 'Infinity',
        text: error.message.includes("Web search failed")
          ? `${error.message}. Please check your internet connection or verify your Tavily API Key.`
          : `I'm having trouble connecting to my cognitive backend. Please ensure the ${aiProvider === 'ollama' ? 'local Ollama service is active and the ' + aiModel + ' model is fully pulled' : 'API Key is correct and you have an active internet connection'}. Details: ${error.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleEndSession = async (title) => {
    if (messages.length === 0) return;
    
    setIsSaving(true);
    const isUpdate = activeSessionId !== null;

    try {
      const response = await authenticatedFetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeSessionId,
          title,
          messages
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveSessionId(data.id);
        setActiveSessionTitle(data.title);
        
        // Refresh sidebar
        await fetchSessions();

        // Show save feedback
        if (isUpdate) {
          setSaveNotification("Conversation updated in history.");
        } else {
          setSaveNotification("New conversation saved to history.");
        }
        
        // Hide notification after 3 seconds
        setTimeout(() => {
          setSaveNotification("");
        }, 3000);
      }
    } catch (error) {
      console.error("Failed to save session:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation(); // Prevent the history-item click event from firing (loading the chat)
    
    try {
      const response = await authenticatedFetch(`/api/sessions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // If we deleted the currently active chat session, clear the chat screen
        if (activeSessionId === id) {
          handleNewChat();
        }
        await fetchSessions();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Infinity AI Assistant</h1>
        <p>At your service, how can I help?</p>
      </header>
      
      <main className="main-layout">
        <aside className="col-faq">
          <ChatHistory 
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onDeleteSession={handleDeleteSession}
          />
          <LlmControl
            aiProvider={aiProvider}
            setAiProvider={setAiProvider}
            aiModel={aiModel}
            setAiModel={setAiModel}
            openaiKey={openaiKey}
            setOpenaiKey={setOpenaiKey}
            geminiKey={geminiKey}
            setGeminiKey={setGeminiKey}
            anthropicKey={anthropicKey}
            setAnthropicKey={setAnthropicKey}
            saveKeys={saveKeys}
            setSaveKeys={setSaveKeys}
          />
        </aside>
        
        <section className="col-chat">
          <ChatInterface 
            messages={messages}
            activeSessionId={activeSessionId}
            activeSessionTitle={activeSessionTitle}
            onSendMessage={handleSendMessage}
            onEndSession={handleEndSession}
            onNewChat={handleNewChat}
            isThinking={isThinking}
            isSaving={isSaving}
            saveNotification={saveNotification}
            webSearchActive={webSearchActive}
            setWebSearchActive={setWebSearchActive}
          />
        </section>
      </main>

      {showAuthModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--accent-primary)' }}>Passcode Required</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              Access is protected. Please enter your passcode to view chat history and interact with the AI assistant.
            </p>
            <form onSubmit={handleAuthSubmit}>
              <input
                type="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="modal-input"
                placeholder="Enter App Passcode..."
                style={{ width: '100%', marginBottom: '1rem' }}
                autoFocus
                required
              />
              {authError && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                  {authError}
                </p>
              )}
              <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="modal-confirm-btn" style={{ padding: '0.6rem 1.5rem' }}>
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
