import { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, Send, Loader2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { API_BASE } from '../constants/config';
import { looksLikeMarkdown } from '../utils/markdown';

const WORKFLOWS = [
  'Explain risk',
  'Build 90-day plan',
  'Prepare client summary',
];

function getWorkflowPrompt(workflow) {
  if (workflow === 'Explain risk') return 'Explain my risk profile with top concerns and immediate safeguards.';
  if (workflow === 'Build 90-day plan') return 'Build a practical 90-day action plan from this report.';
  if (workflow === 'Prepare client summary') return 'Draft a concise client-facing summary with next steps.';
  return workflow;
}

export function AdvisoryChatbot({ runId, className = '', onConvertAction }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const submitMessage = useCallback(
    async (messageText) => {
      const trimmed = (messageText ?? input).trim();
      if (!trimmed || loading || !runId) return;

      const userMsg = { role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setError(null);

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const { data } = await axios.post(`${API_BASE}/chat`, {
          run_id: runId,
          message: trimmed,
          history,
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            confidence: data.confidence,
            sources: data.sources || [],
            suggested_actions: data.suggested_actions || [],
          },
        ]);
        setTimeout(scrollToBottom, 50);
      } catch (err) {
        const detail = err.response?.data?.detail || err.message || 'Failed to get response.';
        setError(detail);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${detail}` }]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, runId, scrollToBottom]
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      submitMessage(input);
    },
    [input, submitMessage]
  );

  if (!runId) return null;

  return (
    <section className={`advisory-chatbot panel ${className}`} aria-label="Advisory Q&A Chat">
      <button
        type="button"
        className="chatbot-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="chatbot-header-icon" aria-hidden="true">
          <MessageCircle size={20} />
        </span>
        <h3 className="chatbot-title">Contextual Copilot</h3>
        <span className="chatbot-toggle" aria-hidden="true">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {expanded && (
        <div className="chatbot-body">
          <div className="chatbot-workflows">
            {WORKFLOWS.map((workflow) => (
              <button
                key={workflow}
                type="button"
                className="chatbot-suggestion"
                onClick={() => submitMessage(getWorkflowPrompt(workflow))}
              >
                {workflow}
              </button>
            ))}
          </div>

          <div className="chatbot-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="chatbot-empty">
                <p>Ask about risk, allocations, execution plans, or client-ready narratives.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`chat-message chat-message-${msg.role}`}>
                <div className="chat-message-content">
                  {msg.role === 'assistant' && looksLikeMarkdown(msg.content) ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                {msg.role === 'assistant' && (
                  <div className="chat-meta">
                    {msg.confidence && <span className="status-pill">Confidence: {msg.confidence}</span>}
                    {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                      <div className="chat-sources">
                        {msg.sources.map((source) => (
                          <span key={`${source}-${idx}`} className="format-badge">{source}</span>
                        ))}
                      </div>
                    )}
                    {Array.isArray(msg.suggested_actions) && msg.suggested_actions.length > 0 && (
                      <div className="chat-action-convert">
                        {msg.suggested_actions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            className="secondary-button"
                            onClick={() => onConvertAction(action)}
                          >
                            <Plus size={14} /> Add Action
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-message chat-message-assistant chat-loading">
                <Loader2 size={18} className="spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={scrollRef} aria-hidden="true" />
          </div>

          <form onSubmit={handleSubmit} className="chatbot-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your copilot..."
              className="chatbot-input"
              disabled={loading}
              aria-label="Chat message"
            />
            <button
              type="submit"
              className="chatbot-send"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
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
  runId: PropTypes.string,
  className: PropTypes.string,
  onConvertAction: PropTypes.func,
};

AdvisoryChatbot.defaultProps = {
  runId: null,
  className: '',
  onConvertAction: () => {},
};
