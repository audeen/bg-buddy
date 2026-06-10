/** Erweiterungs-Familie des Sieger-Spiels für Pflicht-Erweiterungen. */
export type MandatoryExpansionFamily = {
  baseGameId: number;
  baseGameName: string;
  expansions: { id: number; name: string }[];
};
