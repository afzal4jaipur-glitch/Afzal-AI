import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, Sparkles, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import GeminiIcon from './GeminiIcon';

const API_BASE = 'http://localhost:5000/api/auth';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const googleBtnContainerRef = useRef(null);

  // Fetch Google Client ID securely from backend configuration (never hardcoded in frontend source)
  useEffect(() => {
    let isMounted = true;
    async function fetchGoogleConfig() {
      try {
        const res = await fetch(`${API_BASE}/google/config`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.clientId) {
            setGoogleClientId(data.clientId);
          }
        }
      } catch (e) {
        console.warn('[AuthModal] Failed to fetch Google auth config:', e.message);
      }
    }
    if (isOpen) {
      fetchGoogleConfig();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle Google OpenID Connect Credential response
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      setError('No credential received from Google.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGoogleNotice('');

    try {
      const res = await fetch(`${API_BASE}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed.');
      }

      // Save token and user details (including Google name and avatar)
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      onSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize official Google Identity Services button when clientId is available
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (window.google?.accounts?.id && googleClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 340
            });
          }
        } catch (err) {
          console.warn('[AuthModal] Google button init notice:', err);
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, googleClientId]);

  if (!isOpen) return null;

  const handleCustomGoogleClick = () => {
    setError(null);
    if (!googleClientId) {
      setGoogleNotice(
        'Google Client ID is not configured yet. To enable, add your GOOGLE_CLIENT_ID to backend/.env (see backend/.env.example).'
      );
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In library is loading. Please try again in a moment.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGoogleNotice('');
    setIsLoading(true);

    const endpoint = isLogin ? `${API_BASE}/login` : `${API_BASE}/register`;
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      // Save token and user in localStorage
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      onSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="auth-header">
          <div className="auth-icon-badge">
            <GeminiIcon size={28} />
          </div>
          <h2>{isLogin ? "Sign in to Gemini" : 'Create your Gemini Account'}</h2>
          <p>
            {isLogin
              ? 'Sign in to access your private PDF library and synced conversation history'
              : 'Join to upload custom PDFs and ground Gemini responses with your documents'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError(null);
              setGoogleNotice('');
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError(null);
              setGoogleNotice('');
            }}
          >
            <UserPlus size={15} />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="auth-error-banner">
            <span>{error}</span>
          </div>
        )}

        {googleNotice && (
          <div className="auth-info-banner">
            <AlertCircle size={16} />
            <span>{googleNotice}</span>
          </div>
        )}

        {/* Google Sign-In Area */}
        <div className="auth-google-section">
          {googleClientId ? (
            <div className="google-btn-wrapper" ref={googleBtnContainerRef}></div>
          ) : (
            <button
              type="button"
              id="btn-google-signin"
              className="google-signin-btn"
              onClick={handleCustomGoogleClick}
              disabled={isLoading}
              title="Continue with Google"
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          )}

          <div className="auth-divider">
            <span className="auth-divider-line"></span>
            <span className="auth-divider-text">or continue with email</span>
            <span className="auth-divider-line"></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="auth-name">Full Name</label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="auth-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner">Processing...</span>
            ) : isLogin ? (
              <>
                <LogIn size={16} />
                <span>Sign In</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Create Free Account</span>
              </>
            )}
          </button>
        </form>

        {/* Clear visual guest info note */}
        <div className="auth-guest-notice">
          <p>
            💡 <strong>Guest mode:</strong> You can continue asking questions without signing in. Sign in only if you wish to upload private PDFs and save chat history.
          </p>
        </div>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account yet?" : 'Already have an account?'}{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setGoogleNotice('');
              }}
            >
              {isLogin ? 'Sign up here' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
