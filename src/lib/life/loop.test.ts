import { buffersEqual, LifeEngine } from "./engine";
import { LifeLoop } from "./loop";

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
  check("settle advances at play speed", Math.abs(loop.blend - 0.4) < 1e-9);
  check("settle does not step the engine", engine.generation === generation && loop.settling);

  loop.tick(1);
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
  loop.tick(1);
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
  loop.tick(1);
  check("stepOnce lands aligned", loop.blend === 1 && !loop.settling && buffersEqual(loop.previous, engine.cells));
  loop.stop();
}

{
  const { loop } = midMorph();
  loop.pause();
  loop.align();
  check("align aborts settle", !loop.settling && loop.blend === 1);
}

if (failed > 0) {
  process.exit(1);
}

console.log("all loop tests passed");
