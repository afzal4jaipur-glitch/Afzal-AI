import React, { useState, useEffect, useMemo } from 'react';
import { useClerk } from '@clerk/react';

const RUNNING_PROMPTS = [
  "What are we working on today?",
  "How can I help you today?",
  "Ask a question, research a topic, or analyze a PDF.",
  "Help me draft, summarize, or explore ideas."
];

export default function GeminiWelcome({ user = null }) {
  const { openSignIn } = useClerk();
  // Device/browser local time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hour >= 17 || hour < 5) {
      timeGreeting = 'Good evening';
    }

    const firstName = user?.firstName || (user?.name ? user.name.trim().split(/\s+/)[0] : '');
    return firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  }, [user]);

  // Running text animation for "What are we working on today?" and similar prompts
  const [displayText, setDisplayText] = useState(RUNNING_PROMPTS[0]);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(RUNNING_PROMPTS[0].length);

  useEffect(() => {
    const currentPhrase = RUNNING_PROMPTS[phraseIndex];
    let timer;

    if (!isDeleting && charIndex < currentPhrase.length) {
      // Typing forward
      timer = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
        setDisplayText(currentPhrase.substring(0, charIndex + 1));
      }, 55);
    } else if (!isDeleting && charIndex === currentPhrase.length) {
      // Pause at end of phrase
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 3500);
    } else if (isDeleting && charIndex > 0) {
      // Deleting backwards
      timer = setTimeout(() => {
        setCharIndex((prev) => prev - 1);
        setDisplayText(currentPhrase.substring(0, charIndex - 1));
      }, 30);
    } else if (isDeleting && charIndex === 0) {
      // Move to next phrase
      setIsDeleting(false);
      setPhraseIndex((prev) => (prev + 1) % RUNNING_PROMPTS.length);
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, phraseIndex]);

  return (
    <div className="home-welcome-header" id="home-welcome">
      <h1 className="home-greeting-title">
        {greeting}
      </h1>
      <p className="home-running-subtitle" aria-live="polite">
        <span className="running-text-content">{displayText}</span>
        <span className="running-cursor" aria-hidden="true" />
      </p>

      {!user && (
        <div className="home-guest-auth-hint">
          <span className="guest-hint-dot" />
          <span className="guest-hint-text">
            Guest session active. You can chat & upload PDFs freely.
          </span>
          <button
            type="button"
            className="guest-hint-signin-btn"
            onClick={() => (openSignIn ? openSignIn() : null)}
          >
            Sign In / Sign Up
          </button>
        </div>
      )}
    </div>
  );
}
