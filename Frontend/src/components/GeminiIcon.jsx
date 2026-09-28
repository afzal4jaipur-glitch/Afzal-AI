import React from 'react';

/**
 * Authentic Google Gemini 4-pointed Sparkle Star Icon
 * Uses the official 4-stop Google Gemini color gradient:
 * #4285F4 (Google Blue) -> #9B72CF (Gemini Purple) -> #D96570 (Coral Pink) -> #1A73E8 (Deep Blue)
 */
export default function GeminiIcon({ size = 24, className = '', animated = false }) {
  const gradId = `gemini-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`gemini-sparkle-icon ${animated ? 'gemini-sparkle-animated' : ''} ${className}`}
      style={{ minWidth: size, minHeight: size }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B72CF" />
          <stop offset="70%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#1A73E8" />
        </linearGradient>
      </defs>
      <path
        d="M14 0C14 7.73199 7.73199 14 0 14C7.73199 14 14 20.268 14 28C14 20.268 20.268 14 28 14C20.268 14 14 7.73199 14 0Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
}
