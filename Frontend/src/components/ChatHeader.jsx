import React, { useState, useRef, useEffect } from 'react';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import AppLogo from './AppLogo';
import {
  Menu,
  ChevronDown,
  Sparkles,
  Sliders,
  Sun,
  Moon,
  LogIn,
  RotateCcw,
  Zap,
  Cpu,
  ShieldCheck,
  Check,
  UserPlus,
  MessageSquare
} from 'lucide-react';

export default function ChatHeader({
  onClearChat,
  messageCount,
  // Workspace Mode (Chat vs Research & Synthesis)
  workspaceMode = 'chat',
  onWorkspaceModeChange,
  activeDocument = null,
  // Model Tier Selector
  modelTier = 'flash',
  onModelTierChange,
  onToggleSidebar,
  onOpenSettings,
  theme = 'dark',
  onToggleTheme
}) {
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
        return "Afzal's AI Pro";
      case 'ultra':
        return "Afzal's AI Ultra";
      case 'flash':
      default:
        return "Afzal's AI Flash";
    }
  };

  const TIERS = [
    {
      id: 'flash',
      name: "Afzal's AI Flash",
      badge: 'Flash',
      badgeClass: 'flash',
      icon: <Zap size={16} />,
      desc: 'Fast, responsive & smart assistant for rapid querying (Default)'
    },
    {
      id: 'pro',
      name: "Afzal's AI Pro",
      badge: 'Pro',
      badgeClass: 'pro',
      icon: <Cpu size={16} />,
      desc: 'Advanced reasoning, deep web grounding & multi-step synthesis'
    },
    {
      id: 'ultra',
      name: "Afzal's AI Ultra",
      badge: 'Ultra',
      badgeClass: 'ultra',
      icon: <ShieldCheck size={16} />,
      desc: 'High-capacity context window for extensive document analysis'
    }
  ];

  return (
    <header className="gemini-header">
      {/* Left: Hamburger, Brand, Model Selector, and Workspace Mode Segmented Selector */}
      <div className="gemini-header-left">
        <button
          type="button"
          className="gemini-icon-btn gemini-menu-btn"
          onClick={onToggleSidebar}
          title="Main menu"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <div className="gemini-brand-wrap">
          <AppLogo size={30} />
          <span className="gemini-brand-name">Afzal's AI</span>
        </div>

        {/* 4. Unified Model Selector Dropdown in Top Bar */}
        <div className="gemini-model-selector-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="gemini-model-pill"
            onClick={() => setIsModelDropdownOpen((prev) => !prev)}
            aria-expanded={isModelDropdownOpen}
            aria-haspopup="true"
            title="Switch AI model tier"
          >
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
                        {/* Display tier badges strictly inside dropdown menu items */}
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

        {/* 2. Dual-Mode Central Workspace Segmented Toggle */}
        <div className="workspace-mode-selector" role="tablist" aria-label="Workspace Mode">
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'chat'}
            className={`workspace-mode-btn ${workspaceMode === 'chat' ? 'active' : ''}`}
            onClick={() => onWorkspaceModeChange && onWorkspaceModeChange('chat')}
            title="Switch to Conversational Chat view"
          >
            <MessageSquare size={14} />
            <span>Chat</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'research'}
            className={`workspace-mode-btn ${workspaceMode === 'research' ? 'active' : ''}`}
            onClick={() => onWorkspaceModeChange && onWorkspaceModeChange('research')}
            title="Switch to Document Research & Synthesis view"
          >
            <Sparkles size={14} />
            <span>Research & Synthesis</span>
            {activeDocument && <span className="workspace-mode-dot" title={`Active: ${activeDocument.originalName}`} />}
          </button>
        </div>
      </div>

      {/* Right: Actions & User Avatar (Cleaned up: removed My PDFs button and competing Pro badge) */}
      <div className="gemini-header-right">
        {/* Clear Chat Button (if messages exist) */}
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

        {/* Settings Button */}
        <button
          type="button"
          className="gemini-icon-btn"
          onClick={onOpenSettings}
          title="Settings & Font Options"
          aria-label="Settings"
        >
          <Sliders size={16} />
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="gemini-icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Clerk Auth Controls */}
        <Show when="signed-out">
          <div className="gemini-header-auth-group">
            <SignInButton mode="modal">
              <button
                type="button"
                className="gemini-sign-in-btn"
                title="Sign in with Clerk"
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="gemini-sign-up-btn"
                title="Create an account"
              >
                <UserPlus size={15} />
                <span>Sign Up</span>
              </button>
            </SignUpButton>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="gemini-header-user-btn-wrap">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'gemini-clerk-avatar'
                }
              }}
            />
          </div>
        </Show>
      </div>
    </header>
  );
}
