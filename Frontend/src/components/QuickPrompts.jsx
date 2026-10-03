import React from 'react';
import {
  Sparkles,
  FileText,
  Compass,
  PenLine,
  BookOpen
} from 'lucide-react';

export const COMPACT_PROMPTS = [
  {
    id: 'explain',
    label: 'Explain something',
    prompt: 'Explain quantum computing simply and clearly.',
    icon: Sparkles
  },
  {
    id: 'analyse',
    label: 'Analyse a document',
    prompt: 'Analyse the main points and findings in my document.',
    icon: FileText
  },
  {
    id: 'research',
    label: 'Research a topic',
    prompt: 'Research recent breakthroughs in artificial intelligence.',
    icon: Compass
  },
  {
    id: 'write',
    label: 'Help me write',
    prompt: 'Help me write a concise, professional executive summary.',
    icon: PenLine
  },
  {
    id: 'summarise',
    label: 'Summarise this',
    prompt: 'Summarise the key concepts into three clear, actionable points.',
    icon: BookOpen
  }
];

export default function QuickPrompts({ onSelectPrompt, disabled, documents = [] }) {
  const handleSelect = (item) => {
    if (item.id === 'analyse' && documents.length > 0) {
      onSelectPrompt(`Analyse the key takeaways from "${documents[0].originalName}".`);
    } else {
      onSelectPrompt(item.prompt);
    }
  };

  return (
    <div className="compact-prompts-bar" role="group" aria-label="Prompt suggestions">
      <div className="compact-prompts-track">
        {COMPACT_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`compact-prompt-${item.id}`}
              type="button"
              className="compact-chip-btn"
              onClick={() => handleSelect(item)}
              disabled={disabled}
              title={item.prompt}
            >
              <Icon size={14} className="compact-chip-icon" aria-hidden="true" />
              <span className="compact-chip-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
