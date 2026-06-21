export default function Loading() {
  return (
    <div className="app-splash" role="status" aria-busy="true">
      <div className="app-splash-logo">
        <span className="app-splash-die" aria-hidden>
          🎲
        </span>
        <span>BG Buddy</span>
      </div>
      <div className="app-splash-bar" aria-hidden>
        <span className="app-splash-bar-fill" />
      </div>
      <span className="sr-only">Wird geladen …</span>
    </div>
  );
}
