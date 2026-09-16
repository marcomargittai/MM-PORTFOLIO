# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

## How we work

This chat stays in the cloud. You look at the site on the Mac.

1. I commit and push from here.
2. On the Mac: `git pull && npm run dev`
3. Open **http://127.0.0.1:43173** in Dia.

That is the loop. No tunnels.

If the project is not on GitHub yet, click **Create repo** so `origin` is `github.com/marcomargittai/mm-life`. After that the Mac can clone or pull.

```bash
git clone https://github.com/marcomargittai/mm-life.git
cd mm-life
npm install
npm run dev
```

Every push to `main` also publishes GitHub Pages, so there is a URL that does not die with a cloud VM.

## Play

- **Draw** on the field. Click a live cell to erase; drag to paint.
- **Play / Pause**, **Step**, **Clear**, **Chance**
- **Pace** — generations per second, 1–60
- **Goo** — corner radius, from tile to disk
- **Pull** — how neighbors melt together
- **Inspirations** — Gosper’s gun, the pulsar, acorn, copperhead, the fleet

Keyboard: `Space` play/pause · arrows step · `C` clear · `R` chance · `I` inspirations · `+` / `-` pace · `Esc` close

The board is a torus. Edges wrap.

## Stack

Next.js, TypeScript, Tailwind. The simulation is a typed-array engine. New cells grow out of the live neighbors they attach to. A dying cell shrinks away instead of drawing a tube.
