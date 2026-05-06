import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useProgressStore } from '@/store/progressStore';
import { getDailyChallenge } from '@/game/daily';
import { ensureAudio, playSfx } from '@/game/audio';
import LogoMark from '@/components/LogoMark';

export default function MainMenu() {
  const nav = useNavigate();
  const { resetGame, setPlatform, setChallenge, setGoals } = useGameStore();
  const dailyHistory = useProgressStore((s) => s.dailyHistory);
  const challengesCompleted = useProgressStore((s) => s.challengesCompleted);
  const endless = useProgressStore((s) => s.endlessLevelReached);

  const today = getDailyChallenge();
  const dailyDone = dailyHistory.find((d) => d.date === today.date)?.completed;

  const startEndless = () => {
    ensureAudio();
    playSfx('click');
    resetGame('endless');
    setPlatform('wood');
    setChallenge(null);
    setGoals(0, 0);
    nav('/play');
  };

  const startDaily = () => {
    ensureAudio();
    playSfx('click');
    resetGame('daily');
    setPlatform(today.challenge.platform);
    setChallenge(today.challenge);
    setGoals(today.challenge.goalScore, today.challenge.goalHeight);
    nav('/play');
  };

  return (
    <div className="relative h-full w-full overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)] flex flex-col items-center">
      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-5 animate-rise">
        <div className="flex items-center gap-3">
          <LogoMark size={56} />
          <div className="text-3xl sm:text-4xl font-display accent-text">TRICKY BLOCKS</div>
        </div>

        <button onClick={startEndless} className="btn-primary w-full text-2xl py-5">
          <span>♾</span> Endless Mode
          <span className="text-sm opacity-80 ml-2">Lv. {endless}+</span>
        </button>

        <button
          onClick={startDaily}
          className={`btn w-full text-xl py-4 border ${
            dailyDone
              ? 'bg-surface text-white/70 border-white/10'
              : 'bg-surface text-white border-accent/60'
          }`}
        >
          <span className={dailyDone ? 'text-white/60' : 'text-accent'}>★</span>
          <span className="flex-1 text-left">
            Daily Challenge
            <div className="text-xs opacity-80 font-normal">
              {today.challenge.name} {dailyDone && '✓ done'}
            </div>
          </span>
        </button>

        <button
          onClick={() => {
            playSfx('click');
            nav('/challenges');
          }}
          className="btn-ghost w-full text-lg py-4 flex"
        >
          <span>⚔</span>
          <span className="flex-1 text-left">
            Challenges
            <div className="text-xs opacity-70 font-normal">
              {challengesCompleted.length} completed
            </div>
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={() => {
              playSfx('click');
              nav('/how');
            }}
            className="btn-ghost py-3"
          >
            How to Play
          </button>
          <button
            onClick={() => {
              playSfx('click');
              nav('/settings');
            }}
            className="btn-ghost py-3"
          >
            Settings
          </button>
        </div>

        <div className="text-xs text-white/40 mt-4 text-center">
          Drag blocks from the tray. Stack high. Don't topple.
        </div>
      </div>
    </div>
  );
}
