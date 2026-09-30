import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { dark } from '@clerk/themes';
import './index.css';
import App from './App.jsx';

// Read publishable key from environment or fallback to project default test key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_aHVtYW5lLWdhci0xOTQ1LmNsZXJrLmFjY291bnRzLmRldiQ';

function Root() {
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(currentTheme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const appearance = theme === 'dark'
    ? {
        baseTheme: dark,
        variables: {
          colorPrimary: '#00d2ff',
          colorBackground: '#0b0d13',
          colorInputBackground: '#10141d',
          colorInputText: '#f8fafc',
          colorText: '#f8fafc',
          colorTextSecondary: '#8895a7'
        }
      }
    : {
        variables: {
          colorPrimary: '#0284c7',
          colorBackground: '#ffffff',
          colorInputBackground: '#f1f5f9',
          colorInputText: '#0f172a',
          colorText: '#0f172a',
          colorTextSecondary: '#475569'
        }
      };

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={appearance}
    >
      <App />
    </ClerkProvider>
  );
}

if (!PUBLISHABLE_KEY) {
  createRoot(document.getElementById('root')).render(
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#131314',
      color: '#e3e3e3',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#ff6b6b' }}>Clerk Publishable Key Missing</h2>
      <p style={{ maxWidth: '500px', lineHeight: '1.6', color: '#9aa0a6' }}>
        Please add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your Netlify Environment Variables (Site configuration &gt; Environment variables) and trigger a redeploy.
      </p>
    </div>
  );
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}