import React from 'react';
import iconUrl from '../assets/icon.png';

/**
 * Afzal's AI Official Icon Component
 * Renders the clean AA emblem (transparent background) as an inline icon next to text
 */
export default function AppLogo({
  size = 28,
  className = '',
  alt = "Afzal's AI Logo"
}) {
  return (
    <span
      className={`afzal-brand-icon-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: size,
        maxHeight: size,
        flexShrink: 0
      }}
      aria-label={alt}
    >
      <img
        src={iconUrl}
        alt={alt}
        className="afzal-brand-icon-img"
        style={{
          height: size,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </span>
  );
}
