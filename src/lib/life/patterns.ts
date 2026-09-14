import { decodeRle, mergeDecoded, type Cell } from "./rle";

export type PatternCategory =
  | "still-life"
  | "oscillator"
  | "spaceship"
  | "gun"
  | "methuselah"
  | "puffer"
  | "setup";

export interface LifePattern {
  id: string;
  name: string;
  category: PatternCategory;
  period?: number;
  description: string;
  featured?: boolean;
  rle?: string;
  parts?: { rle: string; x: number; y: number }[];
}

const R = {
  block: "x = 2, y = 2, rule = B3/S23\n2o$2o!",
  beehive: "x = 4, y = 3, rule = B3/S23\nb2o$o2bo$b2o!",
  loaf: "x = 4, y = 4, rule = B3/S23\nb2o$o2bo$bobo$2bo!",
  tub: "x = 3, y = 3, rule = B3/S23\nbo$obo$bo!",
  blinker: "x = 3, y = 1, rule = B3/S23\n3o!",
  toad: "x = 4, y = 2, rule = B3/S23\nb3o$3o!",
  beacon: "x = 4, y = 4, rule = B3/S23\n2o$o$3bo$2b2o!",
  clock: "x = 4, y = 4, rule = B3/S23\n2bo$obo$bobo$bo!",
  pulsar: `x = 13, y = 13, rule = B3/S23
2b3o3b3o2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2$2b3o3b3o$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!`,
  figureEight: `x = 6, y = 6, rule = B3/S23
2o$2obo$4bo$bo$2bob2o$4b2o!`,
  koksGalaxy: `x = 9, y = 9, rule = B3/S23
2bo2bobo$2obob3o$bo6bo$2o5bo2$bo5b2o$o6bo$b3obob2o$bobo2bo!`,
  tumbler: `x = 9, y = 5, rule = B3/S23
bo5bo$obo3bobo$o2bobo2bo$2bo3bo$2b2ob2o!`,
  pentadecathlon: `x = 10, y = 3, rule = B3/S23
2bo4bo$2ob4ob2o$2bo4bo!`,
  queenBee: `x = 22, y = 7, rule = B3/S23
9bo$7bobo$6bobo$2o3bo2bo11b2o$2o4bobo11b2o$7bobo$9bo!`,
  twinBees: `x = 29, y = 11, rule = B3/S23
17b2o$2o15bobo7b2o$2o17bo7b2o$17b3o4$17b3o$2o17bo$2o15bobo$17b2o!`,
  glider: "x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!",
  lwss: "x = 5, y = 4, rule = B3/S23\nbo2bo$o$o3bo$4o!",
  mwss: "x = 6, y = 5, rule = B3/S23\n3bo$bo3bo$o$o4bo$5o!",
  hwss: "x = 7, y = 5, rule = B3/S23\n3b2o$bo4bo$o$o5bo$6o!",
  loafer: `x = 9, y = 9, rule = B3/S23
b2o2bob2o$o2bo2b2o$bobo$2bo$8bo$6b3o$5bo$6bo$7b2o!`,
  copperhead: `x = 8, y = 12, rule = B3/S23
b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!`,
  weekender: `x = 16, y = 11, rule = B3/S23
bo12bo$bo12bo$obo10bobo$bo12bo$bo12bo$2bo3b4o3bo$6b4o$2b4o4b4o2$4bo6bo$5b2o2b2o!`,
  gosper: `x = 36, y = 9, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!`,
  simkin: `x = 33, y = 14, rule = B3/S23
2o5b2o$2o5b2o2$4b2o$4b2o5$22b2ob2o$21bo5bo$21bo6bo2b2o$21b3o3bo3b2o$26bo!`,
  rpentomino: "x = 3, y = 3, rule = B3/S23\nb2o$2o$bo!",
  diehard: "x = 8, y = 3, rule = B3/S23\n6bo$2o$bo3b3o!",
  acorn: "x = 7, y = 3, rule = B3/S23\nbo$3bo$2o2b3o!",
  rabbits: "x = 7, y = 3, rule = B3/S23\no3b3o$3o2bo$bo!",
  switchEngine: "x = 6, y = 4, rule = B3/S23\nbobo$o$bo2bo$3b3o!",
  puffer1: `x = 27, y = 7, rule = B3/S23
b3o6bo5bo6b3o$o2bo5b3o3b3o5bo2bo$3bo4b2obo3bob2o4bo$3bo19bo$3bo2bo13bo2bo$3bo2b2o11b2o2bo$2bo3b2o11b2o3bo!`,
  puffer2: `x = 18, y = 5, rule = B3/S23
b3o11b3o$o2bo10bo2bo$3bo4b3o6bo$3bo4bo2bo5bo$2bo4bo8bo!`,
  dart: `x = 15, y = 10, rule = B3/S23
7bo$6bobo$5bo3bo$6b3o2$4b2o3b2o$2bo3bobo3bo$b2o3bobo3b2o$o5bobo5bo$bob2obobob2obo!`,
  pufferfish: `x = 15, y = 12, rule = B3/S23
3bo7bo$2b3o5b3o$b2o2bo3bo2b2o$3b3o3b3o2$4bo5bo$2bo2bo3bo2bo$o5bobo5bo$2o4bobo4b2o$6bobo$3bobo3bobo$4bo5bo!`,
  thunderbird: "x = 3, y = 5, rule = B3/S23\n3o2$bo$bo$bo!",
  bheptomino: "x = 4, y = 3, rule = B3/S23\nob2o$3o$bo!",
  piheptomino: "x = 3, y = 3, rule = B3/S23\n3o$obo$obo!",
  smiley: `x = 7, y = 7, rule = B3/S23
3ob3o$bobobo2$bo3bo2$obobobo$2bobo!`,
  achimsP16: `x = 13, y = 13, rule = B3/S23
6b2o$6bobo$bo4bob2o$2o5bo$o2bo$3o2$10b3o$9bo2bo$4bo5b2o$2b2obo4bo$3bobo$4b2o!`,
  unix: `x = 8, y = 8, rule = B3/S23
b2o$b2o2$bo$obo$o2bo2b2o$4bob2o$2b2o!`,
  pinwheel: `x = 12, y = 12, rule = B3/S23
6b2o$6b2o2$4b4o$2obo4bo$2obo2bobo$3bo3b2ob2o$3bobo2bob2o$4b4o2$4b2o$4b2o!`,
};

