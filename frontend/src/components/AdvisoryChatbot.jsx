import { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Chatbot that answers questions using the full advisory report context
 * (same context as the executive summary agent).
 */
export function AdvisoryChatbot({ advisoryResults, className = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || loading || !advisoryResults) return;

      const userMsg = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setError(null);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const { data } = await axios.post(`${API_BASE}/chat`, {
          advisory_results: advisoryResults,
          message: trimmed,
          history,
        });

        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        const detail = err.response?.data?.detail || err.message || 'Failed to get response.';
        setError(detail);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${detail}` }]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, advisoryResults, messages, scrollToBottom]
  );

  const suggestionPrompts = [
    'What are my top 3 next steps?',
    'Summarize my risk level and key concerns.',
    'What allocation changes do you recommend?',
    'Explain my validation score.',
  ];

  const handleSuggestion = useCallback(
    (text) => {
      setInput(text);
    },
    []
  );

  if (!advisoryResults) return null;

  return (
    <section className={`advisory-chatbot ${className}`} aria-label="Advisory Q&A Chat">
      <button
        type="button"
        className="chatbot-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="chatbot-header-icon" aria-hidden="true">
          <MessageCircle size={20} />
        </span>
        <h3 className="chatbot-title">Ask about your report</h3>
        <span className="chatbot-toggle" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {expanded && (
        <div className="chatbot-body">
          <div className="chatbot-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="chatbot-empty">
                <p>Ask questions about your portfolio, risk, allocation, strategy, or next steps.</p>
                <div className="chatbot-suggestions">
                  {suggestionPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chatbot-suggestion"
                      onClick={() => handleSuggestion(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message chat-message-${msg.role}`}>
                <div className="chat-message-content">
                  {msg.role === 'assistant' && looksLikeMarkdown(msg.content) ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message chat-message-assistant chat-loading">
                <Loader2 size={18} className="spin" />
                <span>Thinking…</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="chatbot-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your advisory report…"
              className="chatbot-input"
              disabled={loading}
              aria-label="Chat message"
            />
            <button type="submit" className="chatbot-send" disabled={loading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>

          {error && (
            <p className="chatbot-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

AdvisoryChatbot.propTypes = {
  advisoryResults: PropTypes.object,
  className: PropTypes.string,
};

function looksLikeMarkdown(text) {
  if (typeof text !== 'string') return false;
  return /(^#{1,6}\s)|(^[-*]\s)|(^\d+\.\s)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/m.test(text);
}
