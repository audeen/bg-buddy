/**
 * GameUPC REST API client.
 *
 * Spec from https://www.gameupc.com/demo.html (React Demo → Source):
 * - Base: https://api.gameupc.com/test/
 * - Auth: header `x-api-key`
 * - Lookup: GET upc/{code}?search_mode=quality
 * - Verified when `bgg_info_status === "verified"`; else show `bgg_info` candidates.
 *
 * Demo key `test_test_test_test_test` works on the test stage for development.
 * Production: set GAMEUPC_API_KEY (contact gameupc@grettir.org).
 */

const GAMEUPC_BASE =
  process.env.GAMEUPC_API_BASE?.trim() || "https://api.gameupc.com/test/";
const DEMO_API_KEY = "test_test_test_test_test";

export type GameUpcBggItem = {
  id: number;
  name: string;
  published?: string;
  thumbnail_url?: string;
  image_url?: string;
  confidence?: number;
};

type GameUpcRawResponse = {
  upc?: string;
  name?: string;
  searched_for?: string;
  bgg_info_status?: string;
  bgg_info?: GameUpcBggItem[];
  status?: string;
};

export type BarcodeLookupCandidate = {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  confidence: number | null;
  year?: number | null;
  isExpansion?: boolean;
};

export type BarcodeLookupResult =
  | { status: "found"; barcode: string; bggId: number; name: string; verified: boolean }
  | { status: "candidates"; barcode: string; items: BarcodeLookupCandidate[] }
  | { status: "notFound"; barcode: string }
  | { status: "notConfigured" }
  | { status: "error"; message: string };

function gameUpcApiKey(): string | null {
  const key = process.env.GAMEUPC_API_KEY?.trim();
  if (key) return key;
  // Allow test endpoint without explicit env in development
  if (GAMEUPC_BASE.includes("/test/")) return DEMO_API_KEY;
  return null;
}

/** Normalizes EAN-13 / UPC-A input to digits only. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

function mapCandidate(item: GameUpcBggItem): BarcodeLookupCandidate {
  return {
    bggId: item.id,
    name: item.name,
    thumbnailUrl: item.thumbnail_url ?? null,
    confidence: item.confidence ?? null,
  };
}

/** Parses GameUPC JSON into a structured lookup result. Exported for tests. */
export function parseGameUpcResponse(
  raw: GameUpcRawResponse,
  barcode: string,
): BarcodeLookupResult {
  const items = (raw.bgg_info ?? []).filter(
    (item) => Number.isFinite(item.id) && item.name?.trim(),
  );

  if (raw.bgg_info_status === "verified" && items.length > 0) {
    const best = items[0];
    return {
      status: "found",
      barcode,
      bggId: best.id,
      name: best.name,
      verified: true,
    };
  }

  if (items.length === 1) {
    const only = items[0];
    return {
      status: "found",
      barcode,
      bggId: only.id,
      name: only.name,
      verified: false,
    };
  }

  if (items.length > 1) {
    return {
      status: "candidates",
      barcode,
      items: items.map(mapCandidate),
    };
  }

  return { status: "notFound", barcode };
}

export async function lookupBarcode(rawBarcode: string): Promise<BarcodeLookupResult> {
  const apiKey = gameUpcApiKey();
  if (!apiKey) {
    return { status: "notConfigured" };
  }

  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) {
    return { status: "error", message: "Ungültiger Barcode." };
  }

  const base = GAMEUPC_BASE.endsWith("/") ? GAMEUPC_BASE : `${GAMEUPC_BASE}/`;
  const url = `${base}upc/${encodeURIComponent(barcode)}?search_mode=quality`;

  try {
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `GameUPC-Antwort: HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as GameUpcRawResponse;
    if (data.status && data.status !== "ok") {
      return { status: "error", message: "GameUPC-Antwort ungültig." };
    }

    return parseGameUpcResponse(data, barcode);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "GameUPC-Anfrage fehlgeschlagen.";
    return { status: "error", message };
  }
}
