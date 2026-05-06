interface Props {
  size?: number;
}

export default function LogoMark({ size = 96 }: Props) {
  const accent = '#FFD60A';
  return (
    <div
      style={{ width: size, height: size }}
      className="relative animate-floaty"
      aria-hidden
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <rect x="6" y="34" width="22" height="20" rx="3" fill={accent} />
        <rect x="30" y="22" width="20" height="32" rx="3" fill={accent} opacity="0.55" />
        <rect
          x="14"
          y="10"
          width="18"
          height="22"
          rx="3"
          fill={accent}
          opacity="0.8"
          transform="rotate(-6 23 21)"
        />
      </svg>
    </div>
  );
}
