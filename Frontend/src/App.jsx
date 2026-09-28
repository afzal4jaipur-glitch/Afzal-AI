import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/react';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import QuickPrompts from './components/QuickPrompts';
import ChatInput from './components/ChatInput';
import Sidebar from './components/Sidebar';
import DocumentViewer from './components/DocumentViewer';
import DocumentModal from './components/DocumentModal';
import SettingsModal from './components/SettingsModal';
import { FONTS } from './constants/fonts';

const API_BASE_URL = 'http://localhost:5000/api/chat';
const HISTORY_URL = 'http://localhost:5000/api/history';
const DOCS_URL = 'http://localhost:5000/api/documents';

const CONVERSATIONS_KEY = 'gemini_conversations';
const ACTIVE_CONV_KEY = 'gemini_active_conv_id';
const FONT_STORAGE_KEY = 'gemini_font';
const FONT_SIZE_STORAGE_KEY = 'gemini_font_size';

const INITIAL_GREETING = {
  id: 1,
  role: 'assistant',
  text: "Hello! How can I help you today?",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  model: "Afzal's AI",
  source: 'system'
};

const createDefaultConversation = () => ({
  id: 'conv_' + Date.now(),
  title: 'New chat',
  messages: [INITIAL_GREETING],
  createdAt: Date.now(),
  updatedAt: Date.now()
});

