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
        aria-hidden
      >
        🎲
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`object-cover bg-[var(--surface-2)] ${className}`}
    />
  );
}
