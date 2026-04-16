import { useState, useEffect, useRef } from 'react';
import { Brain, Send, Loader2, Trash2, Search } from 'lucide-react';
import api from '../api/client';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    api.get('/chat/history')
      .then(res => setMessages(res.data.messages || []))
      .catch(() => { })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');

    setMessages(prev => [...prev, { role: 'user', content: userMsg, id: Date.now() }]);
    setLoading(true);

    try {
      const res = await api.post('/chat/', { message: userMsg });
      setMessages(prev => {
        const withoutOptimistic = prev.slice(0, -1);
        return [...withoutOptimistic, res.data.user_message, res.data.ai_message];
      });
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check if the backend is running and try again.',
        id: Date.now() + 1
      }]);
    }
    setLoading(false);
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear all chat history?')) return;
    try {
      await api.delete('/chat/history');
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full animate-slide-up">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">AI Chat</h1>
          <p className="text-gray-400 text-sm">Ask anything — searches across your documents, notes, and general knowledge</p>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClearHistory} className="secondary-btn flex items-center gap-2 text-xs">
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 glass-panel p-4 mb-4 overflow-y-auto space-y-4 min-h-0">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="w-14 h-14 mb-4 text-gray-600" />
            <p className="text-lg font-medium text-gray-400">Start a conversation</p>
            <p className="text-sm mt-1 text-gray-500">Try: "Explain normalization" or "What did I study?"</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={m.id || i} className={`flex gap-3 animate-fade-in ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center shrink-0 border border-primary-500/30 mt-1">
                  <Brain className="w-4 h-4 text-primary-400" />
                </div>
              )}
              <div className={`max-w-[80%] ${m.role === 'user'
                  ? 'bg-primary-600/30 border border-primary-500/30 rounded-2xl rounded-br-md px-4 py-3'
                  : 'bg-gray-800/60 border border-gray-700/50 rounded-2xl rounded-bl-md px-4 py-3'
                }`}>
                {m.role === 'assistant' ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  <p className="text-gray-200 text-sm">{m.content}</p>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-1 text-xs font-bold text-gray-300">
                  U
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center shrink-0 border border-primary-500/30">
              <Brain className="w-4 h-4 text-primary-400" />
            </div>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          id="chat-input"
          type="text"
          className="input-field flex-1"
          placeholder="Message your Second Brain..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={loading}
        />
        <button id="chat-send" onClick={handleSend} disabled={loading || !input.trim()} className="primary-btn px-4">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
