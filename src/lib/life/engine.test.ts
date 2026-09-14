import { buffersEqual, LifeEngine, runLifeInvariantTests } from "./engine";
import { findPattern, patternCells } from "./patterns";
import { decodeRle } from "./rle";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`ok   ${name}`);
  }
}

for (const result of runLifeInvariantTests()) {
  check(result.name, result.passed);
}

const pulsar = decodeRle(`x = 13, y = 13, rule = B3/S23
2b3o3b3o2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2$2b3o3b3o$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!`);
check("pulsar decode", pulsar.width === 13 && pulsar.height === 13 && pulsar.cells.length === 48, `${pulsar.width}x${pulsar.height} n=${pulsar.cells.length}`);

const gun = decodeRle(`x = 36, y = 9, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!`);
check("gosper decode", gun.width === 36 && gun.height === 9 && gun.cells.length === 36, `${gun.width}x${gun.height} n=${gun.cells.length}`);

const pulsarEngine = new LifeEngine(24, 24);
pulsarEngine.stampPattern(pulsar.cells, 4, 4);
const pulsar0 = pulsarEngine.cells.slice();
pulsarEngine.step();
pulsarEngine.step();
pulsarEngine.step();
check("pulsar period 3", buffersEqual(pulsar0, pulsarEngine.cells) && pulsarEngine.generation === 3);

const gunEngine = new LifeEngine(80, 40);
gunEngine.stampPattern(gun.cells, 4, 8);
const gunPop0 = gunEngine.liveCount();
for (let i = 0; i < 30; i++) gunEngine.step();
check(
  "gosper emits a glider in 30 ticks",
  gunEngine.liveCount() === gunPop0 + 5,
  `pop ${gunPop0} → ${gunEngine.liveCount()}`,
);

const catalogGun = findPattern("gosper-glider-gun");
check("catalog has gosper", Boolean(catalogGun));
if (catalogGun) {
  const cells = patternCells(catalogGun);
  check("catalog gosper cells", cells.cells.length === 36 && cells.width === 36);
}

const fleet = findPattern("fleet");
check("catalog has fleet", Boolean(fleet));
if (fleet) {
  const cells = patternCells(fleet);
  check("fleet is a composed setup", cells.cells.length >= 9 + 11 + 13 && cells.height >= 16);
}

if (failed > 0) {
  process.exit(1);
}

console.log("all life invariants passed");
