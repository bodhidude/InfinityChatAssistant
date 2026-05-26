import React from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import './ChatHistory.css';

const ChatHistory = ({ sessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession }) => {
  
  const formatDate = (dateString) => {
    try {
      // Parse SQLite UTC timestamp or datetime
      const date = new Date(dateString + 'Z'); // Add Z to treat as UTC
      if (isNaN(date.getTime())) {
        return 'Recently';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <h2 className="history-title">Chat History</h2>
        <button className="new-chat-btn" onClick={onNewChat}>
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="history-list">
        {sessions.length === 0 ? (
          <div className="history-empty">
            <MessageSquare size={24} className="empty-icon" />
            <p>No chat history yet.</p>
            <p className="subtext">Your conversations with Infinity will appear here after ending the session.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div 
              key={session.id} 
              className={`history-item ${activeSessionId === session.id ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="history-item-icon">
                <MessageSquare size={16} />
              </div>
              <div className="history-item-content">
                <div className="history-item-header">
                  <span className="history-item-title">{session.title}</span>
                  <button 
                    className="delete-session-btn"
                    onClick={(e) => onDeleteSession(session.id, e)}
                    title="Delete Conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {session.excerpt && (
                  <p className="history-item-excerpt">{session.excerpt}</p>
                )}
                <span className="history-item-time">{formatDate(session.updated_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
