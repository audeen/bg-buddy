import type { ReactNode } from "react";

export function PageHeader({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <header
      id={id}
      className="flex flex-col gap-2 scroll-mt-[var(--header-height)]"
    >
      {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
      {title ? <h1 className="page-title">{title}</h1> : null}
      {children}
    </header>
  );
}
