import Link from "next/link";

export function MeetupSubnav({
  meetupId,
  active,
  pickPoolSize,
}: {
  meetupId: string;
  active: "detail" | "pick" | "duell";
  pickPoolSize?: number;
}) {
  const base = `/meetups/${meetupId}`;
  const tabs = [
    { id: "detail" as const, href: base, label: "Übersicht" },
    { id: "pick" as const, href: `${base}/pick`, label: "Direkt-Pick" },
    {
      id: "duell" as const,
      href: `${base}/duell`,
      label:
        pickPoolSize !== undefined && pickPoolSize >= 2
          ? `Duell (${pickPoolSize})`
          : "Duell",
    },
  ];

  return (
    <nav className="tabs-scroll" aria-label="Treffen-Navigation">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`btn btn-tab shrink-0 ${active === t.id ? "btn-primary" : "btn-ghost"}`}
          aria-current={active === t.id ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
