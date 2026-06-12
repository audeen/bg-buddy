export function HostRecommendationBanner() {
  return (
    <div className="host-rec-banner" aria-hidden="true">
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.6 11.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L3 7z" />
      </svg>
      <span>Host-Empfehlung</span>
    </div>
  );
}
