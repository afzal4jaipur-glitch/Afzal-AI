// Centralized API configuration supporting both local development and production deployments
const normalizeBackendUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return import.meta.env.PROD ? 'https://afzal-ai-production.up.railway.app' : 'http://localhost:5000';
  }
  let cleaned = url.trim().replace(/^["']|["']$/g, '').trim();
  // Strip variable name if someone pasted "VITE_BACKEND_URL=..."
  if (cleaned.includes('=')) {
    cleaned = cleaned.split('=').pop().trim();
  }
  cleaned = cleaned.replace(/\/+$/, '');
  if (!cleaned) {
    return import.meta.env.PROD ? 'https://afzal-ai-production.up.railway.app' : 'http://localhost:5000';
  }
  // Ensure http:// or https:// protocol is present
  if (!/^https?:\/\//i.test(cleaned)) {
    if (cleaned.startsWith('localhost') || cleaned.startsWith('127.0.0.1')) {
      cleaned = `http://${cleaned}`;
    } else {
      cleaned = `https://${cleaned}`;
    }
  }
  return cleaned;
};

export const BACKEND_URL = normalizeBackendUrl(
  import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? 'https://afzal-ai-production.up.railway.app' : 'http://localhost:5000')
);

export const API_BASE_URL = `${BACKEND_URL}/api/chat`;
export const HISTORY_URL = `${BACKEND_URL}/api/history`;
export const DOCS_URL = `${BACKEND_URL}/api/documents`;
export const AUTH_URL = `${BACKEND_URL}/api/auth`;
export const CONVERSATIONS_URL = `${BACKEND_URL}/api/conversations`;

