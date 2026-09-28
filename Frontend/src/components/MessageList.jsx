import React, { useEffect, useRef, useState } from 'react';
import AppLogo from './AppLogo';
import GeminiWelcome from './GeminiWelcome';
import {
  User,
  Globe,
  ExternalLink,
  BookOpen,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Share2,
  RefreshCw,
  Sparkles
} from 'lucide-react';

function getWebsiteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (e) {
    return 'Web Source';
  }
}

const getDomain = getWebsiteName;

export default function MessageList({
  messages = [],
  isLoading = false,
  user = null,
  onSendMessage,
  onOpenDocs,
  onSwitchToResearch,
  documents = []
}) {
  const messagesEndRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [likedMap, setLikedMap] = useState({});
  const [dislikedMap, setDislikedMap] = useState({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy text', err);
    }
  };

  const toggleLike = (id) => {
    setLikedMap((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
    if (dislikedMap[id]) {
      setDislikedMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleDislike = (id) => {
    setDislikedMap((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
    if (likedMap[id]) {
      setLikedMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Check if conversation has any real user messages
  const userMessages = messages.filter((m) => m.role === 'user');
  const showWelcome = userMessages.length === 0;

  return (
    <div className="gemini-chat-stream-container" id="messages-container">
      {/* If fresh conversation, render the Gemini Welcome Hero and prompt cards */}
      {showWelcome ? (
        <GeminiWelcome
          user={user}
          onSelectPrompt={(text) => onSendMessage && onSendMessage(text)}
          onOpenDocs={onOpenDocs}
          onSwitchToResearch={onSwitchToResearch}
          documents={documents}
        />
      ) : (
        <div className="gemini-messages-list">
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';
            // Web sources (items with a URL)
            const webSources = (msg.sources || []).filter((s) => Boolean(s.url));
            const uniqueWebSources = [];
            const seenUrls = new Set();
            for (const s of webSources) {
              const normUrl = s.url.trim().toLowerCase();
              if (!seenUrls.has(normUrl)) {
                seenUrls.add(normUrl);
                uniqueWebSources.push(s);
              }
            }

            // PDF Document sources (items without a URL, representing uploaded PDFs or KB documents)
            const docSources = (msg.sources || []).filter((s) => !s.url && Boolean(s.title));
            const uniqueDocSources = [];
            const seenDocKeys = new Set();
            for (const s of docSources) {
              const key = `${s.title}_${s.pageNumber || 1}`.toLowerCase();
              if (!seenDocKeys.has(key)) {
                seenDocKeys.add(key);
                uniqueDocSources.push(s);
              }
            }

            const hasWebSources = uniqueWebSources.length > 0;
            const hasDocSources = uniqueDocSources.length > 0;
            const hasBothSources = hasWebSources && hasDocSources;

            const isCopied = copiedId === msg.id;
            const isLiked = likedMap[msg.id];
            const isDisliked = dislikedMap[msg.id];

            return (
              <div
                key={msg.id}
                className={`gemini-message-row ${msg.role}`}
                id={`message-${msg.id}`}
              >
                {/* Avatar */}
                <div className="gemini-msg-avatar">
                  {isAssistant ? (
                    <AppLogo size={28} />
                  ) : (
                    <div className="gemini-user-msg-avatar">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="User" />
                      ) : (
                        <User size={16} />
                      )}
                    </div>
                  )}
                </div>

                {/* Message Content & Grounding */}
                <div className="gemini-msg-body">
                  <div className="gemini-msg-content-wrapper">
                    {/* Assistant Model Label (Subtle) */}
                    {isAssistant && (
                      <div className="gemini-msg-model-tag">
                        <span className="model-name">Afzal's AI</span>
                        {msg.source === 'tavily-web-research' ? (
                          <span className="source-pill research">
                            <Globe size={11} /> Grounded with Web
                          </span>
                        ) : msg.source?.includes('user-document') ? (
                          <span className="source-pill docs">
                            <FileText size={11} /> From your PDF
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Text Payload */}
                    <div className={`gemini-msg-text ${msg.role}`}>
                      {msg.text}
                    </div>

                    {/* Grounded Sources & Citations Section */}
                    {isAssistant && (hasWebSources || hasDocSources) && (
                      <div className={`gemini-grounding-section ${hasBothSources ? 'has-both' : ''}`}>
                        {/* 1. Web Sources */}
                        {hasWebSources && (
                          <div className="grounding-group web-grounding-group">
                            <div className="grounding-header">
                              <Globe size={13} className="grounding-header-icon web-icon" />
                              <span className="grounding-header-title">Web Sources</span>
                              <span className="grounding-count-badge">{uniqueWebSources.length}</span>
                            </div>
                            <div className="web-sources-grid">
                              {uniqueWebSources.map((src, i) => (
                                <a
                                  key={src.url || i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="compact-web-source-card"
                                  title={`${src.title || 'Source'} (${getWebsiteName(src.url)})`}
                                >
                                  <div className="web-card-top-row">
                                    <span className="citation-badge">[{i + 1}]</span>
                                    <span className="website-name" title={getWebsiteName(src.url)}>
                                      {getWebsiteName(src.url)}
                                    </span>
                                    <ExternalLink size={11} className="web-ext-icon" />
                                  </div>
                                  <div className="web-card-title" title={src.title}>
                                    {src.title || 'Untitled Article'}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Visual separator when both Web Sources and Document Sources are present */}
                        {hasBothSources && <div className="grounding-divider" role="separator" />}

                        {/* 2. Document / PDF Sources */}
                        {hasDocSources && (
                          <div className="grounding-group doc-grounding-group">
                            <div className="grounding-header">
                              <FileText size={13} className="grounding-header-icon doc-icon" />
                              <span className="grounding-header-title">Document Sources</span>
                              <span className="grounding-count-badge">{uniqueDocSources.length}</span>
                            </div>
                            <div className="doc-sources-list">
                              {uniqueDocSources.map((src, i) => (
                                <div
                                  key={src.id || `${src.title}_${src.pageNumber || i}`}
                                  className="compact-doc-source-item"
                                  title={`${src.title} (Page ${src.pageNumber || 1})`}
                                  onClick={onOpenDocs}
                                >
                                  <span className="pdf-doc-emoji" aria-hidden="true">📄</span>
                                  <span className="pdf-doc-text">
                                    <span className="pdf-doc-title">{src.title}</span>
                                    <span className="pdf-doc-dot"> · </span>
                                    <span className="pdf-doc-page">Page {src.pageNumber || 1}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Action Toolbar for Assistant */}
                    {isAssistant && (
                      <div className="gemini-action-toolbar">
                        <button
                          type="button"
                          className="gemini-action-btn"
                          onClick={() => handleCopyText(msg.text, msg.id)}
                          title="Copy text"
                          aria-label="Copy"
                        >
                          {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>

                        <button
                          type="button"
                          className={`gemini-action-btn ${isLiked ? 'active' : ''}`}
                          onClick={() => toggleLike(msg.id)}
                          title="Good response"
                          aria-label="Like response"
                        >
                          <ThumbsUp size={14} />
                        </button>

                        <button
                          type="button"
                          className={`gemini-action-btn ${isDisliked ? 'active' : ''}`}
                          onClick={() => toggleDislike(msg.id)}
                          title="Bad response"
                          aria-label="Dislike response"
                        >
                          <ThumbsDown size={14} />
                        </button>

                        <button
                          type="button"
                          className="gemini-action-btn"
                          onClick={() => handleCopyText(msg.text, msg.id)}
                          title="Share response"
                          aria-label="Share"
                        >
                          <Share2 size={14} />
                        </button>

                        <span className="gemini-msg-timestamp">{msg.time}</span>
                      </div>
                    )}

                    {!isAssistant && (
                      <div className="gemini-user-meta">
                        <span className="gemini-msg-timestamp">{msg.time}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing / Generating Indicator */}
          {isLoading && (
            <div className="gemini-message-row assistant typing-row" id="message-typing">
              <div className="gemini-msg-avatar">
                <AppLogo size={28} />
              </div>
              <div className="gemini-msg-body">
                <div className="gemini-typing-capsule">
                  <span className="gemini-shimmer-sparkle" />
                  <span className="gemini-shimmer-text">Afzal's AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
