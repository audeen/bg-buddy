export function ExpansionRequiredBanner({ label }: { label: string }) {
  return (
    <div className="expansion-required-banner" aria-hidden="true">
      <div className="expansion-required-banner__band">{label}</div>
    </div>
  );
}
