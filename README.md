# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

## How we work

The chat stays in the cloud. The files and the browser stay on the Mac.

Leave `npm run dev` open at **http://127.0.0.1:43173**. Run the Cloud Agent on **My Machines** in this repo. I edit those files; Next hot-reloads the tab you already have open. No pull. No tunnel.

One-time on the Mac, then you only talk:

```bash
git clone https://github.com/marcomargittai/mm-life.git
cd mm-life
npm install
npm run dev          # leave this running
agent worker start   # leave this running
```

Then start the next cloud chat with **Marco's MacBook Pro** selected. If this project is not on GitHub yet, click **Create repo** first so the worker can attach to it.

GitHub Pages still publishes `main` if you want a URL that is not localhost.

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
