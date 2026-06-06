export function ExpectedCountReadOnly({ count }: { count: number }) {
  return (
    <p className="text-sm">
      <span className="font-semibold">Erwartete Spieler: </span>
      <span className="font-bold text-lg tabular-nums">{count}</span>
      <span aria-hidden> ★</span>
    </p>
  );
}
