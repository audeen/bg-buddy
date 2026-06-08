import Image from "next/image";

const OPTIMIZABLE_HOST = "cf.geekdo-images.com";

function canOptimize(src: string): boolean {
  try {
    return new URL(src).hostname === OPTIMIZABLE_HOST;
  } catch {
    return false;
  }
}

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

  if (canOptimize(src)) {
    return (
      <div
        className={`relative overflow-hidden bg-[var(--surface-2)] ${className}`}
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 640px) 120px, 200px"
          aria-hidden
          className="object-cover scale-110 blur-xl"
        />
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 640px) 120px, 200px"
          className="z-[1] object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface-2)] ${className}`}
      style={{
        backgroundImage: `url("${src}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="relative z-[1] h-full w-full object-contain"
      />
    </div>
  );
}
