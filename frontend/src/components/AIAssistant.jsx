import { useState, useRef, useEffect } from 'react';
import api from '../api/client';
import { Bot, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const QUICK_QUESTIONS = [
  'Why are deliveries delayed?',
  'What should I manufacture next?',
  'Which orders are at risk?',
  'What\'s the stock status?',
  'Top revenue product this week?',
];

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: '👋 Hi! I\'m your AI Business Assistant. Ask me anything about your ERP data — stock levels, order status, what to produce next, and more!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message: msg });
      setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ ' + (err.response?.data?.message || 'AI service unavailable. Please set your GEMINI_API_KEY in backend .env') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <>
      <button className="ai-toggle-btn" onClick={() => setOpen(o => !o)} title="AI Business Assistant" id="ai-toggle-btn">
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-header">
            <div className="ai-header-icon">🤖</div>
            <div className="ai-header-text">
              <h4>AI Business Assistant</h4>
              <span>Powered by Gemini • Real-time data</span>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          <div className="ai-messages" ref={messagesRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-msg-bubble">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg bot">
                <div className="ai-msg-bubble">
                  <div className="ai-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="ai-quick-btns">
            {QUICK_QUESTIONS.map(q => (
              <button key={q} className="ai-quick-btn" onClick={() => sendMessage(q)}>{q}</button>
            ))}
          </div>

          <div className="ai-input-row">
            <input
              className="ai-input"
              placeholder="Ask about your business..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              id="ai-chat-input"
            />
            <button className="ai-send" onClick={() => sendMessage()} disabled={!input.trim() || loading} id="ai-send-btn">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