export default function App() {
  // 1. Conversations & Chat History State
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY) || localStorage.getItem('afzal_ai_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved conversations', e);
    }
    return [createDefaultConversation()];
  });

  const [activeConversationId, setActiveConversationId] = useState(() => {
    try {
      const savedActive = localStorage.getItem(ACTIVE_CONV_KEY) || localStorage.getItem('afzal_ai_active_conv_id');
      if (savedActive) return savedActive;
    } catch {
      // ignore
    }
    try {
      const saved = localStorage.getItem(CONVERSATIONS_KEY) || localStorage.getItem('afzal_ai_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed[0].id;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Persist conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
      if (activeConversationId) {
        localStorage.setItem(ACTIVE_CONV_KEY, activeConversationId);
      }
    } catch (e) {
      console.warn('Could not save conversations to localStorage', e);
    }
  }, [conversations, activeConversationId]);

  // Active conversation helper
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) || conversations[0] || createDefaultConversation();
  }, [conversations, activeConversationId]);

  const messages = activeConversation.messages || [INITIAL_GREETING];
  const userMessageCount = useMemo(() => {
    return messages.filter((m) => m.role === 'user').length;
  }, [messages]);

  // 2. Dual-Mode Central Workspace State ('chat' | 'research')
  const [workspaceMode, setWorkspaceMode] = useState('chat');
  const [activeDocument, setActiveDocument] = useState(null);

  // 4. Model Selector & Tier Management State ('flash' | 'pro' | 'ultra')
  const [modelTier, setModelTier] = useState('flash');

  // Chat Input & API Request State
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto' | 'research' | 'support'
  const [prefilledInput, setPrefilledInput] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // 3. Theme State (Dark / Light) - Default to authentic Gemini Dark
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Typography & Font Size State
  const [font, setFont] = useState(() => {
    return localStorage.getItem(FONT_STORAGE_KEY) || 'Outfit';
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || 'medium';
  });

  useEffect(() => {
    const selectedFontObj = FONTS.find((f) => f.id === font);
    const fontFamily = selectedFontObj ? selectedFontObj.family : "'Outfit', 'Inter', sans-serif";
    document.documentElement.style.setProperty('--font-body', fontFamily);
    localStorage.setItem(FONT_STORAGE_KEY, font);
  }, [font]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
  }, [fontSize]);

  // Sidebar Collapsible & Mobile Drawer State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 860) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      toggleSidebarCollapse();
    }
  };

  // Modals State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Clerk Authentication State
  const { isSignedIn, user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();
  const { openSignIn, signOut } = useClerk();
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => setAuthToken(token)).catch(() => {});
    } else {
      setAuthToken(null);
    }
  }, [isSignedIn, getToken]);

  const user = useMemo(() => {
    if (!isSignedIn || !clerkUser) return null;
    return {
      id: clerkUser.id,
      userId: clerkUser.id,
      name: clerkUser.fullName || clerkUser.firstName || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      avatar: clerkUser.imageUrl || ''
    };
  }, [isSignedIn, clerkUser]);

  // Documents State
  const [documents, setDocuments] = useState([]);

  // Load chat history for backend sync if supported
  const loadHistory = useCallback(async () => {
    try {
      const headers = {};
      if (isSignedIn) {
        const activeToken = await getToken();
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }
      }
      const res = await fetch(HISTORY_URL, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setConversations((prev) => {
            const currentActiveId = activeConversationId || (prev[0] && prev[0].id);
            return prev.map((c) => (c.id === currentActiveId ? { ...c, messages: data.messages } : c));
          });
        }
      }
    } catch (err) {
      console.warn('[App] Could not load past history from server:', err.message);
    }
  }, [activeConversationId, isSignedIn, getToken]);

  // Load user's uploaded documents
  const loadDocuments = useCallback(async () => {
    if (!isSignedIn) {
      setDocuments([]);
      return;
    }
    try {
      const activeToken = await getToken();
      const res = await fetch(DOCS_URL, {
        headers: {
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.warn('[App] Could not load documents:', err.message);
    }
  }, [isSignedIn, getToken]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setDocuments([]);
    setActiveDocument(null);
    setWorkspaceMode('chat');
  }, [signOut]);

  const handleOpenAuth = useCallback(() => {
    openSignIn();
  }, [openSignIn]);

  // Load user documents & chat history whenever auth changes
  useEffect(() => {
    if (!isUserLoaded) return;
    loadDocuments();
    loadHistory();
  }, [isSignedIn, isUserLoaded, loadDocuments, loadHistory]);

  // Conversational Management Handlers
  const handleNewChat = () => {
    const newConv = createDefaultConversation();
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setIsMobileSidebarOpen(false);
  };

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setIsMobileSidebarOpen(false);
  };

  const handleRenameConversation = (id, newTitle) => {
    if (!newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim(), updatedAt: Date.now() } : c))
    );
  };

  const handleDeleteConversation = (id) => {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createDefaultConversation();
        setActiveConversationId(fresh.id);
        return [fresh];
      }
      if (activeConversationId === id) {
        setActiveConversationId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleClearAllConversations = () => {
    const fresh = createDefaultConversation();
    setConversations([fresh]);
    setActiveConversationId(fresh.id);
  };

  // Helper to append message to active conversation
  const appendMessageToActiveConv = (message, shouldAutoTitle = false) => {
    setConversations((prev) => {
      return prev.map((conv) => {
        if (conv.id !== activeConversationId) return conv;
        let newTitle = conv.title;
        // Auto-generate title from first user query if still named "New chat"
        if (shouldAutoTitle && (conv.title === 'New chat' || conv.title === 'New Chat' || !conv.title)) {
          const cleanText = message.text.replace(/^[#\s?!*]+/, '').trim();
          newTitle = cleanText.length > 28 ? cleanText.substring(0, 28) + '...' : cleanText;
        }
        return {
          ...conv,
          title: newTitle,
          messages: [...(conv.messages || []), message],
          updatedAt: Date.now()
        };
      });
    });
  };

  // Send message handler
  const handleSendMessage = async (text) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setPrefilledInput('');

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text,
      time: timestamp
    };

    appendMessageToActiveConv(userMsg, true);
    setIsLoading(true);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (isSignedIn) {
        const activeToken = await getToken();
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }
      }

      // If document is actively grounded or in research mode, enforce support/grounded mode
      const effectiveMode = activeDocument || workspaceMode === 'research' ? 'support' : mode;

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          mode: effectiveMode,
          userId: user?.id || 'guest',
          modelTier,
          documentId: activeDocument?._id || activeDocument?.id || undefined,
          documentName: activeDocument?.originalName || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data.reply || "Sorry, I received an empty response from the server.",
        time: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || (modelTier === 'pro' ? "Afzal's AI Pro" : modelTier === 'ultra' ? "Afzal's AI Ultra" : "Afzal's AI Flash"),
        source: data.source,
        sources: data.sources || [],
        contextMatched: data.contextMatched,
        isResearch: data.isResearch
      };

      appendMessageToActiveConv(assistantMsg);
    } catch (error) {
      console.warn('Backend API error:', error);
      const fallbackMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: `⚠️ Could not reach server at ${API_BASE_URL}. Ensure the backend is running. (${error.message})`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      appendMessageToActiveConv(fallbackMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear current active conversation's messages
  const handleClearChat = async () => {
    try {
      const headers = {};
      if (isSignedIn) {
        const activeToken = await getToken();
        if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;
      }
      await fetch(HISTORY_URL, { method: 'DELETE', headers });
    } catch (err) {
      console.warn('Could not clear history:', err.message);
    }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversationId) return c;
        return {
          ...c,
          title: 'New chat',
          messages: [
            {
              id: Date.now(),
              role: 'assistant',
              text: "Hello! How can I help you today?",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              model: "Afzal's AI"
            }
          ]
        };
      })
    );
  };

  // 1 & 2. Workflow routing: Selecting an uploaded document opens the split-pane layout
  const handleSelectDocumentForResearch = (doc) => {
    setActiveDocument(doc);
    setWorkspaceMode('research');
    setMode('support');
    setIsMobileSidebarOpen(false);
  };

  // 5. Direct PDF drag-and-drop / upload into query bar or sidebar
  const handleDirectPdfUpload = async (file) => {
    if (!isSignedIn) {
      handleOpenAuth();
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Only PDF documents are supported.');
      return;
    }

    setIsUploadingDoc(true);
    try {
      const activeToken = await getToken();
      const formData = new FormData();
      formData.append('file', file);

      let res;
      try {
        res = await fetch(`${DOCS_URL}/upload`, {
          method: 'POST',
          headers: {
            ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
          },
          body: formData
        });
      } catch (fetchErr) {
        throw new Error('Backend server is not reachable on port 5000. Please ensure the backend server is running.');
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        // response was not JSON
      }

      if (!res.ok) {
        throw new Error(data.error || `Upload failed with status ${res.status}`);
      }

      await loadDocuments();
      const uploadedDoc = data.document || {
        originalName: file.name,
        size: file.size,
        chunkCount: 1,
        id: 'temp_' + Date.now()
      };

      // Immediately invoke document-grounded mode & open split-pane
      setActiveDocument(uploadedDoc);
      setWorkspaceMode('research');
      setMode('support');

      const systemMsg = {
        id: Date.now(),
        role: 'assistant',
        text: `📄 **"${uploadedDoc.originalName}"** is now indexed and actively grounded! You can review its parsed text on the left, select any passage for instant AI synthesis, or ask questions in this chat.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: "Afzal's AI"
      };
      appendMessageToActiveConv(systemMsg);
    } catch (err) {
      console.error('Direct PDF upload failed:', err);
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  return (
    <div className="gemini-app-root">
      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="gemini-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. Unified Navigation and Repository Architecture: Sidebar */}
      <Sidebar
        user={user}
        documents={documents}
        activeDocumentId={activeDocument?._id || activeDocument?.id}
        onOpenDocs={() => setIsDocModalOpen(true)}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        onSelectDocument={handleSelectDocumentForResearch}
        onUploadFile={handleDirectPdfUpload}
        isUploadingDoc={isUploadingDoc}
        // Chat History Props
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        // Settings & Collapsible props
        onOpenSettings={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="gemini-main-viewport">
        {/* Gemini Top Navigation Bar */}
        <ChatHeader
          onClearChat={handleClearChat}
          messageCount={messages.length}
          // Workspace Mode Selector (Chat vs Research & Synthesis)
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={(newMode) => {
            setWorkspaceMode(newMode);
            if (newMode === 'research' && !activeDocument && documents.length > 0) {
              setActiveDocument(documents[0]);
              setMode('support');
            }
          }}
          activeDocument={activeDocument}
          // Unified Model Tier Selector ('flash', 'pro', 'ultra')
          modelTier={modelTier}
          onModelTierChange={setModelTier}
          user={user}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
          onToggleSidebar={handleToggleSidebar}
          onOpenSettings={() => setIsSettingsOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* 2. Central Workspace Switcher (Chat | Research & Synthesis | Artifacts) */}
        {workspaceMode === 'chat' ? (
          /* Conversational Querying Mode: Single-column chat view */
          <div className="gemini-conversational-workspace">
            <main className="gemini-chat-main-area">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                user={user}
                onSendMessage={handleSendMessage}
                onOpenDocs={() => setIsDocModalOpen(true)}
                onSwitchToResearch={handleSelectDocumentForResearch}
                documents={documents}
              />
            </main>

            {/* Bottom Floating Gemini Capsule & Quick Suggestions */}
            <footer className="gemini-footer-dock">
              {userMessageCount > 0 && (
                <QuickPrompts
                  onSelectPrompt={handleSendMessage}
                  disabled={isLoading}
                  currentMode={mode}
                />
              )}

              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                prefilledText={prefilledInput}
                onOpenDocs={() => setIsDocModalOpen(true)}
                currentMode={mode}
                onModeChange={setMode}
                activeDocument={activeDocument}
                onClearActiveDocument={() => setActiveDocument(null)}
                onDropFile={handleDirectPdfUpload}
                workspaceMode={workspaceMode}
              />
            </footer>
          </div>
        ) : workspaceMode === 'research' ? (
          /* Document Research Mode: Split-pane layout */
          <div className="gemini-split-workspace">
            {/* Left Pane: Document Viewer with active text-selection tools */}
            <DocumentViewer
              document={activeDocument}
              documents={documents}
              onSelectDocument={(doc) => {
                setActiveDocument(doc);
                setMode('support');
              }}
              onAskAboutExcerpt={(prompt) => {
                setPrefilledInput(prompt);
              }}
              onAutoPrompt={(prompt) => {
                handleSendMessage(prompt);
              }}
              onUploadFile={handleDirectPdfUpload}
              isUploading={isUploadingDoc}
              onClose={() => setWorkspaceMode('chat')}
              token={authToken}
              isSignedIn={isSignedIn}
            />

            {/* Right Pane: Contextual Grounding Chat */}
            <div className="gemini-grounded-chat-pane">
              <div className="grounded-chat-header">
                <div className="grounded-chat-badge">
                  <span className="grounded-pulse-dot" />
                  <span>
                    {activeDocument
                      ? `Grounded: ${activeDocument.originalName}`
                      : 'Contextual Document Chat'}
                  </span>
                </div>

                {activeDocument && (
                  <button
                    type="button"
                    className="unground-btn"
                    onClick={() => setActiveDocument(null)}
                    title="Unground document"
                  >
                    Unground
                  </button>
                )}
              </div>

              <div className="grounded-chat-messages">
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  user={user}
                  onSendMessage={handleSendMessage}
                  onOpenDocs={() => setIsDocModalOpen(true)}
                  onSwitchToResearch={handleSelectDocumentForResearch}
                  documents={documents}
                />
              </div>

              <div className="grounded-chat-footer">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  prefilledText={prefilledInput}
                  onOpenDocs={() => setIsDocModalOpen(true)}
                  currentMode={mode}
                  onModeChange={setMode}
                  activeDocument={activeDocument}
                  onClearActiveDocument={() => setActiveDocument(null)}
                  onDropFile={handleDirectPdfUpload}
                  workspaceMode={workspaceMode}
                  placeholder={
                    activeDocument
                      ? `Ask anything about "${activeDocument.originalName}"...`
                      : 'Ask or synthesize from your documents...'
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          /* Artifacts Workspace View */
          <div className="gemini-artifacts-workspace">
            <div className="artifacts-container">
              <div className="artifacts-header">
                <div className="artifacts-title-wrap">
                  <h2 className="artifacts-main-title">Artifacts & Synthesized Documents</h2>
                  <p className="artifacts-subtitle">
                    Manage generated briefings, multi-chunk document extractions, and reusable components.
                  </p>
                </div>
              </div>

              <div className="artifacts-grid">
                {documents.length > 0 ? (
                  documents.map((doc) => (
                    <div
                      key={doc._id || doc.id}
                      className="artifact-card"
                      onClick={() => handleSelectDocumentForResearch(doc)}
                    >
                      <div className="artifact-card-top">
                        <span className="doc-pdf-badge">PDF</span>
                        <span className="artifact-date">
                          {new Date(doc.createdAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="artifact-title">{doc.originalName}</h4>
                      <p className="artifact-meta">
                        {doc.chunkCount || 50} indexed chunks • Multi-tenant namespace
                      </p>
                      <div className="artifact-footer">
                        <span className="artifact-action-text">Open in Research Pane →</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="artifacts-empty-state">
                    <p>No artifacts or indexed documents yet. Upload a PDF or run Deep Research to populate.</p>
                  </div>
                )}
              </div>
            </div>

            <footer className="gemini-footer-dock">
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                prefilledText={prefilledInput}
                onOpenDocs={() => setIsDocModalOpen(true)}
                currentMode={mode}
                onModeChange={setMode}
                activeDocument={activeDocument}
                onClearActiveDocument={() => setActiveDocument(null)}
                onDropFile={handleDirectPdfUpload}
                workspaceMode={workspaceMode}
                placeholder="Ask Afzal's AI to generate an artifact or synthesize documents..."
              />
            </footer>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        currentFont={font}
        onFontChange={setFont}
        currentFontSize={fontSize}
        onFontSizeChange={setFontSize}
        onClearAllConversations={handleClearAllConversations}
        conversationCount={conversations.length}
      />

      {/* Document Manager Modal */}
      <DocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        documents={documents}
        onDocumentsChange={loadDocuments}
        user={user}
        onOpenAuth={handleOpenAuth}
        onSelectDocumentForChat={(docName) => {
          const matched = documents.find((d) => d.originalName === docName);
          if (matched) {
            handleSelectDocumentForResearch(matched);
          } else {
            setPrefilledInput(`What are the key points in my document "${docName}"?`);
          }
        }}
      />
    </div>
  );
}
