import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Loader, Bot } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'team';
  name: string;
  text: string;
  timestamp: Date;
  avatar?: string;
  type: 'message' | 'clinical-alert' | 'task';
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
}

const MessagingHub: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChat, setActiveChat] = useState<'team' | 'ai'>('team');
  const [teamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Dr. Sarah Chen', role: 'MCO Case Manager', avatar: 'SC', status: 'online' },
    { id: '2', name: 'Mark Davis', role: 'Care Navigator', avatar: 'MD', status: 'online' },
    { id: '3', name: 'Lisa Anderson', role: 'Clinical Coordinator', avatar: 'LA', status: 'away' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    // Load conversation history from backend
    const loadHistory = async () => {
      try {
        const response = await fetch('/api/messaging/history');
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          const loadedMessages = data.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('Error loading message history:', error);
        // Fall back to initial sample messages
        const initialMessages: Message[] = [
          {
            id: '1',
            sender: 'team',
            name: 'Dr. Sarah Chen',
            text: 'Maria Santos risk score increased significantly. We should escalate to high-risk protocol.',
            timestamp: new Date(Date.now() - 15 * 60000),
            type: 'message'
          },
          {
            id: '2',
            sender: 'team',
            name: 'Mark Davis',
            text: 'Agree. I\'ll coordinate with the care team and schedule a follow-up call.',
            timestamp: new Date(Date.now() - 10 * 60000),
            type: 'message'
          }
        ];
        setMessages(initialMessages);
      }
    };
    
    loadHistory();
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom('auto');
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 60;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const messageText = inputValue;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      name: 'You',
      text: messageText,
      timestamp: new Date(),
      type: 'message'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Send message to backend
    try {
      await fetch('/api/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'user',
          name: 'You',
          text: messageText,
          type: 'message'
        })
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }

    if (activeChat === 'ai') {
      setLoading(true);
      try {
        const context = messages
          .slice(-6)
          .map((m) => `${m.name}: ${m.text}`)
          .join('\n');
        const aiRes = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText, context }),
        });

        if (!aiRes.ok) {
          throw new Error(`AI endpoint error: ${aiRes.status}`);
        }

        const aiData = await aiRes.json();
        const response = aiData.reply || 'I could not generate a response right now. Please try again.';
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          name: 'Clinical AI Assistant',
          text: response,
          timestamp: new Date(),
          type: 'message'
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Send AI response to backend
        await fetch('/api/messaging/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: 'ai',
            name: 'Clinical AI Assistant',
            text: response,
            type: 'message'
          })
        });
      } catch (error) {
        let errorText = 'I encountered an error processing your request. Please try again.';
        if (error instanceof Error && error.message.includes('AI endpoint error: 429')) {
          errorText = 'Gemini quota is currently exceeded for this API key. Please wait and retry, or use a key/project with available quota.';
        }

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          name: 'Clinical AI Assistant',
          text: errorText,
          timestamp: new Date(),
          type: 'message'
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar - Team Members */}
      {activeChat === 'team' && (
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900">Care Team</h2>
            <p className="text-xs text-slate-500">3 online</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {teamMembers.map(member => (
              <div
                key={member.id}
                className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white text-xs font-bold relative">
                    {member.avatar}
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {activeChat === 'ai' ? (
              <>
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Clinical AI Assistant</h3>
                  <p className="text-xs text-green-600">● Always available</p>
                </div>
              </>
            ) : (
              <>
                <MessageSquare className="w-6 h-6 text-teal-600" />
                <div>
                  <h3 className="font-bold text-slate-900">Care Team Messaging</h3>
                  <p className="text-xs text-slate-500">Collaborate with your care team</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:block text-xs font-bold text-slate-500 uppercase tracking-wider">Mode</span>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setActiveChat('team')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeChat === 'team'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Care Team Messaging"
              >
                Team
              </button>
              <button
                type="button"
                onClick={() => setActiveChat('ai')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeChat === 'ai'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Clinical AI Assistant"
              >
                AI Assistant
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-md ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.sender !== 'user' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                      msg.sender === 'ai'
                        ? 'bg-gradient-to-br from-teal-500 to-emerald-500'
                        : 'bg-gradient-to-br from-teal-400 to-teal-600'
                    }`}>
                      {msg.sender === 'ai' ? <Bot className="w-4 h-4" /> : msg.name.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    {msg.sender !== 'user' && (
                      <p className="text-xs text-slate-500 mb-1 font-medium">{msg.name}</p>
                    )}
                    <div className={`px-4 py-2 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-lg flex gap-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ delay: '0.1s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ delay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={activeChat === 'ai' ? 'Ask the AI assistant about a patient...' : 'Type a message...'}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !inputValue.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          {activeChat === 'ai' && (
            <p className="text-xs text-slate-500 mt-2">
              💡 Ask about patient risks, clinical recommendations, or care strategies
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingHub;
