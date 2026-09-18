import { LifeEngine, PATTERN_BLINKER } from "./engine";
import {
  birthOffset,
  birthScale,
  birthTravel,
  easeInOut,
  dyingDissolveFade,
  dyingDissolveScale,
  dyingSuckScale,
  dyingTravel,
  growthWiggle,
  liquidEase,
  wiggleOccupancy,
  survivorPull,
} from "./death";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`ok   ${name}`);
  }
}

function settledReader(prev: Uint8Array, engine: LifeEngine) {
  return (x: number, y: number) => {
    const i = engine.index(x, y);
    return prev[i] === 1 && engine.cells[i] === 1;
  };
}

const blinker = new LifeEngine(8, 8);
blinker.stampPattern(PATTERN_BLINKER, 2, 2);
const blinkerPrev = new Uint8Array(blinker.cells);
blinker.step();
const blinkerSettled = settledReader(blinkerPrev, blinker);

const left = survivorPull(blinkerSettled, 2, 3);
const right = survivorPull(blinkerSettled, 4, 3);
const center = survivorPull(blinkerSettled, 3, 3);

check("blinker left wing is dying", blinkerPrev[blinker.index(2, 3)] === 1 && blinker.get(2, 3) === 0);
check("blinker center survives", blinker.get(3, 3) === 1 && blinkerPrev[blinker.index(3, 3)] === 1);
check(
  "dying blinker wing sucks toward the survivor",
  left != null && left.dx > 0.9 && Math.abs(left.dy) < 1e-9,
  `pull=${JSON.stringify(left)}`,
);
check(
  "other wing sucks the other way",
  right != null && right.dx < -0.9 && Math.abs(right.dy) < 1e-9,
  `pull=${JSON.stringify(right)}`,
);
check("a survivor is not pulled", center == null);
const bornTop = survivorPull(blinkerSettled, 3, 2);
check(
  "a born blinker cell grows out of the survivor",
  bornTop != null && Math.abs(bornTop.dx) < 1e-9 && bornTop.dy > 0.9,
  `pull=${JSON.stringify(bornTop)}`,
);

const lone = new LifeEngine(8, 8);
lone.set(4, 4, 1);
const lonePrev = new Uint8Array(lone.cells);
lone.step();
check(
  "a lone death has no survivor to suck into",
  survivorPull(settledReader(lonePrev, lone), 4, 4) == null,
);

const pair = new LifeEngine(8, 8);
pair.set(3, 3, 1);
pair.set(4, 3, 1);
const pairPrev = new Uint8Array(pair.cells);
pair.step();
check(
  "two dying neighbors both dissolve — neither survives",
  survivorPull(settledReader(pairPrev, pair), 3, 3) == null &&
    survivorPull(settledReader(pairPrev, pair), 4, 3) == null,
);

const block = new LifeEngine(8, 8);
block.set(3, 3, 1);
block.set(4, 3, 1);
block.set(3, 4, 1);
block.set(4, 4, 1);
const blockPrev = new Uint8Array(block.cells);
block.step();
check(
  "a still-life cell still has settled neighbors",
  block.get(3, 3) === 1 && survivorPull(settledReader(blockPrev, block), 3, 3) != null,
);

check("travel starts at home", dyingTravel(0) === 0);
check("travel ends at the neighbor", dyingTravel(1) === 1);
check("suck scale starts full", dyingSuckScale(0) === 1);
check("suck scale ends gone", Math.abs(dyingSuckScale(1)) < 1e-9);
check("mid suck is still a drop, not a speck", dyingSuckScale(0.5) > 0.6);
check("birth starts on the neighbor", birthTravel(0) === 1);
check("birth starts as a bulge, not a speck", birthScale(0) > 0.6 && birthScale(0) < 0.75);
check("birth ends at home full size", birthTravel(1) === 0 && birthScale(1) === 1);
const fromParent = { dx: 0, dy: 1 };
check(
  "birth offset sits on the parent, not past the new cell",
  birthOffset(fromParent, 0).dy === 1 && birthOffset(fromParent, 0).dx === 0,
);
check(
  "birth offset lands at home",
  birthOffset(fromParent, 1).dx === 0 && birthOffset(fromParent, 1).dy === 0,
);
check(
  "birth moves outward from the parent",
  birthOffset(fromParent, 0.5).dy > 0.4 && birthOffset(fromParent, 0.5).dy < 0.6,
);
check("ease-in-out starts and ends still", easeInOut(0) === 0 && easeInOut(1) === 1);
check("ease-in-out is still at the ends", easeInOut(0.01) < 0.02 && easeInOut(0.99) > 0.98);
check("liquid ease matches the generation mix", liquidEase(0.25) === easeInOut(0.25));
check("liquid ease dumps at a quarter", Math.abs(liquidEase(0.25) - 47 / 128) < 1e-12);
check("liquid ease is mostly done by half", Math.abs(liquidEase(0.5) - 13 / 16) < 1e-12);
check("liquid ease film is almost rest at 3/4", Math.abs(liquidEase(0.75) - 63 / 64) < 1e-12);
check("a still board does not wiggle", growthWiggle(0.4, 0) === 0);
check("wiggle is still at both rests", growthWiggle(0, 3) === 0 && growthWiggle(1, 3) === 0);
check("wiggle is live before the dump", Math.abs(growthWiggle(0.2, 2, 1 / 12)) > 0.05);
check("wiggle is live after the dump", Math.abs(growthWiggle(0.35, 2, 1 / 12)) > 0.05);
check("wiggle spans the morph at play speed", Math.abs(growthWiggle(0.7, 2, 1 / 12)) > 0.08);
check("wiggle is a real occupancy bump at 12/s", Math.abs(growthWiggle(0.5, 2, 1 / 12)) > 0.08);
check("slow morph still rings at mid-step", Math.abs(growthWiggle(0.5, 2, 1)) > 0.2);
check("fast morph still offsets the silhouette", Math.abs(growthWiggle(0.65, 2, 1 / 60)) > 0.15);
check("off occupancy term is zero", wiggleOccupancy(1, 1, 0) === 0 && wiggleOccupancy(0, 1, 0) === 0);
check(
  "births take more occupancy than stay",
  wiggleOccupancy(0, 1, 0.3) > wiggleOccupancy(1, 1, 0.3) &&
    wiggleOccupancy(1, 1, 0.3) > wiggleOccupancy(1, 0, 0.3),
);
check("dissolve fade starts solid", dyingDissolveFade(0) === 1);
check("dissolve fade ends gone", dyingDissolveFade(1) === 0);
check("mid dissolve keeps most of its size", Math.abs(dyingDissolveScale(0.5) - 0.91) < 1e-9);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("death tests passed");
