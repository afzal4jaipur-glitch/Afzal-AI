import React from 'react';

/**
 * Afzal's AI Official Logo Emblem
 * Renders the sleek cyan rounded badge with bold dark "AA"
 */
export default function AppLogo({
  size = 28,
  className = '',
  alt = "Afzal's AI Logo"
}) {
  const borderRadius = Math.max(6, Math.round(size * 0.28));
  const fontSize = Math.round(size * 0.44);

  return (
    <span
      className={`afzal-brand-icon-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: `${borderRadius}px`,
        background: 'linear-gradient(135deg, #00d2ff 0%, #00f2fe 100%)',
        boxShadow: '0 2px 10px rgba(0, 210, 255, 0.35)',
        flexShrink: 0,
        userSelect: 'none'
      }}
      aria-label={alt}
      title={alt}
    >
      <span
        style={{
          fontFamily: "'Inter', 'Outfit', sans-serif",
          fontWeight: 900,
          fontSize: `${fontSize}px`,
          letterSpacing: '-0.06em',
          color: '#07131e',
          lineHeight: 1
        }}
      >
        AA
      </span>
    </span>
  );
}
