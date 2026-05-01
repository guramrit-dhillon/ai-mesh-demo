import { useEffect } from 'react';
import { useStore } from '../store';

// Autoplay walks the top-1 chain forward every STEP_MS while a) autoplay is on,
// b) the current tip's distribution is ready (not loading), and c) the tip has
// at least 30 candidates back (so we know we have the final batch, not a
// partial streaming checkpoint). It stops automatically if any of those are
// false until the next eligible tick.
const STEP_MS = 900;

export function useAutoplay() {
  const autoplay = useStore((s) => s.autoplay);
  const tipNodeId = useStore((s) => s.tipNodeId);
  const tipNode = useStore((s) => s.nodes[s.tipNodeId]);
  const autoStep = useStore((s) => s.autoStepTopOne);

  useEffect(() => {
    if (!autoplay) return;
    const ready =
      tipNode?.status === 'ready' &&
      (tipNode.candidates?.length ?? 0) >= 30;
    if (!ready) return;
    const id = setTimeout(() => autoStep(), STEP_MS);
    return () => clearTimeout(id);
  }, [autoplay, tipNodeId, tipNode?.status, tipNode?.candidates?.length, autoStep]);
}
