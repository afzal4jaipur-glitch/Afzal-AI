import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Plus,
  Mic,
  MicOff,
  Globe,
  Zap,
  BookOpen,
  UploadCloud,
  FileText,
  X
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
  const [isListening, setIsListening] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (prefilledText) {
      setInput(prefilledText);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [prefilledText]);

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

  // 5. Drag & Drop PDF into query bar to invoke document-grounded mode
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

  // Optional voice recognition simulation / API
  const handleToggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Voice recognition error:', e);
      setIsListening(false);
    }
  };

  const getModeIcon = () => {
    switch (currentMode) {
      case 'research':
        return <Globe size={13} className="mode-pill-icon globe" />;
      case 'support':
        return <BookOpen size={13} className="mode-pill-icon book" />;
      default:
        return <Zap size={13} className="mode-pill-icon zap" />;
    }
  };

  const getModeName = () => {
    switch (currentMode) {
      case 'research':
        return 'Deep Research';
      case 'support':
        return 'Document Grounded';
      default:
        return 'Auto';
    }
  };

  const cycleMode = () => {
    if (!onModeChange) return;
    if (currentMode === 'auto') onModeChange('research');
    else if (currentMode === 'research') onModeChange('support');
    else onModeChange('auto');
  };

  const hasText = input.trim().length > 0;

  const defaultPlaceholder = activeDocument
    ? `Ask anything about "${activeDocument.originalName}"...`
    : workspaceMode === 'research'
    ? 'Ask or synthesize from this document...'
    : "Ask Afzal's AI, search web, or drag & drop a PDF here...";

  return (
    <div
      className={`gemini-input-wrapper ${isDraggingFile ? 'drag-over-input' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for attachment button */}
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

      {/* 5. Elevated Input Capsule: refined 1px border and slight surface contrast */}
      <div className={`gemini-input-capsule ${hasText ? 'has-content' : ''} ${isDraggingFile ? 'drag-active' : ''}`}>
        {/* Drag overlay state */}
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
            {/* Multiline auto-expanding textarea */}
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

            {/* Bottom Tools & Action Controls */}
            <div className="gemini-input-controls-row">
              {/* 5. Left Controls: File attachment (+) & Mode selector visually separated with a clear divider */}
              <div className="controls-left">
                {/* File Attachment Button */}
                <button
                  type="button"
                  className="gemini-tool-btn upload-doc-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach PDF file to ground chat"
                  aria-label="Attach PDF"
                >
                  <Plus size={18} />
                </button>

                {/* Clear divider separating file attachment from mode selection */}
                <span className="input-control-divider" aria-hidden="true" />

                {/* Distinct Mode Selection Pill (Auto / Deep Research / Document Grounded) */}
                <button
                  type="button"
                  className={`gemini-mode-tag-btn ${currentMode}`}
                  onClick={cycleMode}
                  title="Mode: Click to cycle Auto, Deep Research, or Document Grounded"
                >
                  {getModeIcon()}
                  <span>{getModeName()}</span>
                </button>
              </div>

              {/* Right Controls: Mic & Send Button */}
              <div className="controls-right">
                <button
                  type="button"
                  className={`gemini-tool-btn mic-btn ${isListening ? 'listening' : ''}`}
                  onClick={handleToggleVoice}
                  title={isListening ? 'Listening... click to stop' : 'Use microphone'}
                  aria-label="Voice input"
                >
                  {isListening ? <MicOff size={18} color="#ef4444" /> : <Mic size={18} />}
                </button>

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

      {/* Accuracy Disclaimer */}
      <div className="gemini-disclaimer">
        <span>Afzal's AI may display inaccurate info, including about people, so double-check its responses.</span>
      </div>
    </div>
  );
}
