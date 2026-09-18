import { buffersEqual, LifeEngine } from "./engine";
import { LifeLoop, SETTLE_DURATION } from "./loop";

let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  } else {
    console.log(`ok   ${name}`);
  }
}

function blinker(): LifeEngine {
  const engine = new LifeEngine(5, 5);
  engine.set(1, 2, 1);
  engine.set(2, 2, 1);
  engine.set(3, 2, 1);
  return engine;
}

function flush(loop: LifeLoop, seconds: number) {
  const step = 1 / 60;
  let left = seconds;
  while (left > 0) {
    const dt = left < step ? left : step;
    loop.tick(dt);
    left -= dt;
  }
}

function midMorph(speed = 10) {
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed });
  loop.align();
  const previous = new Uint8Array(engine.cells);
  engine.step();
  loop.previous = previous;
  loop.blend = 0.3;
  loop.playing = true;
  return { engine, loop, generation: engine.generation };
}

{
  const { engine, loop, generation } = midMorph();
  loop.pause();
  check("pause mid-blend stops play", loop.playing === false);
  check("pause mid-blend settles instead of snapping", loop.settling === true && Math.abs(loop.blend - 0.3) < 1e-9);
  check("pause mid-blend does not step", engine.generation === generation);

  loop.tick(0.01);
  const afterTick = loop.blend;
  const expected = 0.3 + (0.7 / SETTLE_DURATION) * 0.01;
  check("pause eases remaining blend over settle duration", Math.abs(afterTick - expected) < 1e-9);
  check("pause settle is slower than play speed", afterTick < 0.35);
  check("settle does not step the engine", engine.generation === generation && loop.settling);

  flush(loop, 1);
  check("settle lands on blend 1", loop.blend === 1 && !loop.settling);
  check("settle still does not step", engine.generation === generation);
  check("settle copies current into previous", buffersEqual(loop.previous, engine.cells));
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 8 });
  loop.align();
  const gen = engine.generation;
  loop.pause();
  check("pause at rest does not settle", loop.settling === false && loop.blend === 1);
  check("pause at rest does not step", engine.generation === gen);
}

{
  const { engine, loop, generation } = midMorph(12);
  loop.pause();
  loop.play();
  check("play cancels settle", loop.playing && !loop.settling);
  const before = engine.generation;
  flush(loop, 1);
  check("resume after cancel continues stepping", engine.generation > before && engine.generation >= generation);
  loop.stop();
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  const gen = engine.generation;
  loop.stepOnce();
  check("stepOnce starts a morph", loop.settling && loop.blend === 0 && engine.generation === gen + 1);
  flush(loop, 1);
  check("stepOnce lands aligned", loop.blend === 1 && !loop.settling && buffersEqual(loop.previous, engine.cells));
  loop.stop();
}

