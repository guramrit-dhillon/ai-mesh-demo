import { useStore } from '../store';

export function ModelLoadOverlay() {
  const status = useStore((s) => s.modelStatus);
  const error = useStore((s) => s.modelError);

  if (status === 'ready') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur">
      <div className="max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 text-center">
        {status === 'loading' && (
          <>
            <div className="mb-3 text-lg font-medium">Loading GPT-2...</div>
            <div className="text-sm text-slate-400">
              First visit downloads ~122 MB of model weights. Cached after this.
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full w-1/3 animate-pulse bg-blue-500" />
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mb-3 text-lg font-medium text-red-400">Model failed to load</div>
            <div className="font-mono text-xs text-slate-400">{error}</div>
            <button
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500"
              onClick={() => location.reload()}
            >
              Reload
            </button>
          </>
        )}
      </div>
    </div>
  );
}
