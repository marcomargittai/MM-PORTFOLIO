import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, GOO_UNIT, PULL_UNIT, YUGA_PULL } from "./prefs";
import {
  cellBodyHalf,
  cellsNeedPull,
  cellsShareEdge,
  coalesceField,
  glueBodyHalf,
  innerNotchFillet,
  liveCore,
  liveField,
  pairIsLNotch,
  pullBlobScale,
  pullKCells,
  sdRoundBox,
  smin,
} from "./magnetism";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`ok   ${name}`);
  }
}

const lightPull = 0.1;
const lockedPull = DEFAULT_PULL / PULL_UNIT;
const lockedGoo = DEFAULT_GOO / GOO_MAX;
const yugaPull = YUGA_PULL / PULL_UNIT;
const L: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
];
const BAR: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
];
const T: Array<[number, number]> = [
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 0],
];
const GAP: Array<[number, number]> = [
  [0, 0],
  [2, 0],
];
const DIAG: Array<[number, number]> = [
  [0, 0],
  [1, 1],
];
const FAT: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
];

const midGoo = 80 / 300;
const highGoo = 0.9;
const notch = (p: number, g = midGoo) => liveField(1.22, 1.22, L, p, g);
const hair = notch(0.01);
const dryNotch = notch(0);
const yugaNotch = notch(yugaPull);
const yugaWaist = liveField(1.5, 0.5, BAR, yugaPull, midGoo);
const yugaCrotch = liveField(1.15, 0.85, T, yugaPull, 0.5);
const barMid = liveField(1.5, 1.0, BAR, yugaPull, highGoo);
const barJoint = liveField(1.0, 1.0, BAR, yugaPull, highGoo);
const gapDry = liveField(1.5, 0.5, GAP, 0, highGoo);
const gapYuga = liveField(1.5, 0.5, GAP, yugaPull, highGoo);

check("Pull 0 is a hard union", pullKCells(0) === 0);
check("slider 1 is a hair of glue", pullKCells(0.01) > 0 && pullKCells(0.01) < 0.03);
check("slider 10 is still a light weld", pullKCells(lightPull) < 0.15);
check("locked Pull 43 is a moderate weld", Math.abs(pullKCells(lockedPull) - 0.43 * 1.05) < 1e-9);
check("Yuga Pull (100) is a full weld", Math.abs(pullKCells(yugaPull) - 1.05) < 1e-9);
check("max Pull is about two cells", Math.abs(pullKCells(2) - 2.1) < 1e-9);
check("k rises linearly", pullKCells(0.5) * 2 - pullKCells(1) === 0);
check("blob scale at 0 is a tile", Math.abs(pullBlobScale(0) - 0.5) < 1e-9);
check("an 8-neighbor stays a tile, not a swollen drop", cellBodyHalf(lockedPull, false, true) === 0.5);
check("a lone drop may swell with Pull", cellBodyHalf(lockedPull, false, false) > 0.5);
check("a diagonal glue body stays tile-sized", glueBodyHalf(lockedPull, [0, 0], [1, 1]) === 0.5);
check("a gap glue body stays tile-sized", glueBodyHalf(lockedPull, [0, 0], [2, 0]) === 0.5);
check("smin of equals is a - k/4", Math.abs(smin(1, 1, 0.8) - (1 - 0.2)) < 1e-9);
check(
  "a lone tile does not occupy the next cell center",
  sdRoundBox(1, 0, 0.5, 0.5, 0) > 0.4,
);
check("adjacent tiles share an edge", cellsShareEdge([0, 0], [1, 0]));
check("a gap needs Pull", cellsNeedPull([0, 0], [2, 0]));
check("a diagonal needs Pull", cellsNeedPull([0, 0], [1, 1]));
check("an edge does not need Pull", !cellsNeedPull([0, 0], [1, 0]));
check(
  "a solid 3-bar does not pull its ends together",
  !cellsNeedPull([0, 0], [2, 0], (x, y) => BAR.some(([cx, cy]) => cx === x && cy === y)),
);
check(
  "a vacant 3-span still needs Pull",
  cellsNeedPull([0, 0], [2, 0], (x, y) => (x === 0 || x === 2) && y === 0),
);

