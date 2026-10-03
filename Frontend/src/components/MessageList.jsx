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
  Share2
} from 'lucide-react';

function getWebsiteName(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (e) {
    return 'Web Source';
  }
}

/**
 * Cleans conversational prose so normal AI responses look like natural conversation.
 * Strips unnecessary decorative Markdown symbols like ***, **, *, and #.
 * Preserves structured headings, lists, tables, and code when appropriate.
 */
function cleanConversationalProse(text) {
  if (!text) return '';

  // 1. Strip triple asterisks (e.g., ***Tokyo*** -> Tokyo)
  let cleaned = text.replace(/\*{3,}([^*\n]+?)\*{3,}/g, '$1');
  cleaned = cleaned.replace(/_{3,}([^_\n]+?)_{3,}/g, '$1');

  // Check if text is a short direct conversational answer (< 350 chars)
  const isShortDirectResponse = cleaned.trim().length < 350 && !cleaned.includes('```') && !cleaned.includes('|');

  if (isShortDirectResponse) {
    // Strip leading decorative markdown headings on direct answers (e.g. "### Tokyo" -> "Tokyo")
    cleaned = cleaned.replace(/^\s*#{1,6}\s+/gm, '');

    // Strip bolding on single terms / entities (e.g. "The capital of Japan is **Tokyo**." -> "The capital of Japan is Tokyo.")
    cleaned = cleaned.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/(?<!\w)\*([^*\n\s]+?)\*(?!\w)/g, '$1');

    // Strip isolated leading bullet on single sentence
    cleaned = cleaned.replace(/^\s*[-*•]\s+/gm, '');
  } else {
    // For longer responses:
    // Strip decorative bolding on isolated terms after common prepositions/verbs
    // e.g. "The capital of Japan is **Tokyo**." -> "The capital of Japan is Tokyo."
    cleaned = cleaned.replace(/(?<=\b(?:is|was|are|were|in|at|called|named|to|of|the|a|an)\s+)\*\*([^*\n:]+?)\*\*(?=[\.,!\?\s]|$)/gi, '$1');
    cleaned = cleaned.replace(/^(\s*)\*\*([^*\n:]+?)\*\*\s+(is|are|was|were)\b/gi, '$1$2 $3');
    cleaned = cleaned.replace(/\s+\*\*([^*\n:]+?)\*\*(?=[\.,!\?])/g, ' $1');

    // Strip unnecessary decorative italics on isolated single terms (e.g. *Tokyo* -> Tokyo)
    cleaned = cleaned.replace(/(?<=\b(?:is|was|are|were|in|at|called|named|to|of|the|a|an)\s+)\*([^*\n:\s]+?)\*(?=[\.,!\?\s]|$)/gi, '$1');

    // Strip leading decorative heading if there's only 1 heading and it's short
    if (/^\s*#{1,6}\s+/.test(cleaned) && (cleaned.match(/#{1,6}\s+/g) || []).length === 1 && cleaned.length < 500) {
      cleaned = cleaned.replace(/^\s*#{1,6}\s+/, '');
    }
  }

  // Strip any stray unclosed or orphan asterisks (e.g. "** Tokyo" or "Tokyo **")
  cleaned = cleaned.replace(/(^|\s)\*{1,2}(\s|$)/g, '$1$2');

  return cleaned;
}

function formatInlineText(text) {
  if (!text) return '';
  const cleaned = cleanConversationalProse(text);
  const parts = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleaned.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < cleaned.length) {
    parts.push(cleaned.substring(lastIndex));
  }
  return parts.length > 0 ? parts : cleaned;
}

