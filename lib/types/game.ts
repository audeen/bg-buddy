import type { GameTagSource } from "@/lib/game-tags";

/** Minimale Spieldaten für Karten-Darstellungen (GameCard u. a.). */
export interface GameCardGame extends GameTagSource {
  id: number;
  name: string;
  thumbnail: string | null;
  image: string | null;
  isExpansion?: boolean;
}

/** Vollständige Spieldaten für Detail-Ansichten (GameDetailView u. a.). */
export interface GameDetailData {
  id: number;
  name: string;
  year: number | null;
  description: string | null;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  playingTime: number | null;
  weight: number | null;
  bggRating: number | null;
  ageRange: string | null;
  isExpansion: boolean;
  categories: string[];
  mechanics: string[];
  bestPlayerCounts: number[];
  recommendedPlayerCounts: number[];
}
