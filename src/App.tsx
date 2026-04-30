import { Controls } from './components/Controls';
import { MathPanel } from './components/MathPanel';
import { MeshCanvas } from './components/MeshCanvas';
import { ModelLoadOverlay } from './components/ModelLoadOverlay';
import { PromptInput } from './components/PromptInput';

export default function App() {
  return (
    <div className="relative grid h-full grid-cols-[1fr_320px] grid-rows-[1fr_auto] gap-3 bg-slate-950 p-3 text-slate-100">
      <div className="col-span-1 row-span-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
        <MeshCanvas />
      </div>
      <div className="col-span-1 row-span-1 flex flex-col gap-3 overflow-y-auto">
        <Controls />
        <MathPanel />
      </div>
      <div className="col-span-2 row-span-1">
        <PromptInput />
      </div>
      <ModelLoadOverlay />
    </div>
  );
}
