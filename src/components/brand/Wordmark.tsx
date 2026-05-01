interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: 18, letter: 14, tagline: 9 },
  md: { mark: 26, letter: 20, tagline: 10 },
  lg: { mark: 56, letter: 44, tagline: 13 }
};

// MESH wordmark — the dot-grid mark on the left is a stylized 4×4 token mesh
// (top-left and bottom-right corners pulled out). Letters in Space Grotesk
// with a wide-track all-caps treatment to feel architectural.
export function Wordmark({ size = 'md', showTagline = false }: WordmarkProps) {
  const s = SIZES[size];
  const dot = s.mark / 9;
  const gap = s.mark / 4;
  return (
    <div className="inline-flex items-center gap-3">
      <svg
        width={s.mark}
        height={s.mark}
        viewBox={`0 0 ${s.mark} ${s.mark}`}
        className="text-mesh-accent"
        aria-hidden="true"
      >
        {/* 4×4 dot grid */}
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, c) => {
            const cx = gap / 2 + c * gap;
            const cy = gap / 2 + r * gap;
            // Highlight the corners of the diagonal — visual nod to attention
            const corner =
              (r === 0 && c === 0) || (r === 3 && c === 3) || (r === 1 && c === 2);
            return (
              <circle
                key={`${r}-${c}`}
                cx={cx}
                cy={cy}
                r={corner ? dot * 0.9 : dot * 0.55}
                fill="currentColor"
                opacity={corner ? 1 : 0.55}
              />
            );
          })
        )}
        {/* Connecting line from TL → middle → BR (the predicted-path through the mesh) */}
        <path
          d={`M ${gap / 2} ${gap / 2} L ${gap / 2 + 2 * gap} ${gap / 2 + gap} L ${gap / 2 + 3 * gap} ${gap / 2 + 3 * gap}`}
          stroke="currentColor"
          strokeWidth={dot * 0.45}
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          className="font-display font-bold tracking-[0.32em] text-mesh-fg"
          style={{ fontSize: s.letter }}
        >
          MESH
        </span>
        {showTagline && (
          <span
            className="mt-1.5 font-mono uppercase tracking-[0.25em] text-mesh-mute"
            style={{ fontSize: s.tagline }}
          >
            a live look inside language models
          </span>
        )}
      </div>
    </div>
  );
}
