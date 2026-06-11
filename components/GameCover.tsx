/* eslint-disable @next/next/no-img-element */

export function GameCover({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--surface-2)] text-2xl text-[var(--muted)] ${className}`}
        role="img"
        aria-label="Kein Cover verfügbar"
      >
        <span aria-hidden>🎲</span>
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-2)] ${className}`}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover scale-110 blur-xl"
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="relative z-[1] h-full w-full object-contain"
      />
    </div>
  );
}
