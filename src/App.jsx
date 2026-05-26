import React, { useState, useEffect } from 'react';
import ChatHistory from './components/ChatHistory';
import ChatInterface from './components/ChatInterface';
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

  // Load saved sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
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
      const response = await fetch(`/api/sessions/${id}`);
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: updatedMessages,
          web_search: webSearchActive
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
          : "I'm having trouble connecting to my cognitive backend. Please ensure the local Ollama service is active and the gemma4:e4b model is fully pulled.",
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
      const response = await fetch('/api/sessions', {
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
      const response = await fetch(`/api/sessions/${id}`, {
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
    </div>
  );
}

export default App;
