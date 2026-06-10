/**
 * Entfernt HTML-Tags und dekodiert die von BGG/Geekdo gelieferten
 * HTML-Entities aus Beschreibungstexten (XML-API und Geekdo-JSON).
 */
export function stripBggHtml(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const text = String(raw)
    .replace(/&#10;/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}
