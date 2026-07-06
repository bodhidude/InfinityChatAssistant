import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, LogOut, CheckCircle, Plus, Globe, Paperclip, FileText, AlertTriangle } from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import './ChatInterface.css';

const ChatInterface = ({ 
  messages, 
  activeSessionId,
  activeSessionTitle,
  onSendMessage, 
  onEndSession, 
  onNewChat,
  isThinking,
  isSaving,
  saveNotification,
  webSearchActive,
  setWebSearchActive,
  aiProvider,
  onUploadFile
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionTitleInput, setSessionTitleInput] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    
    // Client side size validation (20MB)
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError("File size exceeds the 20MB limit.");
      e.target.value = '';
      return;
    }

    // Client side file extension validation
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.txt' && ext !== '.md') {
      setUploadError("Unsupported file type. Only PDF, TXT, and MD files are allowed.");
      e.target.value = '';
      return;
    }

    setIsUploadingFile(true);
    try {
      const data = await onUploadFile(file);
      setAttachedFile(data);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Failed to upload and parse file.");
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!inputValue.trim() && !attachedFile) || isThinking || isUploadingFile) return;

    const textToSend = inputValue.trim() || `Analyze the attached file: ${attachedFile.filename}`;
    onSendMessage(textToSend, webSearchActive, attachedFile);
    setInputValue('');
    setAttachedFile(null);
  };

  const handleEndSessionClick = () => {
    if (activeSessionId) {
      // Existing session: silently update directly without prompting
      onEndSession(activeSessionTitle);
    } else {
      // New session: open modal to ask for title
      setSessionTitleInput(`Chat with Infinity - ${new Date().toLocaleDateString()}`);
      setIsModalOpen(true);
    }
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!sessionTitleInput.trim()) return;
    
    onEndSession(sessionTitleInput.trim());
    setIsModalOpen(false);
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="bot-avatar header-avatar">
            <Bot size={24} />
          </div>
          <div>
            <h3>Infinity Assistant</h3>
            <span className="status-indicator">Online</span>
          </div>
        </div>

        {messages.length > 0 && (
          <div className="chat-header-actions">
            <button 
              className="new-chat-header-btn" 
              onClick={onNewChat}
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
            <button 
              className="end-session-btn" 
              onClick={handleEndSessionClick}
              disabled={isSaving}
            >
              <LogOut size={16} />
              <span>{activeSessionId ? 'Save & Sync' : 'End Session'}</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Silent Save Notification */}
      {saveNotification && (
        <div className="save-notification">
          <CheckCircle size={16} />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Message Area */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <Bot size={48} className="empty-bot-icon" />
            <h2>Infinity AI Assistant</h2>
            <p>At your service. Ask me anything or toggle Web Search for real-time information.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.sender === 'User' ? 'user' : 'bot'}`}>
              {msg.sender === 'Infinity' && (
                <div className="bot-avatar message-avatar">
                  <Bot size={16} />
                </div>
              )}
              <div className="message-container">
                <div className={`message-bubble ${msg.sender === 'User' ? 'user-bubble' : 'bot-bubble'}`}>
                  <span className="message-sender">{msg.sender}</span>
                  {msg.sender === 'User' ? (
                    <p className="message-text">{msg.text}</p>
                  ) : (
                    <div className="message-text-formatted">
                      {renderMarkdown(msg.text)}
                    </div>
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-attachments">
                      {msg.attachments.map((att, aIdx) => (
                        <div key={aIdx} className="bubble-attachment-chip">
                          <FileText size={12} className="attachment-icon" />
                          <span>{att.filename}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="message-time">{msg.timestamp}</span>
                </div>
                {msg.sender === 'Infinity' && msg.sources && msg.sources.length > 0 && (
                  <div className="message-sources-wrapper">
                    <details className="sources-details">
                      <summary className="sources-summary">
                        <Globe size={14} className="sources-icon" />
                        <span>Sources Used ({msg.sources.length})</span>
                      </summary>
                      <div className="sources-grid animate-fade-in">
                        {msg.sources.map((src, sIdx) => {
                          let domain = "";
                          try {
                            domain = new URL(src.url).hostname;
                          } catch (e) {
                            domain = src.url || "source";
                          }
                          return (
                            <a 
                              key={sIdx} 
                              href={src.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="source-card"
                            >
                              <div className="source-card-header">
                                <span className="source-index">{sIdx + 1}</span>
                                <span className="source-domain">{domain}</span>
                              </div>
                              <h4 className="source-title">{src.title}</h4>
                              <p className="source-snippet">{src.snippet}</p>
                            </a>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="message-wrapper bot">
            <div className="bot-avatar message-avatar">
              <Bot size={16} />
            </div>
            <div className="message-bubble bot-bubble thinking-bubble">
              <span className="message-sender">Infinity</span>
              {webSearchActive ? (
                <div className="search-progress-container">
                  <div className="search-progress-header">
                    <Globe size={14} className="spinning-icon" />
                    <span>Searching Tavily index & synthesizing response...</span>
                  </div>
                  <div className="typing-indicator search-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              ) : (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="chat-input-area">
        {/* Warning banner for Ollama if file is attached */}
        {attachedFile && aiProvider === 'ollama' && (
          <div className="ollama-context-warning animate-fade-in">
            <AlertTriangle size={14} className="warning-icon" />
            <span>Local Ollama models have limited context windows. Large files may cause performance degradation or truncation.</span>
          </div>
        )}
        
        {/* Attached File Chip */}
        {attachedFile && (
          <div className="attached-file-chip animate-fade-in">
            <div className="attached-file-info">
              <FileText size={16} className="file-icon" />
              <span className="file-name">{attachedFile.filename} ({Math.round(attachedFile.size / 1024)} KB)</span>
            </div>
            <button 
              type="button" 
              className="remove-file-btn" 
              onClick={() => setAttachedFile(null)}
              title="Remove file"
            >
              ×
            </button>
          </div>
        )}

        {/* Upload error display */}
        {uploadError && (
          <div className="upload-error-message animate-fade-in">
            <AlertTriangle size={14} className="error-icon" />
            <span className="error-text">{uploadError}</span>
            <button type="button" className="clear-error-btn" onClick={() => setUploadError(null)}>×</button>
          </div>
        )}

        {/* Uploading loading display */}
        {isUploadingFile && (
          <div className="file-uploading-indicator animate-fade-in">
            <div className="upload-spinner"></div>
            <span>Uploading and extracting text...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="chat-form">
          <button
            type="button"
            className={`web-search-toggle ${webSearchActive ? 'active' : ''}`}
            onClick={() => setWebSearchActive(!webSearchActive)}
            title="Toggle Web Search"
            disabled={isThinking || isUploadingFile}
          >
            <Globe size={18} />
            <span>Web Search</span>
          </button>
          
          <button
            type="button"
            className={`file-upload-btn ${attachedFile ? 'active' : ''}`}
            onClick={handleUploadButtonClick}
            title="Attach a PDF or TXT file"
            disabled={isThinking || isUploadingFile}
          >
            <Paperclip size={18} />
            <span>Attach File</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.txt,.md"
            style={{ display: 'none' }}
          />

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isThinking 
                ? "Infinity is thinking..." 
                : isUploadingFile
                  ? "Processing file..."
                  : webSearchActive 
                    ? "Ask Infinity to search the web..." 
                    : "Type your message or attach a file..."
            }
            className="chat-input"
            disabled={isThinking || isUploadingFile}
          />
          <button 
            type="submit" 
            className="chat-submit-btn" 
            disabled={(!inputValue.trim() && !attachedFile) || isThinking || isUploadingFile}
          >
            <span>Ask Infinity</span>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* End Session Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom">
            <h3>Name Your Conversation</h3>
            <p>Before saving this session to history, please enter a title:</p>
            <form onSubmit={handleModalSubmit}>
              <input
                type="text"
                value={sessionTitleInput}
                onChange={(e) => setSessionTitleInput(e.target.value)}
                className="modal-input"
                autoFocus
                required
              />
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="modal-cancel-btn" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn">
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