check(
  "without Pull the rounded L-notch stays open",
  dryNotch > 0,
  `d=${dryNotch.toFixed(3)}`,
);
check(
  "slider 1 does not close the L-notch",
  hair > 0,
  `d=${hair.toFixed(3)} k=${pullKCells(0.01).toFixed(3)}`,
);
const lightDiag = liveField(1.0, 1.0, DIAG, lightPull, highGoo);
const yugaDiag = liveField(1.0, 1.0, DIAG, yugaPull, highGoo);
check(
  "Pull 10 is only a light kiss on a diagonal, not a Yuga weld",
  lightDiag > yugaDiag + 0.1,
  `light=${lightDiag.toFixed(3)} yuga=${yugaDiag.toFixed(3)}`,
);
check(
  "slider 1 is only a hair tighter than off on a diagonal",
  liveField(1.0, 1.0, DIAG, 0.01, highGoo) > liveField(1.0, 1.0, DIAG, 0, highGoo) - 0.08,
);
check(
  "an L diagonal is a notch the fillet owns",
  pairIsLNotch([1, 0], [0, 1], (x, y) => L.some(([cx, cy]) => cx === x && cy === y)),
);
check(
  "a lone diagonal is not an L-notch",
  !pairIsLNotch([0, 0], [1, 1], (x, y) => (x === 0 && y === 0) || (x === 1 && y === 1)),
);
check(
  "Yuga Pull does not bead an L-notch past its fillet",
  Math.abs(yugaNotch - dryNotch) < 1e-9,
  `pull=${yugaNotch.toFixed(3)} fillet=${dryNotch.toFixed(3)}`,
);
check(
  "a 3-bar waist at Yuga stays a solid bar, not a sausage pinch",
  yugaWaist < -0.4,
  `d=${yugaWaist.toFixed(3)}`,
);
check(
  "a 3-bar at high Goo+Pull keeps a straight side",
  Math.abs(barMid - barJoint) < 0.04,
  `mid=${barMid.toFixed(3)} joint=${barJoint.toFixed(3)}`,
);
check("a T crotch at Yuga is glued", yugaCrotch < 0, `d=${yugaCrotch.toFixed(3)}`);
check(
  "a one-cell gap stays open without Pull",
  gapDry > 0,
  `d=${gapDry.toFixed(3)}`,
);
check(
  "Yuga Pull bridges a one-cell gap",
  gapYuga < gapDry - 0.15,
  `dry=${gapDry.toFixed(3)} yuga=${gapYuga.toFixed(3)}`,
);
check(
  "an isolated cell does not become a neighbor-sized drop",
  liveField(1.5, 0.5, [[0, 0]], 0.8, midGoo) > 0.1,
  `d=${liveField(1.5, 0.5, [[0, 0]], 0.8, midGoo).toFixed(3)}`,
);
const loneEdge = liveField(1.02, 0.5, [[0, 0]], lockedPull, lockedGoo);
const diagEdge = liveField(1.02, 0.5, DIAG, lockedPull, lockedGoo);
check(
  "a lone drop is slightly fatter than a diagonal pair at the same Pull",
  loneEdge < diagEdge - 0.01,
  `lone=${loneEdge.toFixed(3)} diag=${diagEdge.toFixed(3)}`,
);

