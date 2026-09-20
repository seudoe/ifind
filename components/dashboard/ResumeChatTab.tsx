"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Plus, Trash2, Archive, Edit2, Check, X, Sparkles } from "lucide-react";

interface ChatSession {
  _id: string;
  title: string;
  resumeId: string;
  messageCount: number;
  lastMessageAt: string;
  isArchived: boolean;
}

interface Message {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{
    text: string;
    relevanceScore: number;
    section?: string;
  }>;
  createdAt: string;
}

export function ResumeChatTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession._id);
    }
  }, [currentSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
        // Auto-select first session
        if (data.data.length > 0 && !currentSession) {
          setCurrentSession(data.data[0]);
        }
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: 'current',
          title: 'New Chat',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSessions([data.data, ...sessions]);
        setCurrentSession(data.data);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !currentSession || sending) return;

    const userMessageContent = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      _id: 'temp-user',
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages([...messages, tempUserMsg]);

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSession._id,
          content: userMessageContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Replace temp message with real messages
        setMessages(prev => 
          prev.filter(m => m._id !== 'temp-user').concat([
            data.data.userMessage,
            data.data.aiMessage,
          ])
        );

        // Update session in sidebar
        setSessions(prev => 
          prev.map(s => 
            s._id === currentSession._id 
              ? { ...s, messageCount: s.messageCount + 2, lastMessageAt: new Date().toISOString() }
              : s
          )
        );
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(m => m._id !== 'temp-user'));
        alert(data.error || 'Failed to send message');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setMessages(prev => prev.filter(m => m._id !== 'temp-user'));
      alert('Failed to send message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this chat session? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSessions(sessions.filter(s => s._id !== sessionId));
        if (currentSession?._id === sessionId) {
          setCurrentSession(sessions[0] || null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (res.ok) {
        setSessions(sessions.map(s => 
          s._id === sessionId ? { ...s, title: newTitle } : s
        ));
        if (currentSession?._id === sessionId) {
          setCurrentSession({ ...currentSession, title: newTitle });
        }
      }
    } catch (err) {
      console.error('Error updating session:', err);
    }
  };

  const startEditing = (session: ChatSession) => {
    setEditingSessionId(session._id);
    setEditingTitle(session.title);
  };

  const finishEditing = async () => {
    if (editingSessionId && editingTitle.trim()) {
      await updateSessionTitle(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-lg border overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 border-r flex flex-col bg-gray-50">
          <div className="p-4 border-b">
            <button
              onClick={createNewSession}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session._id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                  currentSession?._id === session._id
                    ? 'bg-blue-100 border border-blue-300'
                    : 'hover:bg-gray-100'
                }`}
              >
                {editingSessionId === session._id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border rounded"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') finishEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                    />
                    <button
                      onClick={finishEditing}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => setCurrentSession(session)}
                      className="flex-1"
                    >
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {session.messageCount} messages
                      </p>
                    </div>
                    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(session);
                        }}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session._id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No chats yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{currentSession.title}</h3>
                <p className="text-sm text-gray-500">AI-powered resume assistant</p>
              </div>
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {showSidebar ? 'Hide' : 'Show'} Sidebar
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Sparkles className="h-8 w-8 text-gray-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
                  <p className="text-gray-600 mb-4">Ask me anything about your resume!</p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                    {[
                      'What are my key skills?',
                      'Summarize my work experience',
                      'What projects have I worked on?',
                      'How can I improve my resume?',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setInputMessage(suggestion)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-3xl rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-xs font-medium text-gray-600 mb-2">Sources:</p>
                          <div className="space-y-2">
                            {message.sources.map((source, idx) => (
                              <div key={idx} className="text-xs bg-white bg-opacity-50 rounded p-2">
                                <p className="text-gray-700 line-clamp-2">{source.text}</p>
                                <p className="text-gray-500 mt-1">
                                  Relevance: {Math.round(source.relevanceScore * 100)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {sending && (
                <div className="flex justify-start">
                  <div className="max-w-3xl rounded-lg px-4 py-3 bg-gray-100">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gray-600 animate-spin" />
                      <span className="text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e);
                    }
                  }}
                  placeholder="Ask about your resume... (Shift+Enter for new line)"
                  className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={1}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || sending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="h-5 w-5" />
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No chat selected</h3>
              <p className="text-gray-600 mb-4">Create a new chat to get started</p>
              <button
                onClick={createNewSession}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create New Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