function ConversationalMessageBody({ text = '' }) {
  if (!text) return null;

  // Split text by code blocks ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const segments = [];
  let lastIdx = 0;
  let codeMatch;

  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    if (codeMatch.index > lastIdx) {
      segments.push({ type: 'text', content: text.substring(lastIdx, codeMatch.index) });
    }
    segments.push({
      type: 'code',
      lang: codeMatch[1] || 'code',
      code: codeMatch[2].trim()
    });
    lastIdx = codeBlockRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', content: text.substring(lastIdx) });
  }

  return (
    <div className="conversational-body">
      {segments.map((segment, sIdx) => {
        if (segment.type === 'code') {
          return (
            <div key={sIdx} className="conversational-code-block">
              <div className="code-block-header">
                <span className="code-lang-tag">{segment.lang}</span>
                <button
                  type="button"
                  className="code-copy-btn"
                  onClick={() => navigator.clipboard?.writeText(segment.code)}
                  title="Copy code"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="code-pre">
                <code>{segment.code}</code>
              </pre>
            </div>
          );
        }

        const lines = segment.content.split('\n');
        const elements = [];
        let currentList = null;
        let tableBuffer = [];

        const flushList = () => {
          if (currentList) {
            // Only render as a list if there are at least 2 items, otherwise render as natural paragraph
            if (currentList.items.length === 1) {
              elements.push(
                <p key={`p-${elements.length}`} className="conversational-p">
                  {formatInlineText(currentList.items[0])}
                </p>
              );
            } else if (currentList.type === 'ol') {
              elements.push(
                <ol key={`ol-${elements.length}`} className="conversational-ol">
                  {currentList.items.map((item, i) => (
                    <li key={i}>{formatInlineText(item)}</li>
                  ))}
                </ol>
              );
            } else {
              elements.push(
                <ul key={`ul-${elements.length}`} className="conversational-ul">
                  {currentList.items.map((item, i) => (
                    <li key={i}>{formatInlineText(item)}</li>
                  ))}
                </ul>
              );
            }
            currentList = null;
          }
        };

        const flushTable = () => {
          if (tableBuffer.length >= 2) {
            const rawHeader = tableBuffer[0];
            const headers = rawHeader
              .split('|')
              .map((c) => c.trim())
              .filter(Boolean);

            const dataRows = tableBuffer.slice(2).map((row) =>
              row
                .split('|')
                .map((c) => c.trim())
                .filter(Boolean)
            );

            elements.push(
              <div key={`table-${elements.length}`} className="conversational-table-wrapper">
                <table className="conversational-table">
                  <thead>
                    <tr>
                      {headers.map((h, hIdx) => (
                        <th key={hIdx}>{formatInlineText(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{formatInlineText(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          tableBuffer = [];
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          // Markdown table row detector
          if (/^\|(.+)\|$/.test(trimmed)) {
            flushList();
            tableBuffer.push(trimmed);
            continue;
          } else if (tableBuffer.length > 0) {
            flushTable();
          }

          if (!trimmed) {
            flushList();
            continue;
          }

          // Numbered list item
          const olMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
          if (olMatch) {
            if (!currentList || currentList.type !== 'ol') {
              flushList();
              currentList = { type: 'ol', items: [] };
            }
            currentList.items.push(olMatch[2]);
            continue;
          }

          // Bulleted list item
          const ulMatch = trimmed.match(/^[-*•]\s+(.*)/);
          if (ulMatch) {
            if (!currentList || currentList.type !== 'ul') {
              flushList();
              currentList = { type: 'ul', items: [] };
            }
            currentList.items.push(ulMatch[1]);
            continue;
          }

          // Markdown heading
          const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
          if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            const hText = headingMatch[2];
            if (level <= 2) {
              elements.push(<h3 key={`h-${elements.length}`} className="conversational-h3">{formatInlineText(hText)}</h3>);
            } else {
              elements.push(<h4 key={`h-${elements.length}`} className="conversational-h4">{formatInlineText(hText)}</h4>);
            }
            continue;
          }

          // Regular paragraph
          flushList();
          elements.push(
            <p key={`p-${elements.length}`} className="conversational-p">
              {formatInlineText(trimmed)}
            </p>
          );
        }

        flushList();
        flushTable();
        return <React.Fragment key={sIdx}>{elements}</React.Fragment>;
      })}
    </div>
  );
}

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

                    {/* Text Payload with Clean Conversational Formatting */}
                    <div className={`gemini-msg-text ${msg.role}`}>
                      <ConversationalMessageBody text={msg.text} />
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
