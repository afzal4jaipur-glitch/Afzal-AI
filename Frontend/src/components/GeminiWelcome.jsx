import React from 'react';
import AppLogo from './AppLogo';
import { Compass, Lightbulb, FileText, Code2 } from 'lucide-react';

export default function GeminiWelcome({
  user,
  onSelectPrompt,
  onSwitchToResearch,
  documents = []
}) {
  const firstName = user?.name ? user.name.split(' ')[0] : null;

  // 3. Harmonious, unified color palette: subtle monochromatic soft blue/indigo tones
  // avoiding rainbow colored accents that compete with logo and status indicators
  const suggestions = [
    {
      id: 'suggest-write',
      title: 'Help me write',
      desc: 'Draft a thoughtful email, proposal, or executive brief with clarity',
      prompt: 'Help me draft a concise, professional project update email to my team.',
      icon: <Lightbulb size={18} className="harmonious-card-icon" />,
      tag: 'Writing',
      actionType: 'prompt'
    },
    {
      id: 'suggest-explore',
      title: 'Explore & Research',
      desc: 'Ground queries with live web search, recent data, and verified sources',
      prompt: 'What are the most significant breakthroughs in AI and technology this month?',
      icon: <Compass size={18} className="harmonious-card-icon" />,
      tag: 'Research',
      actionType: 'prompt'
    },
    {
      id: 'suggest-docs',
      title: 'Analyze Document',
      desc: 'Inspect parsed excerpts, run multi-chunk RAG, and select text to synthesize',
      prompt: documents.length > 0
        ? `Summarize the key findings and details in "${documents[0].originalName}".`
        : 'Analyze my uploaded PDF and extract the key findings.',
      icon: <FileText size={18} className="harmonious-card-icon" />,
      tag: 'Research & Synthesis',
      actionType: 'research'
    },
    {
      id: 'suggest-code',
      title: 'Code & Debug',
      desc: 'Explain architectures, generate clean components, or review algorithms',
      prompt: 'Explain how async/await works under the hood in JavaScript with a clear example.',
      icon: <Code2 size={18} className="harmonious-card-icon" />,
      tag: 'Engineering',
      actionType: 'prompt'
    }
  ];

  const handleCardClick = (item) => {
    if (item.actionType === 'research' && onSwitchToResearch) {
      if (documents.length > 0) {
        onSwitchToResearch(documents[0]);
      } else {
        onSwitchToResearch(null);
      }
      return;
    }
    if (onSelectPrompt) {
      onSelectPrompt(item.prompt);
    }
  };

  return (
    <div className="gemini-welcome-container">
      {/* Hero Greeting with tightened vertical rhythm */}
      <div className="gemini-hero-wrap">
        <div className="gemini-hero-badge">
          <AppLogo size={20} />
          <span>Afzal's AI</span>
        </div>

        <h1 className="gemini-greeting-title">
          <span className="gemini-gradient-text">
            Hello{firstName ? `, ${firstName}` : ' there'}
          </span>
        </h1>
        <p className="gemini-greeting-subtitle">How can I help you today?</p>
      </div>

      {/* 3. Prompt Suggestion Cards: Clickable surfaces, harmonious palette, no redundant inline anchor text */}
      <div className="gemini-suggestions-grid">
        {suggestions.map((item) => (
          <button
            key={item.id}
            type="button"
            className="gemini-suggestion-card"
            onClick={() => handleCardClick(item)}
            title={`Use suggestion: ${item.title}`}
          >
            <div className="suggestion-card-header">
              <span className="suggestion-tag">{item.tag}</span>
              <div className="suggestion-card-icon-wrap">
                {item.icon}
              </div>
            </div>

            <div className="suggestion-card-body">
              <h3 className="suggestion-card-title">{item.title}</h3>
              <p className="suggestion-card-desc">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
