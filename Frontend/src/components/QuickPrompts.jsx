import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const PROMPTS_BY_MODE = {
  research: [
    "Latest breakthroughs in AI this week",
    "What are the top tech trends in 2026?",
    "Recent news in renewable energy",
    "Compare Python vs JavaScript in 2026"
  ],
  support: [
    "What is the return and refund policy?",
    "How can I track my shipment?",
    "What are your customer support hours?",
    "What payment methods do you accept?"
  ],
  auto: [
    "How do I return a purchased item?",
    "Summarize my uploaded PDF document",
    "What are the latest AI news today?",
    "Explain quantum computing simply"
  ]
};

export default function QuickPrompts({ onSelectPrompt, disabled, currentMode = 'auto' }) {
  const prompts = PROMPTS_BY_MODE[currentMode] || PROMPTS_BY_MODE.auto;

  return (
    <div className="gemini-quick-prompts-bar">
      <div className="prompts-scroll-track">
        {prompts.map((question, index) => (
          <button
            key={index}
            id={`quick-prompt-${index}`}
            type="button"
            className="gemini-prompt-chip"
            onClick={() => onSelectPrompt(question)}
            disabled={disabled}
          >
            <Sparkles size={12} className="chip-sparkle" />
            <span>{question}</span>
            <ArrowRight size={11} className="chip-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
