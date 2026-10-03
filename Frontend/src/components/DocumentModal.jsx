import React, { useState, useRef } from 'react';
import { useAuth, useClerk } from '@clerk/react';
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  MessageSquare
} from 'lucide-react';
import { DOCS_URL as API_DOCS, BACKEND_URL } from '../config/api';

export default function DocumentModal({
  isOpen,
  onClose,
  documents = [],
  onDocumentsChange,
  token,
  user,
  onOpenAuth,
  onSelectDocumentForChat
}) {
  const { isSignedIn, getToken } = useAuth();
  const { openSignIn } = useClerk();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Only PDF documents are supported. Please upload a .pdf file.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds the 25MB limit.');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadStatus('Reading PDF & extracting text...');

    try {
      const activeToken = isSignedIn ? await getToken() : null;
      let guestId = null;
      if (!isSignedIn) {
        guestId = localStorage.getItem('guest_user_id');
        if (!guestId) {
          guestId = 'guest_' + Math.random().toString(36).substring(2, 10);
          localStorage.setItem('guest_user_id', guestId);
        }
      }

      const formData = new FormData();
      formData.append('file', file);

      setTimeout(() => {
        setUploadStatus('Generating 768-dim Gemini embeddings & indexing in Pinecone...');
      }, 1200);

      let res;
      try {
        res = await fetch(`${API_DOCS}/upload`, {
          method: 'POST',
          headers: {
            ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
            ...(guestId ? { 'x-guest-id': guestId } : {})
          },
          body: formData
        });
      } catch (fetchErr) {
        throw new Error(`Backend server is not reachable at ${BACKEND_URL}. Please ensure the backend is running.`);
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        // response was not JSON
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to upload document (status ${res.status}).`);
      }

      setUploadStatus('Done! Vector embeddings indexed successfully.');
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('');
        if (onDocumentsChange) onDocumentsChange();
      }, 800);
    } catch (err) {
      setError(err.message);
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document and its vector embeddings?')) {
      return;
    }

    try {
      const activeToken = isSignedIn ? await getToken() : null;
      const guestId = !isSignedIn ? (localStorage.getItem('guest_user_id') || 'guest') : null;
      const res = await fetch(`${API_DOCS}/${docId}`, {
        method: 'DELETE',
        headers: {
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
          ...(guestId ? { 'x-guest-id': guestId } : {})
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete document.');
      }

      if (onDocumentsChange) onDocumentsChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card document-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="doc-modal-header">
          <div className="doc-icon-badge">
            <FileText size={24} className="glow-icon" />
          </div>
          <div>
            <h2>My Uploaded Documents (PDF)</h2>
            <p>
              Uploaded PDFs are vectorized and stored in your isolated Pinecone namespace.
              The AI answers questions citing your exact files!
            </p>
          </div>
        </div>

        {!isSignedIn && (
          <div className="doc-guest-banner">
            <Sparkles size={18} className="guest-sparkle" />
            <div className="doc-guest-banner-text">
              <span><strong>Guest Mode:</strong> Upload PDFs to query immediately in this session.</span>
              <button
                type="button"
                className="doc-guest-signin-btn"
                onClick={() => {
                  onClose();
                  if (openSignIn) openSignIn();
                }}
              >
                Sign In to save permanently
              </button>
            </div>
          </div>
        )}

        {/* Drag & Drop Uploader */}
        <div
          className={`dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                disabled={isUploading}
              />

              <div className="dropzone-content">
                <div className="upload-icon-circle">
                  <UploadCloud size={28} />
                </div>
                {isUploading ? (
                  <div className="upload-status-display">
                    <span className="pulsing-spinner"></span>
                    <p className="status-text">{uploadStatus}</p>
                  </div>
                ) : (
                  <>
                    <h4>Drop your PDF here, or <span className="browse-link">browse files</span></h4>
                    <p>Supports contracts, warranties, user manuals, and reports up to 15MB</p>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="auth-error-banner">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Document Library List */}
            <div className="doc-library-section">
              <div className="doc-section-title">
                <span>Your Indexed Documents</span>
                <span className="count-pill">{documents.length}</span>
              </div>

              {documents.length === 0 ? (
                <div className="empty-docs-state">
                  <FileText size={36} className="empty-icon" />
                  <p>No documents uploaded yet.</p>
                  <span>Upload a PDF above to ask the AI questions about your data!</span>
                </div>
              ) : (
                <div className="doc-grid">
                  {documents.map((doc) => (
                    <div key={doc._id || doc.id} className="doc-item-card">
                      <div className="doc-card-icon">
                        <FileText size={20} />
                      </div>
                      <div className="doc-card-info">
                        <h4 title={doc.originalName}>{doc.originalName}</h4>
                        <div className="doc-card-meta">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span className="chunk-badge">
                            <Layers size={11} /> {doc.chunkCount || 1} chunks
                          </span>
                          <span>•</span>
                          <span className="time-badge">
                            <Clock size={11} />{' '}
                            {new Date(doc.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="doc-card-actions">
                        <button
                          type="button"
                          className="chat-doc-btn"
                          title="Ask AI about this document"
                          onClick={() => {
                            if (onSelectDocumentForChat) {
                              onSelectDocumentForChat(doc.originalName);
                            }
                            onClose();
                          }}
                        >
                          <MessageSquare size={14} />
                          <span>Ask</span>
                        </button>
                        <button
                          type="button"
                          className="delete-doc-btn"
                          title="Delete document and vector embeddings"
                          onClick={() => handleDelete(doc._id || doc.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
      </div>
    </div>
  );
}
