/** Public BGG page for a board game thing (id = BGG objectid). */
export function bggBoardgameUrl(id: number): string {
  return `https://boardgamegeek.com/boardgame/${id}`;
}
