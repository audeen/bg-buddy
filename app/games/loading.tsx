export default function GamesLoading() {
  return (
    <div className="container-app flex flex-col gap-6" aria-busy="true">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <h1 className="page-title">Spielesammlung</h1>
        <span className="h-5 w-16 animate-pulse rounded-full bg-[var(--surface-2)]" />
      </div>

      <div className="filter-dropdown h-12 animate-pulse" />

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="card card-game animate-pulse">
            <div className="card-game-cover aspect-square w-full bg-[var(--surface-2)]" />
            <div className="card-pad flex flex-col gap-2.5">
              <div className="h-5 w-3/4 rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-1/2 rounded-full bg-[var(--surface-2)]" />
            </div>
          </li>
        ))}
      </ul>

      <p className="sr-only" role="status">
        Spiele werden geladen…
      </p>
    </div>
  );
}
