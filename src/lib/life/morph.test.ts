import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "./prefs";
import { liveCore, liveField, sdRoundBox } from "./magnetism";
import {
  FAR_DIST,
  FLUSH_DIST,
  cornerWeight,
  morphField,
  neighborFlush,
  pairShouldSmin,
  pairShouldStretch,
  sitWeight,
  stretchAmount,
  stretchSd,
  visualCenter,
  skelFlux,
  SKEL_REST_FLUX,
  waterField,
  type MorphCell,
} from "./morph";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`ok   ${name}`);
  }
}

const lockedPull = DEFAULT_PULL / PULL_UNIT;
const lockedGoo = DEFAULT_GOO / GOO_MAX;
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
const FAT: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
];

const lockedNotch = liveField(1.22, 1.22, L, lockedPull, lockedGoo);
const lockedDry = liveField(1.22, 1.22, L, 0, lockedGoo);
const lockedBarMid = liveField(1.5, 1.0, BAR, lockedPull, lockedGoo);
const lockedBarJoint = liveField(1.0, 1.0, BAR, lockedPull, lockedGoo);
const lockedFat = liveField(2.22, 0.78, FAT, lockedPull, lockedGoo);

check("locked Goo is 140/300", DEFAULT_GOO === 140 && Math.abs(lockedGoo - 140 / 300) < 1e-12);
check("locked Pull is 43/100", DEFAULT_PULL === 43 && Math.abs(lockedPull - 0.43) < 1e-12);
check(
  "settled liveField at Goo 140 / Pull 43 is still the slider look, not a disk",
  lockedGoo > 0.4 && lockedGoo < 0.55,
);
check(
  "settled liveField does not bead an L-notch past its fillet",
  Math.abs(lockedNotch - lockedDry) < 1e-9,
  `pull=${lockedNotch.toFixed(3)} fillet=${lockedDry.toFixed(3)}`,
);
check(
  "settled liveField keeps the locked L-notch open",
  lockedNotch > 0,
  `d=${lockedNotch.toFixed(3)}`,
);
check(
  "settled liveField still keeps a 3-bar side straight",
  Math.abs(lockedBarMid - lockedBarJoint) < 0.04,
  `mid=${lockedBarMid.toFixed(3)} joint=${lockedBarJoint.toFixed(3)}`,
);
check(
  "settled liveField still does not dry a fat L-notch vs a simple L",
  lockedFat <= lockedNotch + 0.08,
  `fat=${lockedFat.toFixed(3)} L=${lockedNotch.toFixed(3)}`,
);

const parentHome = { x: 0, y: 0 };
const childHome = { x: 0, y: 1 };
const pull = { dx: 0, dy: -1 };

const birth0 = visualCenter(childHome, pull, 0, "birth");
check(
  "t=0 birth is on the parent",
  Math.abs(birth0.x - parentHome.x) < 1e-12 && Math.abs(birth0.y - parentHome.y) < 1e-12,
  `center=${JSON.stringify(birth0)}`,
);

const birth1 = visualCenter(childHome, pull, 1, "birth");
check(
  "t=1 birth equals home",
  Math.abs(birth1.x - childHome.x) < 1e-12 && Math.abs(birth1.y - childHome.y) < 1e-12,
  `center=${JSON.stringify(birth1)}`,
);

const stayParent = visualCenter(parentHome, { dx: 0, dy: 0 }, 1, "stay");
const distSettled = Math.hypot(birth1.x - stayParent.x, birth1.y - stayParent.y);
check(
  "two settled ortho cells sit one cell apart",
  Math.abs(distSettled - FLUSH_DIST) < 1e-12 && neighborFlush(distSettled),
  `dist=${distSettled}`,
);
check(
  "two settled ortho cells at dist=1 do not smin",
  !pairShouldSmin(1, distSettled),
  `dist=${distSettled}`,
);

