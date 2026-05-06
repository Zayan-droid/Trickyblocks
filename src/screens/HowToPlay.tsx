import { useNavigate } from 'react-router-dom';

export default function HowToPlay() {
  const nav = useNavigate();
  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex justify-center">
      <div className="w-full max-w-lg flex flex-col gap-5 animate-rise">
        <h2 className="text-2xl sm:text-3xl font-display accent-text">HOW TO PLAY</h2>

        <div className="panel p-5">
          <h3 className="font-display text-xl mb-2">The Goal</h3>
          <p className="text-white/85 leading-relaxed">
            Drag tetromino blocks from the tray onto the platform. Stack as high as you
            can without toppling. Score grows with height, combos, and stable placements.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-xl mb-2">Drop Preview</h3>
          <p className="text-white/85 leading-relaxed">
            While dragging a block, a dashed silhouette shows exactly where it will
            land. Release to snap it into place. If the spot isn't valid (off-screen or
            unsupported), the silhouette disappears and the block won't drop — try a
            different position.
          </p>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-xl mb-2">Quick Actions</h3>
          <ul className="text-white/85 space-y-1 text-sm">
            <li><b>↶ Undo</b> — remove your most recent placement (3 per game)</li>
            <li><b>♻ Shuffle</b> — replace the current tray with new pieces (3 per game)</li>
            <li><b>📌 Pin</b> — arm, then drop a block anywhere (no support needed) and it stays put (3 per game)</li>
          </ul>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-xl mb-2">The 7 Pieces</h3>
          <ul className="text-white/85 space-y-1 text-sm">
            <li><b>I</b> — long bar, four cells in a row</li>
            <li><b>O</b> — 2×2 square</li>
            <li><b>T</b> — three across with one stub down</li>
            <li><b>S</b> / <b>Z</b> — zig-zag pieces</li>
            <li><b>L</b> / <b>J</b> — vertical bar with a foot</li>
          </ul>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-xl mb-2">Adaptive Difficulty</h3>
          <p className="text-white/85 leading-relaxed">
            The star meter watches your play. Land clean, get fast, and combos rise — and
            the game tightens up. Struggling? It gets gentler. You'll always feel the edge.
          </p>
        </div>

        <button onClick={() => nav(-1)} className="btn-primary mt-3">
          Back
        </button>
      </div>
    </div>
  );
}
