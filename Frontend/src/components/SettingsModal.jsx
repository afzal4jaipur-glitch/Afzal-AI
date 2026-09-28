import React, { useEffect, useState } from 'react';
import {
  X,
  Type,
  Sun,
  Moon,
  Trash2,
  Check,
  Sliders
} from 'lucide-react';
import { FONTS, FONT_SIZES } from '../constants/fonts';

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  currentFont,
  onFontChange,
  currentFontSize,
  onFontSizeChange,
  onClearAllConversations,
  conversationCount = 0
}) {
  const [activeTab, setActiveTab] = useState('appearance'); // 'appearance' | 'typography' | 'data'
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card settings-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-title">
            <div className="modal-icon-badge">
              <Sliders size={18} />
            </div>
            <div>
              <h2 id="settings-modal-title">Settings</h2>
              <p className="modal-subtitle">Personalize your AI workspace experience</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="settings-tabs-bar">
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Sun size={15} />
            <span>Theme & Style</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'typography' ? 'active' : ''}`}
            onClick={() => setActiveTab('typography')}
          >
            <Type size={15} />
            <span>Typography</span>
          </button>
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Trash2 size={15} />
            <span>Chat Data</span>
          </button>
        </div>

        {/* Tab 1: Appearance & Theme */}
        {activeTab === 'appearance' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Interface Theme</h3>
                <p>Select between Google-inspired dark or light surfaces.</p>
              </div>

              <div className="theme-options-grid">
                <button
                  type="button"
                  className={`theme-option-card dark ${theme === 'dark' ? 'selected' : ''}`}
                  onClick={() => onThemeChange('dark')}
                >
                  <div className="theme-card-preview theme-preview-dark">
                    <div className="preview-top-bar">
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <div className="preview-chat-body">
                      <div className="preview-bubble preview-bot"></div>
                      <div className="preview-bubble preview-user"></div>
                    </div>
                  </div>
                  <div className="theme-card-info">
                    <div className="theme-card-title">
                      <Moon size={16} />
                      <strong>Dark Theme</strong>
                    </div>
                    <span>Sleek Google Gemini dark surface</span>
                  </div>
                  {theme === 'dark' && <div className="theme-check-badge"><Check size={13} /></div>}
                </button>

                <button
                  type="button"
                  className={`theme-option-card light ${theme === 'light' ? 'selected' : ''}`}
                  onClick={() => onThemeChange('light')}
                >
                  <div className="theme-card-preview theme-preview-light">
                    <div className="preview-top-bar">
                      <span className="dot dot-red"></span>
                      <span className="dot dot-yellow"></span>
                      <span className="dot dot-green"></span>
                    </div>
                    <div className="preview-chat-body">
                      <div className="preview-bubble preview-bot"></div>
                      <div className="preview-bubble preview-user"></div>
                    </div>
                  </div>
                  <div className="theme-card-info">
                    <div className="theme-card-title">
                      <Sun size={16} />
                      <strong>Light Theme</strong>
                    </div>
                    <span>Crisp, clean high-contrast canvas</span>
                  </div>
                  {theme === 'light' && <div className="theme-check-badge"><Check size={13} /></div>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Typography & Font Size */}
        {activeTab === 'typography' && (
          <div className="settings-tab-content">
            {/* Font Size Selector */}
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Font Size</h3>
                <p>Adjust reading comfort across messages and documents.</p>
              </div>

              <div className="font-size-segmented-control">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    className={`font-size-segment ${currentFontSize === size.id ? 'active' : ''}`}
                    onClick={() => onFontSizeChange(size.id)}
                  >
                    <span className="font-size-label">{size.label}</span>
                    <span className="font-size-sub">{size.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Family Selector (8 Professional Fonts) */}
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Font Family</h3>
                <p>Choose from 8 curated, professional typefaces.</p>
              </div>

              <div className="fonts-grid">
                {FONTS.map((font) => {
                  const isSelected = currentFont === font.id;
                  return (
                    <button
                      key={font.id}
                      type="button"
                      className={`font-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => onFontChange(font.id)}
                      style={{ fontFamily: font.family }}
                    >
                      <div className="font-card-top">
                        <span className="font-name" style={{ fontFamily: font.family }}>
                          {font.name}
                        </span>
                        <span className="font-tag">{font.tag}</span>
                      </div>
                      <p className="font-sample" style={{ fontFamily: font.family }}>
                        {font.sample}
                      </p>
                      {isSelected && (
                        <div className="font-selected-indicator">
                          <Check size={13} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Chat Data Management */}
        {activeTab === 'data' && (
          <div className="settings-tab-content">
            <div className="settings-section">
              <div className="settings-section-header">
                <h3>Conversations History</h3>
                <p>
                  You currently have <strong>{conversationCount}</strong> saved{' '}
                  {conversationCount === 1 ? 'conversation' : 'conversations'} in your history.
                </p>
              </div>

              <div className="data-management-box">
                <div className="data-box-text">
                  <h4>Clear All Conversations</h4>
                  <p>Permanently remove all previous chat sessions from local history. This cannot be undone.</p>
                </div>

                {!showClearConfirm ? (
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 size={15} />
                    <span>Clear All Chats</span>
                  </button>
                ) : (
                  <div className="confirm-action-group">
                    <span className="confirm-warn-text">Are you sure?</span>
                    <button
                      type="button"
                      className="btn-danger-solid"
                      onClick={() => {
                        onClearAllConversations();
                        setShowClearConfirm(false);
                      }}
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      className="btn-subtle"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="modal-footer settings-modal-footer">
          <span className="settings-save-hint">Changes apply instantly</span>
          <button
            type="button"
            className="btn-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