const birthMid = visualCenter(childHome, pull, 0.5, "birth");
const distMid = Math.hypot(birthMid.x - stayParent.x, birthMid.y - stayParent.y);
check(
  "mid birth is half a cell from the parent",
  Math.abs(distMid - 0.5) < 1e-12,
  `dist=${distMid} center=${JSON.stringify(birthMid)}`,
);
check(
  "a birth at dist=0.5 from parent does smin",
  pairShouldSmin(1, distMid),
  `dist=${distMid}`,
);
check("overlapping ortho is not flush", !neighborFlush(distMid));

check("a settled diagonal still smins", pairShouldSmin(2, Math.SQRT2));
check("a one-cell gap still smins", pairShouldSmin(2, 2));

check("cornerWeight is 0 when the neighbor is flush", cornerWeight(FLUSH_DIST) === 0);
check(
  "cornerWeight is 1 when the neighbor is gone/far",
  cornerWeight(FAR_DIST) === 1 && cornerWeight(10) === 1,
);
check("cornerWeight stays square while overlapping", cornerWeight(0.5) === 0);
check("flush distance is one cell", FLUSH_DIST === 1);

const death0 = visualCenter(childHome, { dx: 0, dy: -1 }, 0, "death");
const death1 = visualCenter(childHome, { dx: 0, dy: -1 }, 1, "death");
check(
  "t=0 death is at home",
  Math.abs(death0.x - childHome.x) < 1e-12 && Math.abs(death0.y - childHome.y) < 1e-12,
);
check(
  "t=1 death is on the survivor",
  Math.abs(death1.x - parentHome.x) < 1e-12 && Math.abs(death1.y - parentHome.y) < 1e-12,
);
check(
  "mid death smins into the survivor like a birth in reverse",
  pairShouldSmin(1, 0.5),
);
check("overlapping ortho should stretch, not sausage", pairShouldStretch(1, 0.5));
check("flush ortho should not stretch", !pairShouldStretch(1, 1));
check("stretch amount is full while overlapping", stretchAmount(0.5) > 0.99);
check("stretch amount is gone past flush", stretchAmount(1.05) < 1e-6);
check("a tile still covering the waist keeps sit high", sitWeight(0.5) > 0.9);
check("sit is gone before a diagonal midpoint", sitWeight(0.66) < 1e-6);
check("a diagonal birth does not stretch", !pairShouldStretch(2, 0.5));

const rad = lockedGoo * 0.5;
const stretch0 = stretchSd(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, rad);
const oneTile = sdRoundBox(0, 0, 0.5, 0.5, rad);
check("axis stretch at dist 0 is one Goo tile", Math.abs(stretch0 - oneTile) < 1e-12);
const stretchHalf = stretchSd(1.25, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, lockedGoo * 0.5);
check(
  "axis stretch at dist 0.5 is a 1.5-cell Goo rect",
  stretchHalf < -0.2,
  `waist=${stretchHalf.toFixed(3)}`,
);
const stretchLand = stretchSd(1.0, 0.5, 0.5, 0.5, 1.5, 0.5, 0.5, lockedGoo * 0.5);
check(
  "axis stretch at dist 1 is the flush 2-cell bar",
  stretchLand < -0.4,
  `bar=${stretchLand.toFixed(3)}`,
);

