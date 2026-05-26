import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "chat_history.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        excerpt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Create messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT,
        sources TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
    """)
    
    # Check if 'sources' column exists in messages table, if not add it (migration for existing DBs)
    cursor.execute("PRAGMA table_info(messages)")
    columns = [row[1] for row in cursor.fetchall()]
    if "sources" not in columns:
        cursor.execute("ALTER TABLE messages ADD COLUMN sources TEXT")
    
    # Trigger to update updated_at in sessions
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS update_session_timestamp
    AFTER UPDATE ON sessions
    BEGIN
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = new.id;
    END;
    """)
    
    conn.commit()
    conn.close()

def save_session(session_id: int | None, title: str, messages: list[dict]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    
    # Compute excerpt from the last message
    excerpt = ""
    if messages:
        last_msg = messages[-1]
        sender_label = "You: " if last_msg.get("sender") == "User" else "Infinity: "
        excerpt = f"{sender_label}{last_msg.get('text', '')}"
        if len(excerpt) > 60:
            excerpt = excerpt[:57] + "..."
            
    if session_id is not None:
        # Check if session exists
        cursor.execute("SELECT id FROM sessions WHERE id = ?", (session_id,))
        exists = cursor.fetchone()
        if exists:
            # Update existing session
            cursor.execute(
                "UPDATE sessions SET title = ?, excerpt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (title, excerpt, session_id)
            )
            # Delete old messages to overwrite
            cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        else:
            # Create new session with explicit ID (unlikely to hit this branch)
            cursor.execute(
                "INSERT INTO sessions (id, title, excerpt) VALUES (?, ?, ?)",
                (session_id, title, excerpt)
            )
    else:
        # Insert a new session
        cursor.execute(
            "INSERT INTO sessions (title, excerpt) VALUES (?, ?)",
            (title, excerpt)
        )
        session_id = cursor.lastrowid
        
    # Insert new messages
    import json
    for msg in messages:
        sources_val = None
        if "sources" in msg and msg["sources"]:
            sources_val = json.dumps(msg["sources"])
        cursor.execute(
            "INSERT INTO messages (session_id, sender, text, timestamp, sources) VALUES (?, ?, ?, ?, ?)",
            (session_id, msg.get("sender"), msg.get("text"), msg.get("timestamp"), sources_val)
        )
        
    conn.commit()
    conn.close()
    return session_id

def get_all_sessions() -> list[dict]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, excerpt, updated_at FROM sessions ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_session(session_id: int) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get session details
    cursor.execute("SELECT id, title, excerpt, updated_at FROM sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    if not session_row:
        conn.close()
        return None
        
    # Get messages
    cursor.execute("SELECT sender, text, timestamp, sources FROM messages WHERE session_id = ? ORDER BY id ASC", (session_id,))
    message_rows = cursor.fetchall()
    
    conn.close()
    
    session = dict(session_row)
    messages_list = []
    import json
    for row in message_rows:
        msg_dict = dict(row)
        if "sources" in msg_dict and msg_dict["sources"]:
            try:
                msg_dict["sources"] = json.loads(msg_dict["sources"])
            except Exception:
                msg_dict["sources"] = []
        else:
            msg_dict["sources"] = []
        messages_list.append(msg_dict)
        
    session["messages"] = messages_list
    return session

def delete_session(session_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    # Delete related messages first to preserve referential integrity
    cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

# Initialize DB on load
init_db()
