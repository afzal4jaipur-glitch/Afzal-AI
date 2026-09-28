import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Plus,
  Zap,
  ChevronDown,
  UploadCloud,
  FileText,
  X,
  Globe,
  BookOpen,
  Check
} from 'lucide-react';

export default function ChatInput({
  onSendMessage,
  isLoading,
  prefilledText = '',
  currentMode = 'auto',
  onModeChange,
  activeDocument = null,
  onClearActiveDocument = null,
  onDropFile = null,
  workspaceMode = 'chat',
  placeholder = null
}) {
  const [input, setInput] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isReasoningMenuOpen, setIsReasoningMenuOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const reasoningRef = useRef(null);

  useEffect(() => {
    if (prefilledText) {
      setInput(prefilledText);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [prefilledText]);

  // Close reasoning dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reasoningRef.current && !reasoningRef.current.contains(e.target)) {
        setIsReasoningMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Drag & drop PDF
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (onDropFile) {
        onDropFile(file);
      }
    }
  };

  const hasText = input.trim().length > 0;
  const defaultPlaceholder = activeDocument
    ? `Ask anything about "${activeDocument.originalName}"...`
    : "Ask Afzal's AI, search web, or drag & drop a PDF here...";

  const MODES = [
    { id: 'auto', name: 'Auto reasoning', icon: <Zap size={13} className="text-amber-400" /> },
    { id: 'research', name: 'Deep Web Research', icon: <Globe size={13} className="text-cyan-400" /> },
    { id: 'support', name: 'Document Grounded', icon: <BookOpen size={13} className="text-indigo-400" /> }
  ];

  const currentModeObj = MODES.find((m) => m.id === currentMode) || MODES[0];

  return (
    <div
      className={`gemini-input-wrapper ${isDraggingFile ? 'drag-over-input' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0] && onDropFile) {
            onDropFile(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {/* Grounded Document indicator pill above input if pinned */}
      {activeDocument && (
        <div className="active-grounded-pill">
          <FileText size={13} />
          <span className="grounded-name" title={activeDocument.originalName}>
            Grounded on: <strong>{activeDocument.originalName}</strong>
          </span>
          {onClearActiveDocument && (
            <button
              type="button"
              className="clear-grounded-btn"
              onClick={onClearActiveDocument}
              title="Remove document grounding"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Main Elevated Input Capsule */}
      <div className={`gemini-input-capsule ${hasText ? 'has-content' : ''} ${isDraggingFile ? 'drag-active' : ''}`}>
        {isDraggingFile ? (
          <div className="input-drop-overlay">
            <UploadCloud size={24} className="bounce-icon" />
            <div className="drop-overlay-text">
              <strong>Drop PDF to ground conversation</strong>
              <span>Automatically indexes and switches to Document Research mode</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="gemini-input-form" id="chat-form">
            {/* Auto-expanding textarea */}
            <textarea
              ref={textareaRef}
              id="chat-input"
              className="gemini-textarea"
              rows={1}
              placeholder={placeholder || defaultPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              autoComplete="off"
              aria-label="Ask Afzal's AI"
            />

            {/* Bottom Controls Row */}
            <div className="gemini-input-controls-row">
              {/* Left Controls: Add (+) + Reasoning Mode Pill + Web Status Pill */}
              <div className="controls-left">
                {/* File Attachment (+) */}
                <button
                  type="button"
                  className="gemini-tool-btn upload-doc-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach PDF file to ground chat"
                  aria-label="Attach PDF"
                >
                  <Plus size={18} />
                </button>

                {/* Auto Reasoning Pill */}
                <div className="reasoning-pill-wrap" ref={reasoningRef}>
                  <button
                    type="button"
                    className="auto-reasoning-pill"
                    onClick={() => setIsReasoningMenuOpen((prev) => !prev)}
                    title="Change reasoning mode"
                  >
                    <span className="material-symbols-outlined bolt-icon">bolt</span>
                    <span className="reasoning-pill-text">{currentModeObj.name}</span>
                    <ChevronDown size={13} className={`chevron-down ${isReasoningMenuOpen ? 'open' : ''}`} />
                  </button>

                  {isReasoningMenuOpen && (
                    <div className="reasoning-dropdown-menu">
                      {MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`reasoning-menu-item ${currentMode === m.id ? 'active' : ''}`}
                          onClick={() => {
                            if (onModeChange) onModeChange(m.id);
                            setIsReasoningMenuOpen(false);
                          }}
                        >
                          <span className="menu-item-icon">{m.icon}</span>
                          <span className="menu-item-text">{m.name}</span>
                          {currentMode === m.id && <Check size={14} className="menu-check" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Language Web: Live Pill */}
                <div className="web-live-status-pill" title="Web search grounding is active">
                  <span className="web-live-text">Language Web: Live</span>
                </div>
              </div>

              {/* Right Controls: Glowing Cyan Circular Send Button */}
              <div className="controls-right">
                <button
                  id="send-btn"
                  type="submit"
                  className={`gemini-send-btn ${hasText && !isLoading ? 'active' : ''}`}
                  disabled={!hasText || isLoading}
                  aria-label="Send prompt"
                  title="Send prompt"
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Centered Disclaimer */}
      <div className="gemini-disclaimer">
        <span>Afzal's AI may display inaccurate info, including about people, so double-check its responses.</span>
      </div>
    </div>
  );
}
