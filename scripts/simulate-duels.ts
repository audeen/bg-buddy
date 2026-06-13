/**
 * Simulation der Duell-Wertung (GROUP-Phase).
 *
 * Zwei getrennte Achsen, damit nichts doppelt zaehlt:
 *   - pickCount  = wie sehr die Gruppe ein Spiel HEUTE spielen will (Picks).
 *   - quality    = intrinsische Kopf-an-Kopf-Staerke; danach stimmen neutrale
 *                  Richter im Duell ab (mit Rauschen). Unabhaengig von Picks.
 * Endwertung = pickCount + Copeland-Siege.
 *
 * Teil A/B: alte ("Last zuerst") vs. neue ("neutral zuerst") Zuweisung, wenn
 *           ein Spieler sein eigenes Spiel pusht.
 * Teil C:   Lohnt es sich, alle 3 Stimmen auf EIN Spiel zu setzen?
 *
 * Start:  npm run sim:duels
 */
import {
  allPairs,
  assignGroupPairs,
  buildUserPointsMap,
  type DuelPair,
  type DuelPickRow,
  duelParticipantIds,
  userStake,
} from "../lib/duel-pairs";
import { buildCopelandForCount, type DuelVoteRow } from "../lib/copeland";
import { buildPickCounts, poolGameIds } from "../lib/pick-pool";

type Game = { id: number; name: string; q: number };
type Player = { id: string; picks: Record<number, number>; pet: number };
type Scenario = {
  title: string;
  meetupId: string;
  playerCount: number;
  games: Game[];
  players: Player[];
  watch: number; // verfolgtes Aussenseiter-Spiel
};

// Mini-RNG (seedbar, deterministisch).
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Alte Zuweisung (vor dem Fix): Last zuerst, stake nur Tie-Break.
function assignOld(
  pairs: DuelPair[],
  participantIds: string[],
  userPoints: Record<string, Record<number, number>>,
): Record<string, DuelPair[]> {
  const sorted = [...participantIds].sort();
  const assignments: Record<string, DuelPair[]> = {};
  for (const id of sorted) assignments[id] = [];
  if (sorted.length === 0) return assignments;
  for (const pair of pairs) {
    const minLoad = Math.min(...sorted.map((id) => assignments[id].length));
    const candidates = sorted.filter((id) => assignments[id].length === minLoad);
    let chosen = candidates[0];
    let minStake = userStake(chosen, pair, userPoints);
    for (const id of candidates.slice(1)) {
      const stake = userStake(id, pair, userPoints);
      if (stake < minStake || (stake === minStake && id < chosen)) {
        minStake = stake;
        chosen = id;
      }
    }
    assignments[chosen].push(pair);
  }
  return assignments;
}

/**
 * Wie ein Richter ein Paar entscheidet.
 * - Lieblingsspiel im Paar -> Push (immer waehlen).
 * - sonst neutral: das qualitativ bessere Spiel gewinnt, mit Wahrscheinlichkeit
 *   `noise` aber das schwaechere (Rauschen / Geschmack). noise=0.5 = Muenzwurf.
 */
function decide(
  pet: number,
  a: number,
  b: number,
  quality: Record<number, number>,
  rng: () => number,
  noise: number,
): number {
  if (pet === a || pet === b) return pet;
  const qa = quality[a] ?? 0;
  const qb = quality[b] ?? 0;
  const hi = qa > qb ? a : qb > qa ? b : Math.min(a, b);
  const lo = hi === a ? b : a;
  return rng() < noise ? lo : hi;
}

function votesFor(
  assignments: Record<string, DuelPair[]>,
  petById: Map<string, number>,
  quality: Record<number, number>,
  playerCount: number,
  rng: () => number,
  noise: number,
): DuelVoteRow[] {
  const votes: DuelVoteRow[] = [];
  for (const [userId, pairs] of Object.entries(assignments)) {
    const pet = petById.get(userId) ?? -1;
    for (const pair of pairs) {
      const winner = decide(pet, pair.a, pair.b, quality, rng, noise);
      const loser = winner === pair.a ? pair.b : pair.a;
      votes.push({ gameId: winner, opponentGameId: loser, userId, playerCount });
    }
  }
  return votes;
}

function rankCombined(
  pool: number[],
  pickCounts: Record<number, number>,
  votes: DuelVoteRow[],
  playerCount: number,
  totalPairs: number,
  autos: DuelPair[],
  meetupId: string,
): { id: number; combined: number; pick: number; wins: number }[] {
  const { winsByGame } = buildCopelandForCount(votes, playerCount, "GROUP", totalPairs, {
    autoPairs: autos,
    meetupId,
  });
  return pool
    .map((id) => {
      const pick = pickCounts[id] ?? 0;
      const wins = winsByGame[id] ?? 0;
      return { id, combined: pick + wins, pick, wins };
    })
    .sort((x, y) => y.combined - x.combined || x.id - y.id);
}

