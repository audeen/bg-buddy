export function HostRecommendationBanner() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[2] px-2 py-1.5 text-center pointer-events-none bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
      aria-hidden="true"
    >
      <span className="text-[0.65rem] font-bold tracking-tight text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">
        Host-Empfehlung
      </span>
    </div>
  );
}
