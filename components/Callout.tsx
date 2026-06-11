import type { ReactNode } from "react";

const VARIANT_BORDER = {
  info: "border-[var(--accent-2)]",
  success: "border-[var(--accent)]",
  warning: "border-[var(--warning)]",
  danger: "border-[var(--danger)]",
} as const;

export type CalloutVariant = keyof typeof VARIANT_BORDER;

/** Status-/Hinweis-Karte mit farbiger Border (info/success/warning/danger). */
export function Callout({
  variant = "info",
  role = "status",
  className = "",
  children,
}: {
  variant?: CalloutVariant;
  role?: "status" | "alert" | "none";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`card card-pad ${VARIANT_BORDER[variant]} ${className}`}
      role={role === "none" ? undefined : role}
    >
      {children}
    </div>
  );
}