const qualityMap = (games: Game[]) =>
  Object.fromEntries(games.map((g) => [g.id, g.q]));
const nameOf = (games: Game[], id: number) =>
  games.find((g) => g.id === id)?.name ?? `#${id}`;

function buildPicks(players: Player[]): DuelPickRow[] {
  const picks: DuelPickRow[] = [];
  for (const p of players)
    for (const [gameId, points] of Object.entries(p.picks))
      picks.push({ userId: p.id, gameId: Number(gameId), points });
  return picks;
}

type Prepared = {
  sc: Scenario;
  quality: Record<number, number>;
  pool: number[];
  pickCounts: Record<number, number>;
  participants: string[];
  totalPairs: number;
  petById: Map<string, number>;
  newAssign: Record<string, DuelPair[]>;
  autoPairs: DuelPair[];
  oldAssign: Record<string, DuelPair[]>;
};

function prepare(sc: Scenario): Prepared {
  const picks = buildPicks(sc.players);
  const pickCounts = buildPickCounts(picks);
  const pool = poolGameIds(pickCounts);
  const participants = duelParticipantIds(picks);
  const userPoints = buildUserPointsMap(picks);
  const pairs = allPairs(pool);
  const { assignments, autoPairs } = assignGroupPairs(pairs, participants, userPoints);
  return {
    sc,
    quality: qualityMap(sc.games),
    pool,
    pickCounts,
    participants,
    totalPairs: pairs.length,
    petById: new Map(sc.players.map((p) => [p.id, p.pet])),
    newAssign: assignments,
    autoPairs,
    oldAssign: assignOld(pairs, participants, userPoints),
  };
}

function runOnce(pre: Prepared) {
  const { sc } = pre;
  console.log("\n" + "=".repeat(72));
  console.log(sc.title);
  console.log("=".repeat(72));
  console.log(
    `Pool: ${pre.pool.length} Spiele, ${pre.totalPairs} Paare, ${pre.participants.length} Teilnehmer`,
  );
  const ownPet = (a: Record<string, DuelPair[]>) => {
    let n = 0;
    for (const p of sc.players)
      for (const pr of a[p.id] ?? []) if (pr.a === p.pet || pr.b === p.pet) n++;
    return n;
  };
  console.log(
    `Richtet ueber eigenes Lieblingsspiel  ->  ALT: ${ownPet(pre.oldAssign)}x,  NEU: ${ownPet(pre.newAssign)}x   (NEU muss 0 sein)`,
  );
  const owner = sc.players.find((p) => p.pet === sc.watch);
  if (owner) {
    const watchPairs = (a: Record<string, DuelPair[]>) =>
      (a[owner.id] ?? []).filter((pr) => pr.a === sc.watch || pr.b === sc.watch).length;
    console.log(
      `Pusher "${owner.id}" bekommt ${nameOf(sc.games, sc.watch)}-Paare zugewiesen ` +
        `(= so oft koennte er direkt fuer sein Spiel voten):  ALT ${watchPairs(pre.oldAssign)}x  ->  NEU ${watchPairs(pre.newAssign)}x`,
    );
  }
  console.log(
    `Konflikt-Paare ohne neutralen Richter (per Zufall): ${pre.autoPairs.length}` +
      (pre.autoPairs.length
        ? "  -> " + pre.autoPairs.map((p) => `${nameOf(sc.games, p.a)}|${nameOf(sc.games, p.b)}`).join(", ")
        : ""),
  );
}

