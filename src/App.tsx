import { useState } from 'react';
import { AttentionCanvas } from './components/AttentionCanvas';
import { AttentionControls } from './components/AttentionControls';
import { Controls } from './components/Controls';
import { EmbeddingsCanvas } from './components/EmbeddingsCanvas';
import { EmbeddingsControls } from './components/EmbeddingsControls';
import { LogitLensCanvas } from './components/LogitLensCanvas';
import { LogitLensControls } from './components/LogitLensControls';
import { MathPanel } from './components/MathPanel';
import { MeshCanvas } from './components/MeshCanvas';
import { ModelLoadOverlay } from './components/ModelLoadOverlay';
import { PromptInput } from './components/PromptInput';
import { LeftRail } from './components/shell/LeftRail';
import { SettingsDrawer } from './components/shell/SettingsDrawer';
import { StageEffects } from './components/shell/StageEffects';
import { TopBar } from './components/shell/TopBar';
import { useStore } from './store';

export default function App() {
  const mode = useStore((s) => s.mode);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full gap-3 p-3">
      <LeftRail onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        <TopBar />

        <div className="grid flex-1 grid-cols-[1fr_320px] gap-3 overflow-hidden">
          {/* Stage — the live canvas */}
          <main className="relative overflow-hidden rounded-lg border border-mesh-edge/70 bg-mesh-ink mesh-corner-bracket animate-mesh-fade-up">
            {mode === 'predictions' && <MeshCanvas />}
            {mode === 'embeddings' && <EmbeddingsCanvas />}
            {mode === 'attention' && <AttentionCanvas />}
            {mode === 'logit-lens' && <LogitLensCanvas />}
            <StageEffects />
          </main>

          {/* Sidebar — mode-specific controls */}
          <aside className="flex flex-col gap-3 overflow-y-auto pr-1 animate-mesh-fade-up">
            {mode === 'predictions' && (
              <>
                <Controls />
                <MathPanel />
              </>
            )}
            {mode === 'embeddings' && (
              <>
                <EmbeddingsControls />
                <div className="mesh-panel rounded-lg p-3 text-xs text-mesh-dim">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mesh-accent">
                    embedding space
                  </div>
                  <p className="leading-relaxed">
                    Each token is a point in semantic 3D space. Tokens with similar meanings cluster
                    together — animals near other animals, colors near colors, emotions near emotions.
                  </p>
                  <p className="mt-3 text-[10px] text-mesh-mute">
                    Click <em>load real embeddings</em> to swap the synthetic dataset for sentence-level
                    embeddings from <code className="text-mesh-accent">all-MiniLM-L6-v2</code>, projected
                    via PCA in your browser.
                  </p>
                </div>
              </>
            )}
            {mode === 'attention' && <AttentionControls />}
            {mode === 'logit-lens' && <LogitLensControls />}
          </aside>
        </div>

        <PromptInput />
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ModelLoadOverlay />
    </div>
  );
}
