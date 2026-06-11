/**
 * Dekodiert die von BGG/Geekdo gelieferten HTML-Entities
 * (benannte und numerische wie &#039; oder &#x27;).
 */
export function decodeBggEntities(text: string): string {
  return (
    text
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCodePoint(parseInt(code, 10)),
      )
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
        String.fromCodePoint(parseInt(code, 16)),
      )
      .replace(/&quot;/g, '"')
      .replace(/&rsquo;|&lsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&nbsp;/g, " ")
      // Zuletzt, damit z.B. "&amp;#39;" nicht doppelt dekodiert wird.
      .replace(/&amp;/g, "&")
  );
}

/** Dekodiert Entities in nullable Strings (z.B. Namen aus dem BGG-XML). */
export function decodeBggText(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const text = decodeBggEntities(value).trim();
  return text || null;
}

/**
 * Entfernt HTML-Tags und dekodiert die von BGG/Geekdo gelieferten
 * HTML-Entities aus Beschreibungstexten (XML-API und Geekdo-JSON).
 */
export function stripBggHtml(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const text = decodeBggEntities(
    String(raw)
      .replace(/&#10;/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}