function monteCarlo(pre: Prepared, trials: number, noises: number[]) {
  const { sc } = pre;
  const watchName = nameOf(sc.games, sc.watch);
  console.log(
    `\nMonte-Carlo: ${trials} Durchlaeufe je Stufe. Beobachtet: ${watchName} (${pre.pickCounts[sc.watch] ?? 0} Pick, Qualitaet ${pre.quality[sc.watch]}/10).`,
  );
  console.log("noise = Anteil 'falscher' neutraler Urteile (0 = perfekt, 0.5 = Muenzwurf). Pusher waehlt sein Spiel immer.");
  console.log("  noise |  Sieg ALT  ->  Sieg NEU  |  Schnitt-Pkt ALT -> NEU");
  for (const noise of noises) {
    let oldWins = 0, newWins = 0, oldPts = 0, newPts = 0;
    for (let t = 0; t < trials; t++) {
      const vOld = votesFor(pre.oldAssign, pre.petById, pre.quality, sc.playerCount, makeRng(t + 1), noise);
      const vNew = votesFor(pre.newAssign, pre.petById, pre.quality, sc.playerCount, makeRng(t + 1), noise);
      const rOld = rankCombined(pre.pool, pre.pickCounts, vOld, sc.playerCount, pre.totalPairs, [], sc.meetupId);
      const rNew = rankCombined(pre.pool, pre.pickCounts, vNew, sc.playerCount, pre.totalPairs, pre.autoPairs, sc.meetupId);
      if (rOld[0].id === sc.watch) oldWins++;
      if (rNew[0].id === sc.watch) newWins++;
      oldPts += rOld.find((e) => e.id === sc.watch)?.combined ?? 0;
      newPts += rNew.find((e) => e.id === sc.watch)?.combined ?? 0;
    }
    const pct = (n: number) => `${((100 * n) / trials).toFixed(1)}%`.padStart(6);
    console.log(
      `   ${noise.toFixed(2)} |  ${pct(oldWins)}   ->  ${pct(newWins)}   |   ${(oldPts / trials).toFixed(2)} -> ${(newPts / trials).toFixed(2)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Szenarien A/B: ein Spieler pusht ein Spiel mit LOW quality (q3).
// Erwartung: NEU vergraebt es korrekt, ALT bläst es kuenstlich auf.
// ---------------------------------------------------------------------------
const scenario1: Scenario = {
  title: "Szenario 1: 5 Spieler, je 3 Einzel-Picks. E pusht das schwache Agricola (q3).",
  meetupId: "sim-1",
  playerCount: 5,
  watch: 13,
  games: [
    { id: 1, name: "Azul", q: 8 },
    { id: 2, name: "Catan", q: 7 },
    { id: 3, name: "Wingspan", q: 8 },
    { id: 4, name: "Ticket", q: 6 },
    { id: 5, name: "7 Wonders", q: 6 },
    { id: 6, name: "Splendor", q: 5 },
    { id: 7, name: "Carcassonne", q: 5 },
    { id: 8, name: "Patchwork", q: 4 },
    { id: 9, name: "Brass", q: 7 },
    { id: 10, name: "Everdell", q: 6 },
    { id: 13, name: "Agricola", q: 3 },
  ],
  players: [
    { id: "A", picks: { 1: 1, 2: 1, 3: 1 }, pet: 1 },
    { id: "B", picks: { 1: 1, 4: 1, 5: 1 }, pet: 1 },
    { id: "C", picks: { 2: 1, 3: 1, 6: 1 }, pet: 3 },
    { id: "D", picks: { 4: 1, 7: 1, 8: 1 }, pet: 4 },
    { id: "E", picks: { 9: 1, 10: 1, 13: 1 }, pet: 13 },
  ],
};
const scenario2: Scenario = {
  title: "Szenario 2: Kleinerer Pool, Pusher D zieht das schwache Agricola (q3) hoch.",
  meetupId: "sim-2",
  playerCount: 4,
  watch: 7,
  games: [
    { id: 1, name: "Azul", q: 8 },
    { id: 2, name: "Catan", q: 7 },
    { id: 3, name: "Wingspan", q: 8 },
    { id: 4, name: "Ticket", q: 6 },
    { id: 5, name: "Brass", q: 7 },
    { id: 6, name: "Everdell", q: 6 },
    { id: 7, name: "Agricola", q: 3 },
  ],
  players: [
    { id: "A", picks: { 1: 1, 2: 1, 3: 1 }, pet: 1 },
    { id: "B", picks: { 1: 1, 2: 1, 4: 1 }, pet: 2 },
    { id: "C", picks: { 3: 1, 4: 1, 5: 1 }, pet: 5 },
    { id: "D", picks: { 5: 1, 6: 1, 7: 1 }, pet: 7 },
  ],
};

for (const sc of [scenario1, scenario2]) {
  const pre = prepare(sc);
  runOnce(pre);
  monteCarlo(pre, 3000, [0.0, 0.2, 0.35, 0.5]);
}

// ---------------------------------------------------------------------------
// Teil C: Lohnt sich Konzentration? 3 Stimmen auf EIN Spiel (Intensitaet)
// vs. dieselbe Person streut 1+1+1 (Breite). Agricola hat hier DURCHSCHNITTL.
// Qualitaet (q6) -> wir isolieren reinen pickCount-Vorsprung.
// ---------------------------------------------------------------------------
const gamesC: Game[] = [
  { id: 1, name: "Azul", q: 9 }, // 2 Leute je 1 Stimme -> Breite, top Qualitaet
  { id: 2, name: "Catan", q: 8 },
  { id: 3, name: "Wingspan", q: 8 },
  { id: 4, name: "Ticket", q: 5 },
  { id: 5, name: "Brass", q: 7 },
  { id: 6, name: "Everdell", q: 4 },
  { id: 7, name: "Carcassonne", q: 5 },
  { id: 8, name: "Patchwork", q: 4 },
  { id: 13, name: "Agricola", q: 6 }, // E's Spiel, echtes Mittelfeld
  { id: 14, name: "Ramsch", q: 2 }, // schwaches Spiel fuer den Gegentest
];
const qualC = qualityMap(gamesC);
const petC = new Map<string, number>([["A", 1], ["B", 1], ["C", 3], ["D", 5], ["E", 13]]);
const basePicksC: DuelPickRow[] = buildPicks([
  { id: "A", picks: { 1: 1, 2: 1, 3: 1 }, pet: 1 },
  { id: "B", picks: { 1: 1, 4: 1, 5: 1 }, pet: 1 },
  { id: "C", picks: { 2: 1, 3: 1, 6: 1 }, pet: 3 },
  { id: "D", picks: { 4: 1, 5: 1, 6: 1 }, pet: 5 },
]);

type FocalPrep = {
  pickCounts: Record<number, number>;
  pool: number[];
  assignments: Record<string, DuelPair[]>;
  autoPairs: DuelPair[];
  totalPairs: number;
  judgedByE: number;
};
function prepFocal(ePicks: DuelPickRow[]): FocalPrep {
  const picks = [...basePicksC, ...ePicks];
  const pickCounts = buildPickCounts(picks);
  const pool = poolGameIds(pickCounts);
  const participants = duelParticipantIds(picks);
  const userPoints = buildUserPointsMap(picks);
  const pairs = allPairs(pool);
  const { assignments, autoPairs } = assignGroupPairs(pairs, participants, userPoints);
  return {
    pickCounts,
    pool,
    assignments,
    autoPairs,
    totalPairs: pairs.length,
    judgedByE: (assignments["E"] ?? []).length,
  };
}
function focalStats(
  fp: FocalPrep,
  meetupId: string,
  noise: number,
  trials: number,
  watchId: number,
) {
  let wins = 0, pts = 0;
  for (let t = 0; t < trials; t++) {
    const votes = votesFor(fp.assignments, petC, qualC, 5, makeRng(t + 1), noise);
    const r = rankCombined(fp.pool, fp.pickCounts, votes, 5, fp.totalPairs, fp.autoPairs, meetupId);
    if (r[0].id === watchId) wins++;
    pts += r.find((e) => e.id === watchId)?.combined ?? 0;
  }
  return { winPct: (100 * wins) / trials, avgPts: pts / trials };
}

const concentrate = prepFocal([{ userId: "E", gameId: 13, points: 3 }]);
const spread = prepFocal([
  { userId: "E", gameId: 13, points: 1 },
  { userId: "E", gameId: 7, points: 1 },
  { userId: "E", gameId: 8, points: 1 },
]);
// Gegentest: 3 Stimmen auf ein SCHWACHES Spiel (q3).
const concentrateWeak = prepFocal([{ userId: "E", gameId: 14, points: 3 }]);

console.log("\n" + "=".repeat(72));
console.log("Teil C: Lohnt sich Konzentration? (3 Stimmen auf EIN Spiel)");
console.log("=".repeat(72));
console.log("E setzt sein 3er-Budget. Agricola hat DURCHSCHNITTLICHE Qualitaet (q6).");
console.log(
  `\nAgricola pickCount (Start-Vorsprung):  KONZENTRIERT ${concentrate.pickCounts[13] ?? 0}   |  GESTREUT ${spread.pickCounts[13] ?? 0}`,
);
console.log(`Zum Vergleich Azul (2 Leute je 1 Stimme = "Breite"): pickCount ${concentrate.pickCounts[1] ?? 0}, q${qualC[1]}`);
console.log(
  `Paare, die E selbst richten darf:  KONZENTRIERT ${concentrate.judgedByE}   |  GESTREUT ${spread.judgedByE}` +
    `   (durch Last-Ausgleich ~gleich; Konzentration verschafft KEINE Extra-Richtermacht)`,
);
console.log("\n3000 Durchlaeufe je noise-Stufe (NEUE, neutrale Zuweisung):");
console.log("  noise |  Agricola(q6) Sieg: konz.3 -> gestreut1  |  Schnitt-Pkt konz. -> gestreut  ||  Ramsch(q3) konz.3: Sieg / Pkt");
for (const noise of [0.2, 0.35, 0.5]) {
  const c = focalStats(concentrate, "sim-conc", noise, 3000, 13);
  const s = focalStats(spread, "sim-spread", noise, 3000, 13);
  const w = focalStats(concentrateWeak, "sim-weak", noise, 3000, 14);
  const f = (n: number) => n.toFixed(2).padStart(6);
  console.log(
    `   ${noise.toFixed(2)} |       ${f(c.winPct)}% ->  ${f(s.winPct)}%        |    ${f(c.avgPts)} -> ${f(s.avgPts)}    ||   ${f(w.winPct)}% / ${f(w.avgPts)}`,
  );
}

console.log("\nsimulate-duels: fertig.\n");
