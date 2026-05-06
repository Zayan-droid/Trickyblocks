import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoMark from '@/components/LogoMark';

export default function Splash() {
  const nav = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => nav('/welcome'), 1900);
    return () => clearTimeout(t);
  }, [nav]);

  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute block w-3 h-3 rounded-sm animate-confetti bg-accent"
            style={{
              left: `${(i * 4.7) % 100}%`,
              top: `-10%`,
              animationDelay: `${(i % 8) * 0.18}s`,
              animationDuration: `${2.4 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex flex-col items-center gap-5 sm:gap-6 animate-pop px-4 text-center">
        <LogoMark size={120} />
        <div className="text-4xl sm:text-5xl md:text-7xl font-display tracking-wide accent-text">
          TRICKY BLOCKS
        </div>
        <div className="text-lg sm:text-xl md:text-2xl text-white/80 font-display tracking-widest">
          ENHANCED EDITION
        </div>
        <div className="mt-6 h-1 w-40 rounded-full overflow-hidden bg-surface-2">
          <div className="h-full w-2/3 bg-accent" />
        </div>
      </div>
    </div>
  );
}
