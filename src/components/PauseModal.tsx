interface Props {
  open: boolean;
  onResume: () => void;
  onQuit: () => void;
  onRestart: () => void;
}

export default function PauseModal({ open, onResume, onQuit, onRestart }: Props) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="panel p-5 sm:p-6 w-full max-w-[280px] flex flex-col gap-3 animate-pop">
        <div className="text-center text-2xl font-display accent-text">PAUSED</div>
        <button onClick={onResume} className="btn-primary">▶ Resume</button>
        <button onClick={onRestart} className="btn-ghost">↻ Restart</button>
        <button onClick={onQuit} className="btn-ghost">⏏ Quit to menu</button>
      </div>
    </div>
  );
}
