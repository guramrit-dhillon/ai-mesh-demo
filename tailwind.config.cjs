/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MESH brand palette — built from CSS variables so the Settings panel
        // can re-theme at runtime by mutating :root.
        mesh: {
          ink:    'rgb(var(--mesh-ink) / <alpha-value>)',
          panel:  'rgb(var(--mesh-panel) / <alpha-value>)',
          edge:   'rgb(var(--mesh-edge) / <alpha-value>)',
          mute:   'rgb(var(--mesh-mute) / <alpha-value>)',
          dim:    'rgb(var(--mesh-dim) / <alpha-value>)',
          fg:     'rgb(var(--mesh-fg) / <alpha-value>)',
          accent: 'rgb(var(--mesh-accent) / <alpha-value>)',
          warm:   'rgb(var(--mesh-warm) / <alpha-value>)',
          good:   'rgb(var(--mesh-good) / <alpha-value>)',
          bad:    'rgb(var(--mesh-bad) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      keyframes: {
        'mesh-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        },
        'mesh-scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        'mesh-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'mesh-pulse': 'mesh-pulse 2.4s ease-in-out infinite',
        'mesh-scan': 'mesh-scan 4s linear infinite',
        'mesh-fade-up': 'mesh-fade-up 280ms ease-out both'
      }
    }
  },
  plugins: []
};