export const PATTERNS: LifePattern[] = [
  {
    id: "gosper-glider-gun",
    name: "The Gun",
    category: "gun",
    period: 30,
    featured: true,
    description: "Two queen bees arguing forever, throwing a glider into the dark every thirty ticks.",
    rle: R.gosper,
  },
  {
    id: "simkin-glider-gun",
    name: "Simkin Gun",
    category: "gun",
    period: 120,
    featured: true,
    description: "A compact Herschel loop with two barrels — Life’s smallest double stream.",
    rle: R.simkin,
  },
  {
    id: "pulsar",
    name: "Pulsar",
    category: "oscillator",
    period: 3,
    featured: true,
    description: "A twelve-armed star that inhales and exhales every three heartbeats.",
    rle: R.pulsar,
  },
  {
    id: "pentadecathlon",
    name: "Pentadecathlon",
    category: "oscillator",
    period: 15,
    featured: true,
    description: "A bar that learned to juggle itself through fifteen shapes.",
    rle: R.pentadecathlon,
  },
  {
    id: "koks-galaxy",
    name: "Kok’s Galaxy",
    category: "oscillator",
    period: 8,
    featured: true,
    description: "A pinwheel of eight-fold fire, flinging sparks from every corner.",
    rle: R.koksGalaxy,
  },
  {
    id: "acorn",
    name: "Acorn",
    category: "methuselah",
    featured: true,
    description: "Seven quiet seeds that wait, then forest a whole board.",
    rle: R.acorn,
  },
  {
    id: "r-pentomino",
    name: "R-Pentomino",
    category: "methuselah",
    featured: true,
    description: "Five cells that refuse to settle — an 1103-generation opera.",
    rle: R.rpentomino,
  },
  {
    id: "copperhead",
    name: "Copperhead",
    category: "spaceship",
    period: 10,
    featured: true,
    description: "A stubby snake of a ship, inching upward like a coin on its edge.",
    rle: R.copperhead,
  },
  {
    id: "weekender",
    name: "Weekender",
    category: "spaceship",
    period: 7,
    featured: true,
    description: "A wide, winged thing that lurches two cells every weekend of seven ticks.",
    rle: R.weekender,
  },
  {
    id: "fleet",
    name: "The Fleet",
    category: "setup",
    period: 4,
    featured: true,
    description: "Lightweight, middleweight, and heavyweight — a navy planing west.",
    parts: [
      { rle: R.hwss, x: 0, y: 0 },
      { rle: R.mwss, x: 2, y: 8 },
      { rle: R.lwss, x: 4, y: 16 },
    ],
  },
  {
    id: "queen-bee-shuttle",
    name: "Queen Bee",
    category: "oscillator",
    period: 30,
    featured: true,
    description: "A honeybee of cells ferrying between two blocks, sparking the void.",
    rle: R.queenBee,
  },
  {
    id: "diehard",
    name: "Diehard",
    category: "methuselah",
    featured: true,
    description: "Seven cells with a death wish, vanishing without a trace on tick 130.",
    rle: R.diehard,
  },
  {
    id: "pufferfish",
    name: "Pufferfish",
    category: "puffer",
    period: 12,
    featured: true,
    description: "A nearly-natural engine that drops pairs of blocks in its wake.",
    rle: R.pufferfish,
  },
  {
    id: "dart",
    name: "Dart",
    category: "spaceship",
    period: 3,
    featured: true,
    description: "A pointed c/3 hull, nose first, cutting a clean line through the field.",
    rle: R.dart,
  },
  {
    id: "garden",
    name: "Garden",
    category: "setup",
    featured: true,
    description: "A composed print: pulsar, pentadecathlon, galaxy, and a few still lives.",
    parts: [
      { rle: R.pulsar, x: 0, y: 0 },
      { rle: R.pentadecathlon, x: 20, y: 5 },
      { rle: R.koksGalaxy, x: 20, y: 16 },
      { rle: R.beehive, x: 0, y: 18 },
      { rle: R.loaf, x: 6, y: 18 },
      { rle: R.block, x: 12, y: 19 },
    ],
  },
  {
    id: "glider",
    name: "Glider",
    category: "spaceship",
    period: 4,
    featured: true,
    description: "The smallest traveler: a five-cell kite that walks forever.",
    rle: R.glider,
  },
  {
    id: "glider-squadron",
    name: "Squadron",
    category: "setup",
    period: 4,
    featured: true,
    description: "Four gliders in a loose diagonal — the Life logo, set in motion.",
    parts: [
      { rle: R.glider, x: 0, y: 0 },
      { rle: R.glider, x: 8, y: 6 },
      { rle: R.glider, x: 16, y: 12 },
      { rle: R.glider, x: 24, y: 18 },
    ],
  },
  {
    id: "rabbits",
    name: "Rabbits",
    category: "methuselah",
    featured: true,
    description: "Nine cells that breed a long chaos before the field finally goes still.",
    rle: R.rabbits,
  },
  {
    id: "switch-engine",
    name: "Switch Engine",
    category: "methuselah",
    featured: true,
    description: "Corderman’s diagonal ghost — eight cells copying themselves into exhaust.",
    rle: R.switchEngine,
  },
  {
    id: "twin-bees-shuttle",
    name: "Twin Bees",
    category: "oscillator",
    period: 46,
    featured: true,
    description: "A pair of B-heptominoes slamming sparks between distant blocks.",
    rle: R.twinBees,
  },
  {
    id: "loafer",
    name: "Loafer",
    category: "spaceship",
    period: 7,
    featured: true,
    description: "A tiny c/7 walker, loaf-like and unhurried, padding as if it had all day.",
    rle: R.loafer,
  },
  {
    id: "puffer-2",
    name: "Puffer 2",
    category: "puffer",
    period: 140,
    featured: true,
    description: "Two lightweight escorts dragging a B-heptomino that never stops littering.",
    rle: R.puffer2,
  },
  {
    id: "figure-eight",
    name: "Figure Eight",
    category: "oscillator",
    period: 8,
    description: "Two blocks that learned to tumble around each other like a knotted beacon.",
    rle: R.figureEight,
  },
  {
    id: "tumbler",
    name: "Tumbler",
    category: "oscillator",
    period: 14,
    description: "A gymnast of sixteen cells, flipping for fourteen ticks and never falling.",
    rle: R.tumbler,
  },
  {
    id: "smiley",
    name: "Smiley",
    category: "oscillator",
    period: 8,
    description: "A compact face that blinks — found in a soup, kept as a joke that works.",
    rle: R.smiley,
  },
  {
    id: "achims-p16",
    name: "Achim’s p16",
    category: "oscillator",
    period: 16,
    description: "A rotating, pulsing core that takes sixteen beats to remember itself.",
    rle: R.achimsP16,
  },
  {
    id: "pinwheel",
    name: "Pinwheel",
    category: "oscillator",
    period: 4,
    description: "A period-4 rotor held by four blocks, turning in place since 1970.",
    rle: R.pinwheel,
  },
  {
    id: "unix",
    name: "Unix",
    category: "oscillator",
    period: 6,
    description: "The smallest period-6 oscillator — two blocks eating a long barge.",
    rle: R.unix,
  },
  {
    id: "lightweight-spaceship",
    name: "Lightweight",
    category: "spaceship",
    period: 4,
    description: "A nine-cell hull planing west at half lightspeed.",
    rle: R.lwss,
  },
  {
    id: "middleweight-spaceship",
    name: "Middleweight",
    category: "spaceship",
    period: 4,
    description: "The middle sibling, one spark heavier, still skimming like a thrown blade.",
    rle: R.mwss,
  },
  {
    id: "heavyweight-spaceship",
    name: "Heavyweight",
    category: "spaceship",
    period: 4,
    description: "The big brother of the fleet: a six-wide prow throwing a white wake.",
    rle: R.hwss,
  },
  {
    id: "puffer-1",
    name: "Puffer 1",
    category: "puffer",
    period: 128,
    description: "Gosper’s first dirty engine — two ships dragging wreckage through the void.",
    rle: R.puffer1,
  },
  {
    id: "thunderbird",
    name: "Thunderbird",
    category: "methuselah",
    description: "A T of five cells that blooms, then settles into a small still garden.",
    rle: R.thunderbird,
  },
  {
    id: "b-heptomino",
    name: "B-Heptomino",
    category: "methuselah",
    description: "The restless seven that starts so many engines.",
    rle: R.bheptomino,
  },
  {
    id: "pi-heptomino",
    name: "Pi-Heptomino",
    category: "methuselah",
    description: "A pi of seven cells — the other famous spark of chaos.",
    rle: R.piheptomino,
  },
  {
    id: "blinker",
    name: "Blinker",
    category: "oscillator",
    period: 2,
    description: "Three cells that cannot choose a direction.",
    rle: R.blinker,
  },
  {
    id: "toad",
    name: "Toad",
    category: "oscillator",
    period: 2,
    description: "Two triples breathing against each other.",
    rle: R.toad,
  },
  {
    id: "beacon",
    name: "Beacon",
    category: "oscillator",
    period: 2,
    description: "Two blocks taking turns remembering the other is there.",
    rle: R.beacon,
  },
  {
    id: "clock",
    name: "Clock",
    category: "oscillator",
    period: 2,
    description: "Six cells turning the smallest hour-hand Life ever wound.",
    rle: R.clock,
  },
  {
    id: "block",
    name: "Block",
    category: "still-life",
    period: 1,
    description: "Four cells in a square that have already arrived at forever.",
    rle: R.block,
  },
  {
    id: "beehive",
    name: "Beehive",
    category: "still-life",
    period: 1,
    description: "Six cells curled into a honeycomb.",
    rle: R.beehive,
  },
  {
    id: "loaf",
    name: "Loaf",
    category: "still-life",
    period: 1,
    description: "A seven-cell bun, content to sit and be bread.",
    rle: R.loaf,
  },
];

export function patternCells(pattern: LifePattern): { width: number; height: number; cells: Cell[] } {
  if (pattern.parts?.length) {
    return mergeDecoded(
      pattern.parts.map((part) => ({
        cells: decodeRle(part.rle).cells,
        ox: part.x,
        oy: part.y,
      })),
    );
  }
  if (!pattern.rle) return { width: 0, height: 0, cells: [] };
  return decodeRle(pattern.rle);
}

export function featuredPatterns(): LifePattern[] {
  return PATTERNS.filter((p) => p.featured);
}

export function findPattern(id: string): LifePattern | undefined {
  return PATTERNS.find((p) => p.id === id);
}