const parent: MorphCell = { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } };
const child: MorphCell = { x: 0, y: 1, role: "birth", pull: { dx: 0, dy: -1 } };
const stayL: MorphCell[] = [
  { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 0, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
];

const stayNotch = morphField(1.22, 1.22, stayL, 0.4, lockedPull, lockedGoo);
check(
  "stay-only morphField matches settled liveField",
  Math.abs(stayNotch - lockedNotch) < 1e-9,
  `morph=${stayNotch.toFixed(4)} live=${lockedNotch.toFixed(4)}`,
);

const bornLanded = morphField(0.5, 1.5, [parent, child], 1, lockedPull, lockedGoo);
const bornSettled = liveField(0.5, 1.5, [[0, 0], [0, 1]], lockedPull, lockedGoo);
check(
  "t=1 birth field matches the landed pair",
  Math.abs(bornLanded - bornSettled) < 0.06,
  `morph=${bornLanded.toFixed(3)} live=${bornSettled.toFixed(3)}`,
);

const outline: Array<[number, number]> = [
  [0.5, -0.02],
  [1.08, 0.5],
  [0.5, 1.55],
];
let birthJump = 0;
for (const [px, py] of outline) {
  let prev = morphField(px, py, [parent, child], 0, lockedPull, lockedGoo);
  for (let i = 1; i <= 16; i++) {
    const next = morphField(px, py, [parent, child], i / 16, lockedPull, lockedGoo);
    birthJump = Math.max(birthJump, Math.abs(next - prev));
    prev = next;
  }
}
check(
  "birth outline does not snap across the step",
  birthJump < 0.22,
  `maxJump=${birthJump.toFixed(3)}`,
);

const waistMid = morphField(0.95, 0.85, [parent, child], 0.5, lockedPull, lockedGoo);
check(
  "mid birth waist is a filled droplet, not a crease",
  waistMid < 0.02,
  `waist=${waistMid.toFixed(3)}`,
);

const barStay: MorphCell[] = [
  { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 0, role: "death", pull: { dx: -1, dy: 0 } },
  { x: 2, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
];
const dyingBar0 = morphField(1.5, 1.0, barStay, 0.05, lockedPull, lockedGoo);
const gapNow = liveField(1.5, 1.0, [[0, 0], [2, 0]], lockedPull, lockedGoo);
check(
  "a dying 3-bar middle has not become a gap at t=0.05",
  dyingBar0 < gapNow - 0.04,
  `dying=${dyingBar0.toFixed(3)} gap=${gapNow.toFixed(3)}`,
);

const stayBar: MorphCell[] = [
  { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 2, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
];
const liveBarCenter = liveField(1.5, 0.5, BAR, lockedPull, lockedGoo);
const liveBarSide = liveField(1.5, 1.0, BAR, lockedPull, lockedGoo);
check(
  "stay-only 3-bar center matches liveField",
  Math.abs(morphField(1.5, 0.5, stayBar, 1, lockedPull, lockedGoo) - liveBarCenter) < 1e-9,
);
check(
  "stay-only 3-bar side matches liveField at mid t",
  Math.abs(morphField(1.5, 1.0, stayBar, 0.3, lockedPull, lockedGoo) - liveBarSide) < 1e-9,
);

const blinker: MorphCell[] = [
  { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 0, y: 0, role: "death", pull: { dx: 1, dy: 0 } },
  { x: 2, y: 0, role: "death", pull: { dx: -1, dy: 0 } },
  { x: 1, y: -1, role: "birth", pull: { dx: 0, dy: 1 } },
  { x: 1, y: 1, role: "birth", pull: { dx: 0, dy: -1 } },
];
check(
  "blinker wing is still there at t=0.05",
  morphField(0.5, 0.5, blinker, 0.05, lockedPull, lockedGoo) < -0.4,
  `f=${morphField(0.5, 0.5, blinker, 0.05, lockedPull, lockedGoo).toFixed(3)}`,
);
const blinkerNe40 = morphField(2.0, 0.0, blinker, 0.4, lockedPull, lockedGoo);
const blinkerNe45 = morphField(2.0, 0.0, blinker, 0.45, lockedPull, lockedGoo);
check(
  "blinker survivor corner does not pop across t=0.425",
  Math.abs(blinkerNe45 - blinkerNe40) < 0.02,
  `Δ=${Math.abs(blinkerNe45 - blinkerNe40).toFixed(3)}`,
);
const blinkerNe60 = morphField(2.0, 0.0, blinker, 0.6, lockedPull, lockedGoo);
const blinkerNe65 = morphField(2.0, 0.0, blinker, 0.65, lockedPull, lockedGoo);
const blinkerE60 = morphField(2.05, 0.5, blinker, 0.6, lockedPull, lockedGoo);
const blinkerE65 = morphField(2.05, 0.5, blinker, 0.65, lockedPull, lockedGoo);
check(
  "blinker does not iso-grow pop across t=0.625",
  Math.abs(blinkerNe65 - blinkerNe60) < 0.05 && Math.abs(blinkerE65 - blinkerE60) < 0.05,
  `neΔ=${Math.abs(blinkerNe65 - blinkerNe60).toFixed(3)} eΔ=${Math.abs(blinkerE65 - blinkerE60).toFixed(3)}`,
);

const glider: MorphCell[] = [
  { x: 2, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 2, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 2, y: 2, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 3, role: "birth", pull: { dx: 0, dy: -1 } },
];
check(
  "glider birth mid-step is one droplet",
  morphField(1.95, 2.75, glider, 0.5, lockedPull, lockedGoo) < -0.1,
  `neck=${morphField(1.95, 2.75, glider, 0.5, lockedPull, lockedGoo).toFixed(3)}`,
);
const gliderLand = morphField(1.5, 3.5, glider, 1, lockedPull, lockedGoo);
const gliderSettled = liveField(1.5, 3.5, [[2, 1], [1, 2], [2, 2], [1, 3]], lockedPull, lockedGoo);
check(
  "glider birth lands on liveField",
  Math.abs(gliderLand - gliderSettled) < 0.06,
  `morph=${gliderLand.toFixed(3)} live=${gliderSettled.toFixed(3)}`,
);

const dissolveBar: MorphCell[] = [
  { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 0, role: "death", pull: { dx: 0, dy: 0 } },
  { x: 2, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
];
const gapField = liveField(1.5, 0.5, [[0, 0], [2, 0]], lockedPull, lockedGoo);
const dissolveWaist = morphField(1.5, 0.5, dissolveBar, 0.05, lockedPull, lockedGoo);
const dissolveSide = morphField(1.5, 1.0, dissolveBar, 0.05, lockedPull, lockedGoo);
check(
  "dissolving 3-bar middle is still a bar at t=0.05",
  dissolveWaist < -0.35 && dissolveWaist < gapField - 0.6,
  `waist=${dissolveWaist.toFixed(3)} gap=${gapField.toFixed(3)}`,
);
check(
  "dissolving 3-bar side stays straight at t=0.05",
  dissolveSide < 0.05,
  `side=${dissolveSide.toFixed(3)}`,
);
const dissolveLand = morphField(1.5, 0.5, dissolveBar, 1, lockedPull, lockedGoo);
const dissolveSideLand = morphField(1.5, 1.0, dissolveBar, 1, lockedPull, lockedGoo);
const gapSide = liveField(1.5, 1.0, [[0, 0], [2, 0]], lockedPull, lockedGoo);
check(
  "dissolving 3-bar lands on the gap",
  Math.abs(dissolveLand - gapField) < 0.06 && Math.abs(dissolveSideLand - gapSide) < 0.06,
  `waist=${dissolveLand.toFixed(3)} side=${dissolveSideLand.toFixed(3)}`,
);

const lFill: MorphCell[] = [
  { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 0, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
  { x: 1, y: 1, role: "birth", pull: { dx: -0.5, dy: -0.5 } },
];
const lVertex = liveField(1.0, 1.0, L, lockedPull, lockedGoo);
const squareVertex = liveField(1.0, 1.0, [...L, [1, 1]], lockedPull, lockedGoo);
const fill0 = morphField(1.0, 1.0, lFill, 0, lockedPull, lockedGoo);
const fill60 = morphField(1.0, 1.0, lFill, 0.6, lockedPull, lockedGoo);
const fill62 = morphField(1.0, 1.0, lFill, 0.62, lockedPull, lockedGoo);
const fill65 = morphField(1.0, 1.0, lFill, 0.65, lockedPull, lockedGoo);
const fill1 = morphField(1.0, 1.0, lFill, 1, lockedPull, lockedGoo);
check(
  "L-fill starts at least as wet as the L-notch",
  fill0 <= lVertex + 0.02,
  `f0=${fill0.toFixed(3)} L=${lVertex.toFixed(3)}`,
);
check(
  "L-fill fillet is still on at t=0.62",
  fill62 < -0.08,
  `f62=${fill62.toFixed(3)}`,
);
check(
  "L-fill fillet does not pop across t=0.625",
  Math.abs(fill65 - fill60) < 0.05,
  `Δ=${Math.abs(fill65 - fill60).toFixed(3)}`,
);
check(
  "L-fill lands on the square",
  Math.abs(fill1 - squareVertex) < 0.06,
  `f1=${fill1.toFixed(3)} sq=${squareVertex.toFixed(3)}`,
);

check("rest flux floor is a quarter dump leftover", Math.abs(SKEL_REST_FLUX - 1 / 9) < 1e-12);
check("landed glue keeps the t=0.75 blur kernel", Math.abs(skelFlux(1) - 1 / 9) < 1e-12);
check("takeoff glue keeps the same rest kernel", Math.abs(skelFlux(0) - 1 / 9) < 1e-12);
check("a still board stays on the rest kernel at mid-step", skelFlux(0.25, true) === SKEL_REST_FLUX);
check(
  "a changing board keeps rest glue thickness at dump",
  Math.abs(skelFlux(0.25, false) - SKEL_REST_FLUX) < 1e-12,
);
check("glue thickness does not track morph time", skelFlux(0.25, false) === skelFlux(1));

const water0 = waterField(0.5, 0.5, BAR, BAR, 0, lockedPull, lockedGoo);
const water1 = waterField(0.5, 0.5, BAR, [[1, 0]], 1, lockedPull, lockedGoo);
const liveBar0 = liveField(0.5, 0.5, BAR, lockedPull, lockedGoo);
const liveTile = liveField(0.5, 0.5, [[1, 0]], lockedPull, lockedGoo);
check(
  "water t=0 is the previous rest field",
  Math.abs(water0 - liveBar0) < 1e-9,
  `w=${water0.toFixed(4)} live=${liveBar0.toFixed(4)}`,
);
check(
  "water t=1 has left a vacated tile",
  water1 > 0 && liveTile > 0,
  `w=${water1.toFixed(4)} live=${liveTile.toFixed(4)}`,
);
const block: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];
const blockIn = (t: number) => waterField(0.5, 0.5, block, block, t, lockedPull, lockedGoo);
check(
  "a still-life block tile stays wet at mid-step",
  blockIn(0) < 0 && blockIn(0.5) < 0 && blockIn(1) < 0,
  `t0=${blockIn(0).toFixed(4)} mid=${blockIn(0.5).toFixed(4)} t1=${blockIn(1).toFixed(4)}`,
);
check(
  "a still-life block does not breathe its tile",
  Math.abs(blockIn(0) - blockIn(0.5)) < 1e-9 && Math.abs(blockIn(0.5) - blockIn(1)) < 1e-9,
  `t0=${blockIn(0).toFixed(4)} mid=${blockIn(0.5).toFixed(4)} t1=${blockIn(1).toFixed(4)}`,
);
const parentIn = waterField(0.5, 0.5, [[0, 0]], [[0, 0], [1, 0]], 0.45, lockedPull, lockedGoo);
check(
  "an ortho birth keeps the parent tile wet",
  parentIn < 0,
  `parent=${parentIn.toFixed(3)}`,
);
const slidePrev: Array<[number, number]> = [[0, 0]];
const slideNext: Array<[number, number]> = [[1, 0]];
const slideEdge = waterField(1, 0.5, slidePrev, slideNext, 0.5, lockedPull, lockedGoo);
const slideSliver =
  liveCore(1, 0.5, slidePrev, lockedPull, lockedGoo) < 0 &&
  liveCore(1, 0.5, slideNext, lockedPull, lockedGoo) < 0;
check(
  "a one-cell slide overlaps both expanded cores at the surviving edge",
  slideSliver,
);
check(
  "a one-cell slide does not hold that surviving edge as a rest core",
  slideEdge === -0.25 || slideEdge === 0.25,
  `edge=${slideEdge.toFixed(4)}`,
);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("morph tests passed");
