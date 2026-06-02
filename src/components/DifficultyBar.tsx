interface Props {
  difficulty: number; // 1..5
  iceMode?: boolean;
}

export default function DifficultyBar({ difficulty, iceMode = false }: Props) {
  const label =
    difficulty <= 2 ? 'Easy' : difficulty <= 3 ? 'Steady' : difficulty <= 4 ? 'Hard' : 'Brutal';
  const labelCls = iceMode
    ? 'text-[10px] tracking-widest uppercase whitespace-nowrap text-[#3A6A8F]'
    : 'text-[10px] tracking-widest uppercase whitespace-nowrap text-white/70';

  return (
    <div className="flex flex-col items-center select-none pointer-events-none">
      <div className={labelCls}>Difficulty · {label}</div>
      <div className="flex items-center gap-0.5 sm:gap-1 mt-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < difficulty;
          return (
            <span key={i} className="relative w-4 h-4 sm:w-6 sm:h-6">
              <span
                className={`absolute inset-0 transition-transform duration-300 ${filled ? 'scale-100' : 'scale-90 opacity-30'}`}
              >
                {iceMode ? (
                  <Snowflake filled={filled} />
                ) : (
                  <Star filled={filled} />
                )}
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
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      className={filled ? 'text-accent' : ''}
    >
      <path
        d="M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17l-5.9 3.1 1.2-6.6L2.5 8.9 9.1 8z"
        fill={filled ? 'currentColor' : 'rgba(255,255,255,0.25)'}
      />
    </svg>
  );
}

function Snowflake({ filled }: { filled: boolean }) {
  // Six-armed snowflake. Filled flakes use Glacier Blue; empty ones a pale
  // wash so the progression still reads at a glance.
  const stroke = filled ? '#5CB8E8' : '#A8C8DE';
  const tipFill = filled ? '#DDF8FF' : 'transparent';
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke={stroke}
      strokeWidth={filled ? 1.8 : 1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Three crossing arms */}
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4" y1="7.5" x2="20" y2="16.5" />
      <line x1="4" y1="16.5" x2="20" y2="7.5" />
      {/* Tip serifs on each arm */}
      <path d="M12 5 L10 7 M12 5 L14 7" />
      <path d="M12 19 L10 17 M12 19 L14 17" />
      <path d="M5.7 8.5 L5.4 10.9 M5.7 8.5 L8 9.1" />
      <path d="M18.3 15.5 L18.6 13.1 M18.3 15.5 L16 14.9" />
      <path d="M5.7 15.5 L5.4 13.1 M5.7 15.5 L8 14.9" />
      <path d="M18.3 8.5 L18.6 10.9 M18.3 8.5 L16 9.1" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.4" fill={tipFill} stroke={stroke} />
    </svg>
  );
}
