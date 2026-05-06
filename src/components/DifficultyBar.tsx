interface Props {
  difficulty: number; // 1..5
}

export default function DifficultyBar({ difficulty }: Props) {
  const label =
    difficulty <= 2 ? 'Easy' : difficulty <= 3 ? 'Steady' : difficulty <= 4 ? 'Hard' : 'Brutal';

  return (
    <div className="flex flex-col items-center select-none pointer-events-none">
      <div className="text-[10px] tracking-widest uppercase text-white/70 whitespace-nowrap">
        Difficulty · {label}
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1 mt-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < difficulty;
          return (
            <span key={i} className="relative w-4 h-4 sm:w-6 sm:h-6">
              <span
                className={`absolute inset-0 transition-transform duration-300 ${filled ? 'scale-100' : 'scale-90 opacity-30'}`}
              >
                <Star filled={filled} />
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path
        d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17l-5.9 3.1 1.2-6.6L2.5 8.9 9.1 8z"
        fill={filled ? '#FFD60A' : 'rgba(255,255,255,0.25)'}
      />
    </svg>
  );
}
