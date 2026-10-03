import React, { useState, useRef, useEffect } from 'react';
import { useUser, useClerk, UserButton } from '@clerk/react';
import AppLogo from './AppLogo';
import {
  Menu,
  ChevronDown,
  Sparkles,
  Sun,
  Moon,
  LogIn,
  RotateCcw,
  Zap,
  Cpu,
  ShieldCheck,
  Check,
  MessageSquare,
  Layers,
  Settings
} from 'lucide-react';

export default function ChatHeader({
  onClearChat,
  messageCount,
  workspaceMode = 'chat',
  onWorkspaceModeChange,
  activeDocument = null,
  modelTier = 'flash',
  onModelTierChange,
  user = null,
  onToggleSidebar,
  onOpenSettings,
  theme = 'dark',
  onToggleTheme
}) {
  const { isSignedIn } = useUser();
  const { openSignIn, openSignUp } = useClerk();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getModelLabel = () => {
    switch (modelTier) {
      case 'pro':
        return "Afzal's AI 2.5 Pro";
      case 'ultra':
        return "Afzal's AI Ultra";
      case 'flash':
      default:
        return "Afzal's AI 2.5 Flash";
    }
  };

  const TIERS = [
    {
      id: 'flash',
      name: "Afzal's AI 2.5 Flash",
      badge: 'Active',
      badgeClass: 'flash',
      icon: <Zap size={15} />,
      desc: 'Fast, responsive & smart assistant for rapid querying (Default)'
    },
    {
      id: 'pro',
      name: "Afzal's AI 2.5 Pro",
      badge: 'Pro',
      badgeClass: 'pro',
      icon: <Cpu size={15} />,
      desc: 'Advanced reasoning, deep web grounding & multi-step synthesis'
    },
    {
      id: 'ultra',
      name: "Afzal's AI Ultra",
      badge: 'Ultra',
      badgeClass: 'ultra',
      icon: <ShieldCheck size={15} />,
      desc: 'High-capacity context window for extensive document analysis'
    }
  ];

  return (
    <header className="gemini-header">
      {/* Left: Menu, Brand, Model Selector */}
      <div className="gemini-header-left">
        <button
          type="button"
          className="gemini-icon-btn gemini-menu-btn"
          onClick={onToggleSidebar}
          title="Main menu"
          aria-label="Toggle menu"
        >
          <Menu size={19} />
        </button>

        <div className="gemini-brand-wrap">
          <AppLogo size={26} />
          <span className="gemini-brand-name">Afzal's AI</span>
        </div>

        {/* Model Selector Pill */}
        <div className="gemini-model-selector-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="gemini-model-pill"
            onClick={() => setIsModelDropdownOpen((prev) => !prev)}
            aria-expanded={isModelDropdownOpen}
            aria-haspopup="true"
            title="Switch AI model tier"
          >
            <span className="model-status-dot" />
            <span className="gemini-model-name">{getModelLabel()}</span>
            <ChevronDown size={14} className={`chevron-icon ${isModelDropdownOpen ? 'rotated' : ''}`} />
          </button>

          {isModelDropdownOpen && (
            <div className="gemini-dropdown-menu">
              <div className="dropdown-section-title">Model Tier Management</div>

              {TIERS.map((tier) => {
                const isSelected = modelTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    className={`gemini-dropdown-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (onModelTierChange) onModelTierChange(tier.id);
                      setIsModelDropdownOpen(false);
                    }}
                  >
                    <div className="dropdown-item-icon">
                      {tier.icon}
                    </div>
                    <div className="dropdown-item-content">
                      <div className="dropdown-item-header">
                        <span className="dropdown-item-title">{tier.name}</span>
                        <span className={`model-tier-badge ${tier.badgeClass}`}>{tier.badge}</span>
                      </div>
                      <span className="dropdown-item-desc">{tier.desc}</span>
                    </div>
                    {isSelected && <Check size={16} className="item-check" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Center: 3-Segment Switcher (Chat | Research & Synthesis | Artifacts) */}
      <div className="gemini-header-center">
        <div className="workspace-mode-selector" role="tablist" aria-label="Workspace Mode">
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'chat'}
            className={`workspace-mode-btn ${workspaceMode === 'chat' ? 'active' : ''}`}
            onClick={() => onWorkspaceModeChange && onWorkspaceModeChange('chat')}
            title="Switch to Chat view"
          >
            <MessageSquare size={14} className="tab-icon chat-icon" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'research'}
            className={`workspace-mode-btn ${workspaceMode === 'research' ? 'active' : ''}`}
            onClick={() => onWorkspaceModeChange && onWorkspaceModeChange('research')}
            title="Switch to Research & Synthesis view"
          >
            <Sparkles size={14} className="tab-icon sparkles-icon" />
            <span>Research & Synthesis</span>
            {activeDocument && <span className="workspace-mode-dot" title={`Active: ${activeDocument.originalName}`} />}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'artifacts'}
            className={`workspace-mode-btn ${workspaceMode === 'artifacts' ? 'active' : ''}`}
            onClick={() => onWorkspaceModeChange && onWorkspaceModeChange('artifacts')}
            title="Switch to Artifacts view"
          >
            <Layers size={14} className="tab-icon layers-icon" />
            <span>Artifacts</span>
          </button>
        </div>
      </div>

      {/* Right: Actions, Theme, Settings, User Avatar */}
      <div className="gemini-header-right">
        {messageCount > 1 && (
          <button
            type="button"
            className="gemini-icon-btn"
            onClick={onClearChat}
            title="Reset conversation"
            aria-label="Reset conversation"
          >
            <RotateCcw size={16} />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="gemini-icon-btn header-action-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="gemini-icon-btn header-action-btn"
          onClick={onOpenSettings}
          title="Settings & Preferences"
          aria-label="Settings"
        >
          <Settings size={17} />
        </button>

        {/* Auth Controls / User Avatar */}
        {!isSignedIn ? (
          <div className="gemini-header-auth-group">
            <button
              type="button"
              className="gemini-sign-in-btn"
              onClick={() => openSignIn ? openSignIn() : null}
              title="Sign In to your account"
              aria-label="Sign in"
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              className="gemini-sign-up-btn"
              onClick={() => openSignUp ? openSignUp() : null}
              title="Create a free account"
              aria-label="Sign up"
            >
              <Sparkles size={14} />
              <span>Sign Up</span>
            </button>
          </div>
        ) : (
          <div className="header-avatar-container">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'gemini-clerk-avatar'
                }
              }}
            />
            <span className="avatar-online-badge" />
          </div>
        )}
      </div>
    </header>
  );
}
