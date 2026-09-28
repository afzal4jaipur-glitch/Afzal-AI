import React, { useState, useRef, useEffect } from 'react';
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  FileText,
  Sliders,
  HelpCircle,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  UploadCloud,
  Layers,
  ChevronRight
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
  // Chat History Props
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  // Settings & Collapse Props
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) {
  const { user: clerkUser } = useUser();
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

  // Drag and drop PDF handlers for the Document Library section
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
      if (onUploadFile) {
        onUploadFile(file);
      }
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (onUploadFile) {
        onUploadFile(file);
      }
      e.target.value = '';
    }
  };

  return (
    <aside
      className={`gemini-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
      aria-label="Gemini navigation sidebar"
    >
      {/* Top Header / Actions */}
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

      {/* New Chat Pill Button */}
      <div className="sidebar-new-chat-wrap">
        <button
          type="button"
          className="gemini-new-chat-btn"
          onClick={onNewChat}
          title="New conversation"
        >
          <Plus size={18} />
          {!isCollapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Hidden file input for compact sidebar upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* Scrollable Center: Recent Chats & Unified Document Library */}
      <div className="sidebar-scrollable-area">
        {/* Recent Chats Section */}
        <div className="sidebar-section">
          {!isCollapsed && (
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">Recent</span>
              {conversations.length > 0 && (
                <span className="sidebar-item-count">{conversations.length}</span>
              )}
            </div>
          )}

          <div className="sidebar-chat-list">
            {conversations.length === 0 ? (
              !isCollapsed && (
                <div className="sidebar-empty-note">
                  <p>No recent chats</p>
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
                    <MessageSquare size={16} className="chat-item-icon" />

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

        {/* 1. Unified Navigation and Repository Architecture: Document Library */}
        <div
          className={`sidebar-section document-library-section ${isDraggingOverDocs ? 'dragging-over' : ''}`}
          onDragOver={handleDocDragOver}
          onDragLeave={handleDocDragLeave}
          onDrop={handleDocDrop}
        >
          {!isCollapsed && (
            <div className="sidebar-section-header document-library-header">
              <div className="section-title-wrap">
                <span className="sidebar-section-title">Document Library</span>
                {documents.length > 0 && (
                  <span className="sidebar-item-count">{documents.length}</span>
                )}
              </div>

              {/* Embedded compact "+" upload icon */}
              <div className="section-header-actions">
                <button
                  type="button"
                  className="sidebar-compact-upload-btn"
                  onClick={() => {
                    if (!user && onOpenAuth) {
                      onOpenAuth();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  title="Upload PDF document to library"
                  aria-label="Upload PDF"
                  disabled={isUploadingDoc}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Compact drag-and-drop zone directly embedded inside the Document Library header */}
          {!isCollapsed && isDraggingOverDocs && (
            <div className="sidebar-drag-drop-zone active">
              <UploadCloud size={16} />
              <span>Drop PDF here to index</span>
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
                  onClick={() => {
                    if (!user && onOpenAuth) {
                      onOpenAuth();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  title="Click or drop a PDF here"
                >
                  <p>No documents yet</p>
                  <span className="drop-hint-sub">Drop PDF here or click + to upload</span>
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
                    title={`Open "${doc.originalName}" in Research & Synthesis`}
                  >
                    <FileText size={15} className="doc-item-icon" />

                    {!isCollapsed && (
                      <>
                        <span className="doc-item-title">{doc.originalName}</span>
                        <ChevronRight size={13} className="doc-item-arrow" />
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
                Manage Library ({documents.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Pinned Gemini Actions (Cleaned up: removed promotional card and redundant Document Vault) */}
      <div className="sidebar-footer">
        {/* Action items */}
        <div className="sidebar-utility-list">
          <button
            type="button"
            className="sidebar-util-btn"
            onClick={onOpenSettings}
            title="Settings & Font Preferences"
          >
            <Sliders size={16} />
            {!isCollapsed && <span>Settings</span>}
          </button>

          <button
            type="button"
            className="sidebar-util-btn"
            onClick={() => window.open('https://gemini.google.com/faq', '_blank')}
            title="Help and FAQs"
          >
            <HelpCircle size={16} />
            {!isCollapsed && <span>Help & FAQ</span>}
          </button>
        </div>

        {/* Location & IP Footer */}
        {!isCollapsed && (
          <div className="sidebar-location-footer">
            <div className="location-dot" />
            <span className="location-text">Based on your IP location</span>
          </div>
        )}

        {/* User Account / Profile */}
        <div className="sidebar-user-footer">
          <Show when="signed-out">
            <div className="sidebar-auth-pill-group">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="sidebar-sign-in-pill"
                  title="Sign In with Clerk"
                >
                  <LogIn size={15} />
                  {!isCollapsed && <span>Sign In</span>}
                </button>
              </SignInButton>
              {!isCollapsed && (
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="sidebar-sign-up-pill"
                    title="Sign Up with Clerk"
                  >
                    <UserPlus size={15} />
                    <span>Sign Up</span>
                  </button>
                </SignUpButton>
              )}
            </div>
          </Show>

          <Show when="signed-in">
            <div className="sidebar-user-card">
              <div className="sidebar-user-avatar-wrap">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'sidebar-clerk-avatar'
                    }
                  }}
                />
              </div>
              {!isCollapsed && (
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">
                    {clerkUser?.fullName || clerkUser?.firstName || user?.name || 'Account'}
                  </span>
                  <span className="sidebar-user-email">
                    {clerkUser?.primaryEmailAddress?.emailAddress || user?.email || ''}
                  </span>
                </div>
              )}
            </div>
          </Show>
        </div>
      </div>
    </aside>
  );
}
