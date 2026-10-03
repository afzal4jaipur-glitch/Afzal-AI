import React, { useState, useRef, useEffect } from 'react';
import { UserButton, useUser, useClerk } from '@clerk/react';
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  Sliders,
  HelpCircle,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  UploadCloud,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

export default function Sidebar({
  user,
  documents = [],
  activeDocumentId = null,
  onOpenDocs,
  onOpenAuth,
  onLogout,
  onSelectDocument,
  onUploadFile,
  onDeleteDocument,
  isUploadingDoc = false,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) {
  const { isSignedIn, user: clerkUser } = useUser();
  const { openSignIn, openSignUp } = useClerk();
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [isDraggingOverDocs, setIsDraggingOverDocs] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut ⌘K / Ctrl+K for new chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onNewChat) onNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewChat]);

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveRename = (e, id) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setMenuOpenId(null);
    onDeleteConversation(id);
  };

  // Drag & drop PDF
  const handleDocDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverDocs(true);
  };

  const handleDocDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverDocs(false);
  };

  const handleDocDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverDocs(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (onUploadFile) onUploadFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (onUploadFile) onUploadFile(file);
      e.target.value = '';
    }
  };

  const userName = clerkUser?.fullName || clerkUser?.firstName || user?.name || 'Afzal Ahmed';
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || user?.email || 'afzal4jaipur@gmail.com';
  const truncatedEmail = userEmail.length > 15 ? userEmail.slice(0, 13) + '..' : userEmail;

  return (
    <aside
      className={`gemini-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
      aria-label="Sidebar navigation"
    >
      {/* Top Header / Collapse row */}
      <div className="sidebar-header-row">
        <button
          type="button"
          className="gemini-icon-btn sidebar-collapse-trigger"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {isMobileOpen && (
          <button
            type="button"
            className="gemini-icon-btn mobile-close-trigger"
            onClick={onCloseMobile}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* New Chat Button with ⌘K shortcut */}
      <div className="sidebar-new-chat-wrap">
        <button
          type="button"
          className="gemini-new-chat-btn"
          onClick={onNewChat}
          title="New conversation (⌘K)"
        >
          <div className="new-chat-left">
            <Plus size={16} className="new-chat-plus-icon" />
            {!isCollapsed && <span>New chat</span>}
          </div>
          {!isCollapsed && (
            <kbd className="new-chat-shortcut-badge" title="Keyboard shortcut: ⌘K or Ctrl+K">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {/* Hidden file input for document uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Scrollable Center */}
      <div className="sidebar-scrollable-area">
        {/* RECENT THREADS SECTION */}
        <div className="sidebar-section">
          {!isCollapsed && (
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">RECENT THREADS</span>
              <span className="sidebar-count-pill">{conversations.length}</span>
            </div>
          )}

          <div className="sidebar-chat-list">
            {conversations.length === 0 ? (
              !isCollapsed && (
                <div className="sidebar-empty-note">
                  <p>No previous conversations</p>
                  <span>Start a conversation to build your personal history.</span>
                </div>
              )
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isEditing = editingId === conv.id;
                const isMenuOpen = menuOpenId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`gemini-chat-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed-item' : ''}`}
                    onClick={() => !isEditing && onSelectConversation(conv.id)}
                    title={conv.title}
                  >
                    <MessageSquare size={15} className="chat-item-icon" />

                    {!isCollapsed && (
                      <>
                        {isEditing ? (
                          <div className="chat-inline-rename-wrap" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              className="chat-rename-input"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(e, conv.id);
                                if (e.key === 'Escape') handleCancelRename(e);
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="rename-action-btn check"
                              onClick={(e) => handleSaveRename(e, conv.id)}
                              title="Save"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              className="rename-action-btn cancel"
                              onClick={handleCancelRename}
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="chat-item-title">{conv.title}</span>

                            {/* Active Cyan Dot Indicator */}
                            {isActive && <span className="active-thread-cyan-dot" />}

                            {/* 3-Dots Action Menu */}
                            <div className="chat-item-menu-wrap" ref={isMenuOpen ? menuRef : null}>
                              <button
                                type="button"
                                className="chat-item-more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId((prev) => (prev === conv.id ? null : conv.id));
                                }}
                                title="Options"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {isMenuOpen && (
                                <div className="chat-item-dropdown" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="dropdown-menu-item"
                                    onClick={(e) => handleStartRename(e, conv)}
                                  >
                                    <Edit2 size={13} />
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="dropdown-menu-item delete"
                                    onClick={(e) => handleDelete(e, conv.id)}
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DOCUMENT LIBRARY SECTION */}
        <div
          className={`sidebar-section document-library-section ${isDraggingOverDocs ? 'dragging-over' : ''}`}
          onDragOver={handleDocDragOver}
          onDragLeave={handleDocDragLeave}
          onDrop={handleDocDrop}
        >
          {!isCollapsed && (
            <div className="sidebar-section-header document-library-header">
              <span className="sidebar-section-title">DOCUMENT LIBRARY</span>
              <div className="doc-header-right">
                <span className="sidebar-count-pill">{documents.length}</span>
                <button
                  type="button"
                  className="sidebar-compact-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload PDF document to library"
                  aria-label="Upload PDF"
                  disabled={isUploadingDoc}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {isUploadingDoc && !isCollapsed && (
            <div className="sidebar-uploading-indicator">
              <span className="pulsing-spinner"></span>
              <span>Indexing PDF...</span>
            </div>
          )}

          <div className="sidebar-doc-list">
            {documents.length === 0 ? (
              !isCollapsed && (
                <div
                  className="sidebar-doc-drop-hint"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click or drop a PDF here"
                >
                  <p>No uploaded documents</p>
                  <span className="drop-hint-sub">Upload a PDF to ground your conversations with personal files.</span>
                </div>
              )
            ) : (
              documents.map((doc) => {
                const docId = doc._id || doc.id;
                const isSelected = activeDocumentId === docId;

                return (
                  <div
                    key={docId}
                    className={`gemini-doc-item ${isSelected ? 'active-grounded' : ''} ${isCollapsed ? 'collapsed-item' : ''}`}
                    onClick={() => onSelectDocument && onSelectDocument(doc)}
                    title={`"${doc.originalName}" • Available to AI`}
                  >
                    <span className="doc-pdf-badge">PDF</span>

                    {!isCollapsed && (
                      <>
                        <div className="doc-item-info">
                          <span className="doc-item-title">{doc.originalName}</span>
                          <span className="doc-item-status">
                            <span className="doc-status-dot" /> Available to AI
                          </span>
                        </div>
                        <ChevronRight size={14} className="doc-item-arrow" />
                      </>
                    )}
                  </div>
                );
              })
            )}

            {!isCollapsed && documents.length > 0 && (
              <button
                type="button"
                className="sidebar-view-more-docs"
                onClick={onOpenDocs}
                title="Manage all uploaded documents"
              >
                <span>Manage Library ({documents.length})</span>
                <ArrowRight size={13} className="manage-arrow-icon" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Personal Workspace Status & User Profile */}
      <div className="sidebar-footer">
        {!isCollapsed && (
          <div className="workspace-status-card">
            <div className="workspace-status-header">
              <span className="workspace-status-title">Personal AI Workspace</span>
              <span className="workspace-status-badge">Private</span>
            </div>
            <p className="workspace-status-meta">
              {documents.length} document{documents.length === 1 ? '' : 's'} indexed & available to AI
            </p>
          </div>
        )}

        {/* User Account / Profile Card */}
        <div className="sidebar-user-footer">
          {!isSignedIn ? (
            <div className="sidebar-auth-pill-group">
              <button
                type="button"
                className="sidebar-sign-in-pill"
                onClick={() => (openSignIn ? openSignIn() : onOpenAuth && onOpenAuth())}
                title="Sign In"
                aria-label="Sign In"
              >
                <LogIn size={15} />
                {!isCollapsed && <span>Sign In</span>}
              </button>

              {!isCollapsed && (
                <button
                  type="button"
                  className="sidebar-sign-up-pill"
                  onClick={() => (openSignUp ? openSignUp() : onOpenAuth && onOpenAuth())}
                  title="Create a free account"
                  aria-label="Sign Up"
                >
                  <UserPlus size={14} />
                  <span>Sign Up</span>
                </button>
              )}
            </div>
          ) : (
            <div className="sidebar-user-card" onClick={onOpenSettings} title="Account options">
              <div className="sidebar-avatar-with-badge">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'sidebar-clerk-avatar'
                    }
                  }}
                />
                <span className="avatar-online-badge" />
              </div>
              {!isCollapsed && (
                <>
                  <div className="sidebar-user-info">
                    <span className="sidebar-user-name">{userName}</span>
                    <span className="sidebar-user-email">{truncatedEmail}</span>
                  </div>
                  <button type="button" className="sidebar-user-more-btn" title="Options">
                    <MoreVertical size={16} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
