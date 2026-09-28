import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Search,
  Sparkles,
  Layers,
  Copy,
  Check,
  ChevronDown,
  UploadCloud,
  X,
  Maximize2,
  Minimize2,
  BookOpen,
  ArrowRight,
  Highlighter,
  MessageSquare
} from 'lucide-react';

export default function DocumentViewer({
  document: activeDoc,
  documents = [],
  onSelectDocument,
  onAskAboutExcerpt,
  onAutoPrompt,
  onUploadFile,
  isUploading = false,
  uploadStatus = '',
  onClose,
  token = null,
  isSignedIn = false
}) {
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [floatingMenuPos, setFloatingMenuPos] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch document details/chunks when active document changes
  const fetchDocDetails = useCallback(async (docId) => {
    if (!docId) return;
    setLoading(true);
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`http://localhost:5000/api/documents/${docId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDocData(data.document || null);
      } else {
        setDocData(null);
      }
    } catch (err) {
      console.warn('Could not fetch document details:', err);
      setDocData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeDoc?._id || activeDoc?.id) {
      fetchDocDetails(activeDoc._id || activeDoc.id);
    } else {
      setDocData(null);
    }
    // Clear selection
    setSelectedText('');
    setFloatingMenuPos(null);
  }, [activeDoc, fetchDocDetails]);

  // Handle active text selection inside document
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // Don't close immediately if clicking inside the floating menu itself
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 5) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect() || { top: 0, left: 0 };

      // Calculate relative coordinates
      const top = Math.max(10, rect.top - containerRect.top - 46);
      const left = Math.min(
        Math.max(16, rect.left - containerRect.left + rect.width / 2 - 140),
        (containerRect.width || 600) - 290
      );

      setSelectedText(text);
      setFloatingMenuPos({ top, left });
    }
  };

  const clearSelection = () => {
    setSelectedText('');
    setFloatingMenuPos(null);
    window.getSelection()?.removeAllRanges();
  };

  // Quick Action: Ask AI about selected text
  const handleAskSelection = () => {
    if (!selectedText) return;
    const prompt = `Regarding "${activeDoc?.originalName}":\n"${selectedText}"\n\nCan you explain this part in detail?`;
    if (onAskAboutExcerpt) {
      onAskAboutExcerpt(prompt);
    }
    clearSelection();
  };

  // Quick Action: Summarize selected text
  const handleSummarizeSelection = () => {
    if (!selectedText) return;
    const prompt = `Summarize the following passage from "${activeDoc?.originalName}":\n"${selectedText}"`;
    if (onAutoPrompt) {
      onAutoPrompt(prompt);
    }
    clearSelection();
  };

  // Quick Action: Key Takeaways
  const handleKeyTakeawaysSelection = () => {
    if (!selectedText) return;
    const prompt = `Extract the key takeaways and critical points from this excerpt in "${activeDoc?.originalName}":\n"${selectedText}"`;
    if (onAutoPrompt) {
      onAutoPrompt(prompt);
    }
    clearSelection();
  };

  // Quick Action: Copy selection
  const handleCopySelection = async () => {
    if (!selectedText) return;
    try {
      await navigator.clipboard.writeText(selectedText);
      setCopiedSuccess(true);
      setTimeout(() => {
        setCopiedSuccess(false);
        clearSelection();
      }, 1400);
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Document chunks to display
  const chunks = docData?.chunks || [];
  const hasRealChunks = chunks.length > 0;

  // Filter chunks by search query
  const filteredChunks = searchQuery.trim()
    ? chunks.filter((c) => c.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : chunks;

  return (
    <div
      className={`gemini-doc-viewer-pane ${isFullscreen ? 'fullscreen' : ''}`}
      ref={containerRef}
      onMouseUp={handleMouseUp}
    >
      {/* Pane Top Header */}
      <div className="doc-viewer-header">
        <div className="doc-viewer-title-group" ref={dropdownRef}>
          <div className="doc-type-icon">
            <FileText size={18} />
          </div>

          <div
            className="doc-switcher-trigger"
            onClick={() => setIsDocDropdownOpen((prev) => !prev)}
            title="Click to switch document"
          >
            <div className="doc-active-name" title={activeDoc?.originalName || 'No document selected'}>
              {activeDoc?.originalName || 'Select a document'}
            </div>
            <ChevronDown size={14} className={`dropdown-chevron ${isDocDropdownOpen ? 'open' : ''}`} />
          </div>

          {/* Switcher Dropdown */}
          {isDocDropdownOpen && (
            <div className="doc-switcher-dropdown">
              <div className="dropdown-section-header">Indexed Documents ({documents.length})</div>
              {documents.length === 0 ? (
                <div className="doc-empty-item">No documents in library</div>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc._id || doc.id}
                    type="button"
                    className={`doc-dropdown-item ${(doc._id || doc.id) === (activeDoc?._id || activeDoc?.id) ? 'active' : ''}`}
                    onClick={() => {
                      onSelectDocument(doc);
                      setIsDocDropdownOpen(false);
                    }}
                  >
                    <FileText size={14} />
                    <span className="dropdown-item-name">{doc.originalName}</span>
                    {(doc._id || doc.id) === (activeDoc?._id || activeDoc?.id) && (
                      <Check size={14} className="dropdown-check-icon" />
                    )}
                  </button>
                ))
              )}

              <div className="doc-dropdown-footer">
                <button
                  type="button"
                  className="dropdown-upload-btn"
                  onClick={() => {
                    setIsDocDropdownOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <UploadCloud size={14} />
                  <span>Upload another PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="doc-viewer-header-actions">
          {activeDoc && (
            <div className="doc-meta-badge">
              <Layers size={12} />
              <span>{activeDoc.chunkCount || chunks.length || 1} chunks</span>
              <span>•</span>
              <span>{formatFileSize(activeDoc.size)}</span>
            </div>
          )}

          <button
            type="button"
            className="doc-icon-tool-btn"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? 'Exit split expand' : 'Expand viewer'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {onClose && (
            <button
              type="button"
              className="doc-icon-tool-btn"
              onClick={onClose}
              title="Close document viewer (Switch to Chat)"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input for uploading from viewer */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && onUploadFile) {
            onUploadFile(e.target.files[0]);
          }
        }}
      />

      {/* Search & Quick Filter Bar */}
      {activeDoc && (
        <div className="doc-search-actions-bar">
          <div className="doc-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search document text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="doc-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="doc-quick-prompts-row">
            <button
              type="button"
              className="doc-quick-action-pill"
              onClick={() =>
                onAutoPrompt &&
                onAutoPrompt(`Generate a comprehensive executive brief summarizing the core takeaways of "${activeDoc.originalName}".`)
              }
              title="Summarize document"
            >
              <Sparkles size={12} />
              <span>Executive Brief</span>
            </button>

            <button
              type="button"
              className="doc-quick-action-pill"
              onClick={() =>
                onAutoPrompt &&
                onAutoPrompt(`List all actionable steps, requirements, and key policies mentioned in "${activeDoc.originalName}".`)
              }
              title="Extract action items"
            >
              <Check size={12} />
              <span>Action Items</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Active Text-Selection Toolbar */}
      {floatingMenuPos && selectedText && (
        <div
          className="doc-selection-toolbar"
          style={{ top: `${floatingMenuPos.top}px`, left: `${floatingMenuPos.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="selection-toolbar-indicator">
            <Highlighter size={12} />
            <span>Selection</span>
          </div>

          <div className="selection-toolbar-actions">
            <button
              type="button"
              className="selection-tool-btn highlight"
              onClick={handleAskSelection}
              title="Ask AI about this selection"
            >
              <MessageSquare size={13} />
              <span>Ask AI</span>
            </button>

            <button
              type="button"
              className="selection-tool-btn"
              onClick={handleSummarizeSelection}
              title="Summarize this passage"
            >
              <Sparkles size={13} />
              <span>Summarize</span>
            </button>

            <button
              type="button"
              className="selection-tool-btn"
              onClick={handleKeyTakeawaysSelection}
              title="Extract takeaways"
            >
              <Layers size={13} />
              <span>Takeaways</span>
            </button>

            <button
              type="button"
              className="selection-tool-btn"
              onClick={handleCopySelection}
              title="Copy quote to clipboard"
            >
              {copiedSuccess ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
              <span>{copiedSuccess ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              className="selection-tool-btn dismiss"
              onClick={clearSelection}
              title="Dismiss toolbar"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Main Document Content Body */}
      <div className="doc-viewer-body">
        {loading ? (
          <div className="doc-loading-state">
            <div className="doc-loading-skeleton">
              <div className="skeleton-bar title"></div>
              <div className="skeleton-bar"></div>
              <div className="skeleton-bar medium"></div>
              <div className="skeleton-bar"></div>
              <div className="skeleton-bar short"></div>
            </div>
            <p>Loading document index & extracted text...</p>
          </div>
        ) : !activeDoc ? (
          <div className="doc-empty-placeholder">
            <div className="doc-empty-icon-wrap">
              <BookOpen size={42} />
            </div>
            <h3>Document Research & Synthesis</h3>
            <p>
              Select an uploaded document from the <strong>Document Library</strong> sidebar or upload a new PDF to inspect text, select passages, and run grounded queries.
            </p>
            {documents.length > 0 ? (
              <div className="doc-select-prompt-list">
                <span className="prompt-list-heading">Quick Select from Library:</span>
                <div className="quick-docs-grid">
                  {documents.slice(0, 4).map((d) => (
                    <button
                      key={d._id || d.id}
                      type="button"
                      className="quick-doc-card-btn"
                      onClick={() => onSelectDocument(d)}
                    >
                      <FileText size={16} />
                      <div className="quick-doc-name" title={d.originalName}>{d.originalName}</div>
                      <ArrowRight size={14} className="arrow-hover" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="gemini-upload-cta-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={16} />
                <span>Upload a PDF to Start</span>
              </button>
            )}
          </div>
        ) : hasRealChunks ? (
          <div className="doc-chunks-stream">
            <div className="doc-overview-banner">
              <div className="overview-title">Document Grounding Active</div>
              <p>
                Highlighted text can be queried directly with the floating action bar. The contextual chat on the right is pinned to <strong>{activeDoc.originalName}</strong>.
              </p>
            </div>

            {filteredChunks.length === 0 ? (
              <div className="doc-search-no-results">
                No paragraphs found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredChunks.map((chunk, idx) => {
                const pageNum = chunk.pageNumber || Math.floor(idx / 2) + 1;
                return (
                  <div key={chunk._id || idx} className="doc-chunk-card" data-chunk-index={idx}>
                    <div className="chunk-header">
                      <span className="chunk-page-tag">Page {pageNum}</span>
                      <span className="chunk-index-tag">Section {idx + 1}</span>
                    </div>
                    <div className="chunk-text-content">
                      {searchQuery ? (
                        <HighlightedContent text={chunk.text} query={searchQuery} />
                      ) : (
                        <p>{chunk.text}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Fallback document representation while vector chunks load */
          <div className="doc-chunks-stream">
            <div className="doc-overview-banner">
              <div className="overview-title">Document Grounding Active</div>
              <p>
                Indexed in personal Pinecone namespace for high-dimensional semantic search. Highlight text below or ask questions in the right pane.
              </p>
            </div>

            <div className="doc-chunk-card">
              <div className="chunk-header">
                <span className="chunk-page-tag">Page 1</span>
                <span className="chunk-index-tag">Indexed Document</span>
              </div>
              <div className="chunk-text-content">
                <h4 style={{ marginBottom: '8px', color: 'var(--gemini-text-primary)' }}>
                  {activeDoc.originalName}
                </h4>
                <p>
                  This PDF was indexed with {activeDoc.chunkCount || 1} vector embeddings. When you enter a prompt in the adjacent contextual chat, Afzal&apos;s AI queries Pinecone to retrieve exact matching excerpts from this document and cite them in its answers.
                </p>
                <p style={{ marginTop: '12px' }}>
                  Tip: You can highlight any sentence on this page to trigger the floating AI tools, or ask questions like &quot;What are the main requirements mentioned in this file?&quot;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pane Footer Tip */}
      {activeDoc && (
        <div className="doc-viewer-footer">
          <Sparkles size={12} className="footer-sparkle" />
          <span>Tip: Select any sentence to instantly summarize or ask questions</span>
        </div>
      )}
    </div>
  );
}

// Subcomponent to highlight searched term in text
function HighlightedContent({ text, query }) {
  if (!query) return <p>{text}</p>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <p>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="doc-search-match">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </p>
  );
}
