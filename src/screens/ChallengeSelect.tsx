import { useNavigate } from 'react-router-dom';
import { CHALLENGES } from '@/game/challenges';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { playSfx } from '@/game/audio';

export default function ChallengeSelect() {
  const nav = useNavigate();
  const { resetGame, setChallenge, setPlatform, setGoals } = useGameStore();
  const completed = useProgressStore((s) => s.challengesCompleted);

  const start = (id: string) => {
    const c = CHALLENGES.find((x) => x.id === id);
    if (!c) return;
    playSfx('click');
    resetGame('challenge');
    setChallenge(c);
    setPlatform(c.platform);
    setGoals(c.goalScore, c.goalHeight);
    nav('/play');
  };

  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-8 sm:py-10 pt-[max(env(safe-area-inset-top),32px)] pb-[max(env(safe-area-inset-bottom),32px)] flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-5 animate-rise">
        <h2 className="text-3xl font-display accent-text">CHALLENGES</h2>
        <p className="text-white/70 text-sm">
          Tighter constraints. Stranger physics. Real bragging rights.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {CHALLENGES.map((c) => {
            const done = completed.includes(c.id);
            const boss = !!c.bossTag;
            return (
              <button
                key={c.id}
                onClick={() => start(c.id)}
                className={`text-left panel p-4 transition-transform hover:scale-[1.02] active:scale-[0.99]
                  ${boss ? 'border-accent ring-2 ring-accent/40' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="font-display text-lg leading-tight">{c.name}</div>
                  <div className="text-xs text-accent">{done ? '✓' : ''}</div>
                </div>
                <div className="text-xs text-white/65 mt-1">{c.blurb}</div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-white/80">
                  <Tag>{c.platform}</Tag>
                  {c.shapesAllowed.length < 7 && (
                    <Tag>{c.shapesAllowed.join('/')} only</Tag>
                  )}
                  {c.wind > 0 && <Tag>wind</Tag>}
                  {boss && <Tag tone="boss">BOSS</Tag>}
                </div>
                <div className="mt-3 text-xs text-white/65">
                  Goal: {c.goalScore} pts · {Math.round(c.goalHeight / 6)}m
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={() => nav(-1)} className="btn-ghost mt-4 self-start">
          ← Back
        </button>
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'boss' }) {
  const cls =
    tone === 'boss'
      ? 'bg-accent text-black font-display'
      : 'bg-surface-2 text-white/80 border border-white/10';
  return (
    <span className={`px-2 py-0.5 rounded-full uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}