const diagNeck = liveField(1.0, 1.0, DIAG, yugaPull, highGoo);
const lIntoNotch = liveField(1.22, 1.22, L, yugaPull, highGoo);
const fatIntoNotch = liveField(2.22, 0.78, FAT, yugaPull, highGoo);
const midPull = 0.55;
const diagMid = liveField(1.0, 1.0, DIAG, midPull, highGoo);
const fatMid = liveField(2.0, 1.0, [[1, 0], [2, 1]], midPull, highGoo);
const fatMidWithBody = liveField(2.0, 1.0, FAT, midPull, highGoo);
check(
  "a lone diagonal welds at Yuga",
  diagNeck < 0,
  `d=${diagNeck.toFixed(3)}`,
);
check(
  "Yuga + high Goo still leaves the L a notch, not a 2x2",
  lIntoNotch > 0 && fatIntoNotch > 0,
  `L=${lIntoNotch.toFixed(3)} fat=${fatIntoNotch.toFixed(3)}`,
);
check(
  "a fat L-notch is not much drier than a simple L",
  Math.abs(fatIntoNotch - lIntoNotch) < 0.16,
  `L=${lIntoNotch.toFixed(3)} fat=${fatIntoNotch.toFixed(3)}`,
);
check(
  "the rest of a blob does not dry a diagonal weld",
  fatMidWithBody <= fatMid + 0.02,
  `lone=${fatMid.toFixed(3)} in-blob=${fatMidWithBody.toFixed(3)} mid=${diagMid.toFixed(3)}`,
);
const lockedNotch = liveField(1.22, 1.22, L, lockedPull, lockedGoo);
const lockedDry = liveField(1.22, 1.22, L, 0, lockedGoo);
const lockedBarMid = liveField(1.5, 1.0, BAR, lockedPull, lockedGoo);
const lockedBarJoint = liveField(1.0, 1.0, BAR, lockedPull, lockedGoo);
const lockedFat = liveField(2.22, 0.78, FAT, lockedPull, lockedGoo);
check(
  "locked Goo 140 is the slider look, not a full disk",
  lockedGoo > 0.4 && lockedGoo < 0.55,
);
check(
  "locked Pull does not bead an L-notch past its fillet",
  Math.abs(lockedNotch - lockedDry) < 1e-9,
  `pull=${lockedNotch.toFixed(3)} fillet=${lockedDry.toFixed(3)}`,
);
check(
  "locked L-notch stays a notch, not a fill",
  lockedNotch > 0,
  `d=${lockedNotch.toFixed(3)}`,
);
const lockedCrotch = liveField(1.1, 1.1, L, lockedPull, lockedGoo);
const dryCrotch = liveField(1.1, 1.1, L, 0, lockedGoo);
check(
  "locked L crotch is a CAD fillet, not a vertex pie",
  lockedCrotch > 0 && Math.abs(lockedCrotch - dryCrotch) < 1e-9,
  `d=${lockedCrotch.toFixed(3)} dry=${dryCrotch.toFixed(3)}`,
);
const lockedFillet = liveField(1.04, 1.04, L, lockedPull, lockedGoo);
const sharpInner = liveField(1.04, 1.04, L, lockedPull, 0);
check(
  "locked L inner corner is rounded, not a leftover square",
  lockedFillet < 0 && sharpInner > 0,
  `fillet=${lockedFillet.toFixed(3)} sharp=${sharpInner.toFixed(3)}`,
);
const filletRad = lockedGoo * 0.5;
const axisRay = innerNotchFillet(1 + filletRad + 0.18, 1.02, L, filletRad);
check(
  "a CAD fillet does not throw an axis hairline past its radius",
  axisRay > 1,
  `d=${axisRay.toFixed(3)}`,
);
const coreNotch = liveCore(1.22, 1.22, L, lockedPull, lockedGoo);
check(
  "liveCore matches the L-notch without glue",
  Math.abs(coreNotch - lockedNotch) < 1e-9,
  `core=${coreNotch.toFixed(3)} full=${lockedNotch.toFixed(3)}`,
);
check(
  "locked look keeps a 3-bar side straight",
  Math.abs(lockedBarMid - lockedBarJoint) < 0.04,
  `mid=${lockedBarMid.toFixed(3)} joint=${lockedBarJoint.toFixed(3)}`,
);
const stem: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [1, 2],
  [1, 3],
  [0, 0],
  [2, 3],
];
const stemMid = liveField(2.0, 1.5, stem, lockedPull, lockedGoo);
const stemJoint = liveField(2.0, 1.0, stem, lockedPull, lockedGoo);
check(
  "a 2-of-4 side does not scallop from gap glue",
  Math.abs(stemMid - stemJoint) < 0.02,
  `mid=${stemMid.toFixed(3)} joint=${stemJoint.toFixed(3)}`,
);
check(
  "locked look does not dry a fat L-notch vs a simple L",
  lockedFat <= lockedNotch + 0.08,
  `fat=${lockedFat.toFixed(3)} L=${lockedNotch.toFixed(3)}`,
);

const neck = coalesceField(1.0, 0.5, [[1, 0]], { cx: 0, cy: 0, scale: 0.7, ox: 0.35 }, yugaPull, 0.4);
const hardNeck = liveField(1.0, 0.5, [[1, 0]], yugaPull, 0.4);
check(
  "a sucked drop welds into the survivor instead of sitting beside it",
  neck < 0 && neck < hardNeck,
  `neck=${neck.toFixed(3)} body=${hardNeck.toFixed(3)}`,
);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("magnetism tests passed");