{
  const { loop } = midMorph();
  loop.pause();
  loop.align();
  check("align aborts settle", !loop.settling && loop.blend === 1);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stamp(0, 0, 1);
  const i = engine.index(0, 0);
  const stay = engine.index(1, 2);
  check("paint at rest lands in both buffers", loop.previous[i] === 1 && engine.get(0, 0) === 1);
  check("paint at rest stays aligned", loop.blend === 1 && !loop.settling);
  check("paint at rest does not snap the rest of the field", loop.previous[stay] === 1 && engine.get(1, 2) === 1);
  loop.tick(1 / 30);
  check("paint at rest does not start a grow morph", loop.blend === 1 && !loop.settling);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stamp(2, 2, 0);
  const i = engine.index(2, 2);
  check("erase at rest clears both buffers", loop.previous[i] === 0 && engine.get(2, 2) === 0);
  check("erase at rest stays aligned", loop.blend === 1 && !loop.settling);
  check("erase does not snap neighbors", engine.get(1, 2) === 1 && loop.previous[engine.index(1, 2)] === 1);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stampLine(0, 0, 2, 0, 1);
  check(
    "drag lands every cell in previous and current",
    [0, 1, 2].every((x) => loop.previous[engine.index(x, 0)] === 1 && engine.get(x, 0) === 1),
  );
  check("drag does not rewind blend", loop.blend === 1 && !loop.settling);
  check("drag dirty lists every cell before emit", loop.dirty.length === 3 && loop.paintOverlay);
  const drag = loop.tick(1 / 60);
  check("drag overlay emits all three cells", drag.paintOverlay && drag.dirty.length === 3);
  check("drag overlay does not rebuild the field", drag.rebuildField === false);
  check("overlay emit consumes dirty", loop.dirty.length === 0 && loop.paintOverlay);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stamp(0, 0, 1);
  const first = loop.tick(1 / 60);
  check("rest stamp marks overlay", first.paintOverlay === true && first.rebuildField === false);
  check(
    "rest stamp lists the dirty cell",
    first.dirty.length === 1 && first.dirty[0].x === 0 && first.dirty[0].y === 0 && first.dirty[0].value === 1,
  );
  check("overlay stays armed after emit", loop.paintOverlay === true && loop.dirty.length === 0);
  const idle = loop.tick(1 / 60);
  check("idle overlay frame has no dirty tiles", idle.paintOverlay && idle.dirty.length === 0 && !idle.rebuildField);

  loop.stamp(1, 0, 1);
  const next = loop.tick(1 / 60);
  check("next stamp only lists new dirty", next.dirty.length === 1 && next.dirty[0].x === 1 && next.paintOverlay);

  loop.endStroke();
  check("endStroke disarms overlay", loop.paintOverlay === false && loop.dirty.length === 0);
  check("endStroke asks for a rebuild", loop.rebuildField === true);
  const rebuilt = loop.tick(1 / 60);
  check("rebuild flag is delivered once", rebuilt.rebuildField === true && rebuilt.paintOverlay === false);
  check("rebuild flag clears after emit", loop.rebuildField === false);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stamp(0, 0, 1);
  loop.tick(1 / 60);
  loop.play();
  check("play drops overlay", loop.paintOverlay === false && loop.dirty.length === 0);
  loop.stop();
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.beginStroke();
  loop.stamp(-1, 0, 1);
  const wrapped = loop.tick(1 / 60);
  check(
    "wrapped stamp stays in-bounds",
    wrapped.dirty.length === 1 && wrapped.dirty[0].x === 4 && wrapped.dirty[0].y === 0,
  );
  loop.stepOnce();
  check("step drops overlay", loop.paintOverlay === false && loop.dirty.length === 0);
  loop.stop();
}

{
  const { engine, loop } = midMorph();
  const held = loop.blend;
  loop.beginStroke();
  loop.stamp(0, 0, 1);
  check("paint mid-morph does not rewind blend", Math.abs(loop.blend - held) < 1e-9);
  check("paint mid-morph lands in both buffers", engine.get(0, 0) === 1 && loop.previous[engine.index(0, 0)] === 1);
  check("paint mid-morph does not copy the whole current into previous", loop.previous[engine.index(1, 2)] === 1);
  check("paint mid-morph does not overlay dirty tiles", loop.paintOverlay === false);
  flush(loop, 1);
  check("paint mid-morph settles without a snap", loop.blend === 1 && engine.get(0, 0) === 1);
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.play();
  loop.blend = 0.995;
  const g = engine.generation;
  loop.tick(1 / 60);
  check("play holds a completed generation before stepping", loop.blend === 1 && engine.generation === g);
  loop.tick(1 / 60);
  check("play takes one step on the following frame", engine.generation === g + 1 && loop.blend === 0);
  loop.stop();
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 12 });
  loop.align();
  loop.play();
  const g0 = engine.generation;
  const info = loop.tick(0.25);
  check("a hitch never takes more than one step", info.steps <= 1);
  check("a hitch never skips a generation", engine.generation <= g0 + 1);
  loop.stop();
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 24 });
  loop.align();
  loop.play();
  let maxSteps = 0;
  for (let i = 0; i < 120; i++) {
    const info = loop.tick(1 / 60);
    if (info.steps > maxSteps) maxSteps = info.steps;
  }
  check("steady play never double-steps", maxSteps <= 1);
  check("steady play still advances", engine.generation > 0);
  loop.stop();
}

{
  const engine = blinker();
  const loop = new LifeLoop({ engine, speed: 10 });
  loop.align();
  loop.pause();
  loop.nudge();
  check("nudge can wake an idle loop", true);
  loop.stop();
}

if (failed > 0) {
  process.exit(1);
}

console.log("all loop tests passed");
