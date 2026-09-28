import React from 'react';
import AppLogo from './AppLogo';
import { PenLine, Compass, BookOpen, Code2 } from 'lucide-react';

export default function GeminiWelcome({
  user,
  onSelectPrompt,
  onSwitchToResearch,
  documents = []
}) {
  const firstName = user?.name ? user.name.split(' ')[0] : 'Afzal';

  const cards = [
    {
      id: 'writing',
      tag: 'WRITING',
      title: 'Help me write',
      desc: 'Draft a thoughtful email, proposal, or executive brief with clarity and conciseness.',
      prompt: 'Help me draft a thoughtful email, proposal, or executive brief with clarity and conciseness.',
      iconName: 'edit_note',
      lucideIcon: <PenLine size={18} />,
      actionType: 'prompt'
    },
    {
      id: 'research',
      tag: 'RESEARCH',
      title: 'Explore & Research',
      desc: 'Ground queries with live web search, recent market data, and verified references.',
      prompt: 'Ground queries with live web search, recent market data, and verified references.',
      iconName: 'travel_explore',
      lucideIcon: <Compass size={18} />,
      actionType: 'prompt'
    },
    {
      id: 'analysis',
      tag: 'RESEARCH & SYNTHESIS',
      title: 'Analyze Document',
      desc: 'Inspect parsed excerpts, run multi-chunk RAG, and synthesize cross-document findings.',
      prompt: documents.length > 0
        ? `Analyze the document "${documents[0].originalName}" and synthesize the key findings.`
        : 'Analyze my uploaded PDF and synthesize the key findings.',
      iconName: 'library_books',
      lucideIcon: <BookOpen size={18} />,
      actionType: 'research'
    },
    {
      id: 'engineering',
      tag: 'ENGINEERING',
      title: 'Code & Debug',
      desc: 'Explain complex architectures, generate unit-tested components, or optimize routines.',
      prompt: 'Explain complex architectures, generate unit-tested components, or optimize routines.',
      iconName: 'code',
      lucideIcon: <Code2 size={18} />,
      actionType: 'prompt'
    }
  ];

  const handleCardClick = (card) => {
    if (card.actionType === 'research' && onSwitchToResearch) {
      if (documents.length > 0) {
        onSwitchToResearch(documents[0]);
      } else {
        onSwitchToResearch(null);
      }
      return;
    }
    if (onSelectPrompt) {
      onSelectPrompt(card.prompt);
    }
  };

  return (
    <div className="gemini-welcome-container">
      {/* Top Enterprise Badge */}
      <div className="enterprise-top-badge">
        <AppLogo size={18} className="enterprise-logo-icon" />
        <span className="enterprise-title">Afzal's AI Enterprise v2.5</span>
        <span className="enterprise-status-pill">Active</span>
      </div>

      {/* Main Greeting Headline */}
      <div className="welcome-headline-wrap">
        <h1 className="welcome-headline">
          Hello, <span className="welcome-name-gradient">{firstName}</span>
        </h1>
        <p className="welcome-subhead">What shall we investigate today?</p>
      </div>

      {/* 2x2 Feature Suggestion Cards Grid */}
      <div className="welcome-cards-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="welcome-card"
            onClick={() => handleCardClick(card)}
            role="button"
            tabIndex={0}
            title={card.title}
          >
            {/* Card Header: Teal Dot + Uppercase Tag on Left, Icon on Right */}
            <div className="welcome-card-header">
              <div className="welcome-card-tag-wrap">
                <span className="card-teal-dot" />
                <span className="card-tag-text">{card.tag}</span>
              </div>
              <div className="welcome-card-icon-wrap" aria-hidden="true">
                <span className="material-symbols-outlined card-mat-icon">{card.iconName}</span>
              </div>
            </div>

            {/* Card Body */}
            <div className="welcome-card-body">
              <h3 className="welcome-card-title">{card.title}</h3>
              <p className="welcome-card-desc">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
