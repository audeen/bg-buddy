import type { BarcodeLookupCandidate } from "@/lib/barcode-lookup";
import type { BggSearchItem } from "@/lib/bgg";

export type LookupKind = "barcode" | "name";

export type LookupResponse =
  | { status: "found"; barcode: string; bggId: number; name: string; verified: boolean }
  | { status: "candidates"; barcode: string; items: BarcodeLookupCandidate[] }
  | { status: "notFound"; barcode: string }
  | { status: "notConfigured" }
  | { status: "alreadyInCollection"; barcode: string; bggId: number; name: string }
  | { status: "error"; message: string }
  | { error: string };

export type NameSearchResponse =
  | {
      status: "found";
      query: string;
      bggId: number;
      name: string;
      year: number | null;
      isExpansion: boolean;
    }
  | { status: "candidates"; query: string; items: BggSearchItem[] }
  | { status: "notFound"; query: string }
  | { status: "alreadyInCollection"; query: string; bggId: number; name: string }
  | { status: "error"; message: string }
  | { error: string };

/** Zustand des Hinzufügen-Flows nach Scan/Suche (sperrt die Kamera). */
export type ScanLock =
  | { phase: "lookingUp"; barcode: string; kind: LookupKind }
  | {
      phase: "found";
      barcode: string;
      kind: LookupKind;
      bggId: number;
      name: string;
      thumbnailUrl?: string | null;
    }
  | { phase: "candidates"; barcode: string; kind: LookupKind; items: BarcodeLookupCandidate[] }
  | {
      phase: "alreadyInCollection";
      barcode: string;
      kind: LookupKind;
      bggId: number;
      name: string;
    }
  | { phase: "notFound"; barcode: string; kind: LookupKind }
  | { phase: "error"; barcode: string; kind: LookupKind; message: string }
  | { phase: "added"; barcode: string; kind: LookupKind; bggId: number; name: string };

function mapBggSearchCandidate(item: BggSearchItem): BarcodeLookupCandidate {
  return {
    bggId: item.bggId,
    name: item.name,
    thumbnailUrl: null,
    confidence: null,
    year: item.year,
    isExpansion: item.isExpansion,
  };
}

export function lookupToScanLock(data: LookupResponse, barcode: string): ScanLock | null {
  const kind: LookupKind = "barcode";
  if ("error" in data) {
    return { phase: "error", barcode, kind, message: data.error };
  }

  switch (data.status) {
    case "found":
      return {
        phase: "found",
        barcode: data.barcode,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "candidates":
      return { phase: "candidates", barcode: data.barcode, kind, items: data.items };
    case "alreadyInCollection":
      return {
        phase: "alreadyInCollection",
        barcode: data.barcode,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "notFound":
      return { phase: "notFound", barcode: data.barcode, kind };
    case "notConfigured":
      return {
        phase: "error",
        barcode,
        kind,
        message:
          "Barcode-Lookup nicht konfiguriert. BGG-ID eingeben oder GAMEUPC_API_KEY setzen.",
      };
    case "error":
      return { phase: "error", barcode, kind, message: data.message };
    default:
      return null;
  }
}

export function nameSearchToScanLock(data: NameSearchResponse, query: string): ScanLock | null {
  const kind: LookupKind = "name";
  if ("error" in data) {
    return { phase: "error", barcode: query, kind, message: data.error };
  }

  switch (data.status) {
    case "found":
      return {
        phase: "found",
        barcode: data.query,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "candidates":
      return {
        phase: "candidates",
        barcode: data.query,
        kind,
        items: data.items.map(mapBggSearchCandidate),
      };
    case "alreadyInCollection":
      return {
        phase: "alreadyInCollection",
        barcode: data.query,
        kind,
        bggId: data.bggId,
        name: data.name,
      };
    case "notFound":
      return { phase: "notFound", barcode: data.query, kind };
    case "error":
      return { phase: "error", barcode: query, kind, message: data.message };
    default:
      return null;
  }
}
