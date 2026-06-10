/** Eintrag einer Rangliste (Picks, Duelle, Erweiterungen). */
export interface RankEntry {
  id: number;
  name: string;
  thumbnail: string | null;
  points: number;
  voters: number;
  pickCount?: number;
  duelWins?: number;
}
