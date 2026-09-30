import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

const PROMPTS_BY_MODE = {
  research: [
    "What's happening in the world today?",
    "Latest breakthroughs in AI this week",
    "What are the top tech trends in 2026?",
    "Recent news in renewable energy"
  ],
  support: [
    "Summarize the key takeaways from my uploaded PDF",
    "What are the main conclusions in the document?",
    "Extract action items and dates from the file",
    "Explain the methodology used in this document"
  ],
  auto: [
    "What is photosynthesis?",
    "What is RAG and how does it work?",
    "Give me five ideas for a Toastmasters speech",
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
