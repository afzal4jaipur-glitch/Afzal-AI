// Centralized API configuration supporting both local development and production deployments
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

export const API_BASE_URL = `${BACKEND_URL}/api/chat`;
export const HISTORY_URL = `${BACKEND_URL}/api/history`;
export const DOCS_URL = `${BACKEND_URL}/api/documents`;
export const AUTH_URL = `${BACKEND_URL}/api/auth`;
