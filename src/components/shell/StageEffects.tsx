import { useStore } from '../../store';

// Brief horizontal scan sweep that fires whenever the user switches modes —
// it sells the transition as "system reconfiguring" rather than just a
// component swap. A keyed div restarts the CSS animation on every mode change.
export function StageEffects() {
  const mode = useStore((s) => s.mode);
  return (
    <>
      <div
        key={mode}
        className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute left-0 right-0 h-[2px]"
          style={{
            top: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(var(--mesh-accent) / 0.85) 50%, transparent 100%)',
            boxShadow: '0 0 18px rgba(var(--mesh-accent) / 0.65)',
            animation: 'mesh-stage-scan 700ms ease-out forwards'
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(var(--mesh-accent) / 0.07) 0%, transparent 35%)',
            animation: 'mesh-stage-fade 700ms ease-out forwards'
          }}
        />
      </div>
      <style>{`
        @keyframes mesh-stage-scan {
          0%   { transform: translateY(0); opacity: 0.0; }
          15%  { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes mesh-stage-fade {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
