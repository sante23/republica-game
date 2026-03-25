import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import api from '../config/api';
import { MessageCircle, Send, X, Minimize2, Maximize2 } from 'lucide-react';
import './ChatPanel.css';

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  channel: string;
  createdAt: string;
  sender: { username: string; level: number };
}

const ChatPanel: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useGame();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [channel, setChannel] = useState<'global' | 'private'>('global');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      setUnreadCount(0);
    }
  }, [isOpen, channel]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
    };
    socket.on('chat-message', handleMessage);
    return () => { socket.off('chat-message', handleMessage); };
  }, [socket, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await api.get(`/chat/global`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !socket || !user) return;
    socket.emit('chat-message', {
      senderId: user.id,
      senderUsername: user.username,
      senderLevel: user.level,
      content: input.trim(),
      channel,
      worldId: user.worldId
    });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) return null;

  return (
    <>
      {!isOpen && (
        <button className="chat-toggle-btn" onClick={() => setIsOpen(true)}>
          <MessageCircle size={20} />
          {unreadCount > 0 && <span className="chat-unread">{unreadCount}</span>}
        </button>
      )}

      {isOpen && (
        <div className={`chat-panel ${isMinimized ? 'chat-minimized' : ''}`}>
          <div className="chat-header">
            <div className="chat-tabs">
              <button
                className={`chat-tab ${channel === 'global' ? 'active' : ''}`}
                onClick={() => setChannel('global')}
              >
                Global
              </button>
            </div>
            <div className="chat-controls">
              <button onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={() => setIsOpen(false)}>
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`chat-msg ${msg.senderId === user.id ? 'own' : ''}`}>
                    <span className="chat-msg-sender">
                      {msg.sender?.username || 'Unknown'} <small>Lv.{msg.sender?.level}</small>
                    </span>
                    <span className="chat-msg-text">{msg.content}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  maxLength={500}
                />
                <button onClick={sendMessage} disabled={!input.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatPanel;
