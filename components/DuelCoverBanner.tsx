export function DuelCoverBanner({
  label,
  variant,
}: {
  label: string;
  variant: "base" | "expansion";
}) {
  const rootClass =
    variant === "base" ? "lent-out-banner" : "expansion-required-banner";
  const bandClass =
    variant === "base"
      ? "lent-out-banner__band"
      : "expansion-required-banner__band";

  return (
    <div className={rootClass} aria-hidden="true">
      <div className={bandClass}>{label}</div>
    </div>
  );
}
