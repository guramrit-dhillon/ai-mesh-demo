import { useStore, type VizMode } from '../../store';

const MODE_INFO: Record<VizMode, { title: string; sub: string }> = {
  predictions: {
    title: 'Predictions',
    sub: 'Live next-token distribution. Click a candidate to branch.'
  },
  embeddings: {
    title: 'Embeddings',
    sub: 'Semantic 3D space. Words near each other mean similar things.'
  },
  attention: {
    title: 'Attention',
    sub: 'Which input tokens drove the prediction?'
  },
  'logit-lens': {
    title: 'Logit Lens',
    sub: 'What did the model think the next token was at each position?'
  }
};

export function TopBar() {
  const mode = useStore((s) => s.mode);
  const status = useStore((s) => s.modelStatus);
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const inputCount = tipNode?.inputTokens?.length ?? 0;
  const candidateCount = tipNode?.candidates?.length ?? 0;
  const info = MODE_INFO[mode];

  const statusLabel =
    status === 'ready' ? 'online' : status === 'loading' ? 'booting' : 'offline';
  const statusColor =
    status === 'ready'
      ? 'bg-mesh-good shadow-[0_0_10px_rgb(var(--mesh-good))]'
      : status === 'loading'
        ? 'bg-mesh-warm animate-mesh-pulse'
        : 'bg-mesh-bad';

  return (
    <header className="mesh-panel flex h-14 items-center gap-6 rounded-lg px-5">
      <div className="flex flex-col leading-tight">
        <div className="font-display text-[15px] font-semibold tracking-wider text-mesh-fg">
          {info.title}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-mesh-mute">
          {info.sub}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em]">
        <Stat label="input" value={String(inputCount).padStart(2, '0')} />
        <Stat label="candidates" value={String(candidateCount).padStart(2, '0')} />
        <Stat label="vocab" value="50,257" />
        <div className="h-6 w-px bg-mesh-edge/60" />
        <div className="flex items-center gap-2 text-mesh-dim">
          <span className={`block h-2 w-2 rounded-full ${statusColor}`} />
          <span>{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[8px] tracking-[0.2em] text-mesh-mute">{label}</span>
      <span className="text-mesh-fg">{value}</span>
    </div>
  );
}
