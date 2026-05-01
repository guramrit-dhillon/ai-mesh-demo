import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Wordmark } from './brand/Wordmark';

const BOOT_LINES = [
  '[init]   ignition…',
  '[net]    fetching model shard',
  '[wasm]   spinning onnx runtime',
  '[graph]  registering 12 layers',
  '[ready]  awaiting prompt'
];

export function ModelLoadOverlay() {
  const status = useStore((s) => s.modelStatus);
  const error = useStore((s) => s.modelError);
  const [revealed, setRevealed] = useState(0);
  const [hiding, setHiding] = useState(false);

  // Step through the boot lines while loading. Each line lights up roughly
  // 800ms apart — purely cosmetic, but it makes the wait feel intentional.
  useEffect(() => {
    if (status !== 'loading') return;
    const id = setInterval(() => {
      setRevealed((r) => Math.min(r + 1, BOOT_LINES.length - 1));
    }, 850);
    return () => clearInterval(id);
  }, [status]);

  // When the model becomes ready, fade out the overlay instead of yanking it.
  useEffect(() => {
    if (status === 'ready') {
      setRevealed(BOOT_LINES.length);
      setHiding(true);
      const t = setTimeout(() => setHiding(false), 700);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (status === 'ready' && !hiding) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        status === 'ready' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(10,30,50,0.95) 0%, rgba(3,8,20,0.98) 70%)'
      }}
    >
      {/* Animated grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(124,228,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,228,255,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)'
        }}
      />

      <div className="relative z-10 mesh-panel mesh-corner-bracket flex w-[520px] flex-col items-center gap-6 rounded-lg p-10 text-center">
        <Wordmark size="lg" showTagline />

        {status === 'loading' && (
          <>
            <div className="w-full">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-mesh-mute">
                <span>booting gpt-2 (int8)</span>
                <span className="text-mesh-accent animate-mesh-pulse">~268 mb</span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded bg-mesh-edge/40">
                <div
                  className="absolute inset-y-0 left-0 w-1/3 rounded bg-mesh-accent"
                  style={{
                    boxShadow: '0 0 12px rgb(var(--mesh-accent))',
                    animation: 'mesh-slide 1.6s ease-in-out infinite'
                  }}
                />
              </div>
            </div>

            <div className="w-full text-left font-mono text-[11px] leading-relaxed text-mesh-dim">
              {BOOT_LINES.map((line, i) => {
                const lit = i <= revealed;
                return (
                  <div
                    key={i}
                    className={`transition-all duration-300 ${
                      lit ? 'text-mesh-fg' : 'text-mesh-mute/40'
                    }`}
                    style={{ transform: lit ? 'translateX(0)' : 'translateX(-4px)' }}
                  >
                    <span className="text-mesh-accent">{lit ? '›' : ' '}</span> {line}
                  </div>
                );
              })}
            </div>

            <div className="text-[10px] text-mesh-mute">
              First boot caches the weights — instant after this.
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="font-display text-base font-semibold text-mesh-bad">
              Boot failed
            </div>
            <code className="block max-w-md text-left font-mono text-xs text-mesh-dim">
              {error}
            </code>
            <button onClick={() => location.reload()} className="mesh-btn">
              Reboot
            </button>
          </>
        )}

        {status === 'ready' && (
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-mesh-good">
            ✓ ready — entering mesh
          </div>
        )}
      </div>

      <style>{`
        @keyframes mesh-slide {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
