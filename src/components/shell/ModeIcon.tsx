import type { VizMode } from '../../store';

interface Props {
  mode: VizMode;
  className?: string;
}

// Compact glyphs — no external icon library so each mode reads as bespoke.
// All glyphs share a 24×24 viewBox so they line up in the rail.
export function ModeIcon({ mode, className }: Props) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className
  };
  switch (mode) {
    case 'predictions':
      return (
        <svg {...common}>
          {/* Branching tree of probabilities */}
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="13" cy="6" r="1.4" />
          <circle cx="13" cy="12" r="1.4" />
          <circle cx="13" cy="18" r="1.4" />
          <circle cx="20" cy="9" r="1.2" />
          <circle cx="20" cy="15" r="1.2" />
          <line x1="6.5" y1="11" x2="11.6" y2="6.7" />
          <line x1="6.5" y1="12" x2="11.6" y2="12" />
          <line x1="6.5" y1="13" x2="11.6" y2="17.3" />
          <line x1="14.4" y1="6.5" x2="18.6" y2="8.5" />
          <line x1="14.4" y1="12" x2="18.6" y2="14.5" />
        </svg>
      );
    case 'embeddings':
      return (
        <svg {...common}>
          {/* Cluster of points */}
          <circle cx="6" cy="8" r="1.2" fill="currentColor" />
          <circle cx="9" cy="6" r="1.2" fill="currentColor" />
          <circle cx="8" cy="10" r="1.2" fill="currentColor" />
          <circle cx="16" cy="14" r="1.2" fill="currentColor" />
          <circle cx="18" cy="11" r="1.2" fill="currentColor" />
          <circle cx="19" cy="16" r="1.2" fill="currentColor" />
          <circle cx="12" cy="18" r="1.2" />
          <circle cx="14" cy="20" r="1.2" />
        </svg>
      );
    case 'attention':
      return (
        <svg {...common}>
          {/* Beam-like rays converging */}
          <line x1="3" y1="6" x2="20" y2="12" />
          <line x1="3" y1="12" x2="20" y2="12" />
          <line x1="3" y1="18" x2="20" y2="12" />
          <circle cx="20" cy="12" r="2" fill="currentColor" />
        </svg>
      );
    case 'logit-lens':
      return (
        <svg {...common}>
          {/* Step plot */}
          <polyline points="3,18 7,18 7,12 11,12 11,8 15,8 15,15 19,15 19,5 21,5" />
          <line x1="3" y1="20" x2="21" y2="20" opacity="0.4" />
        </svg>
      );
  }
}
