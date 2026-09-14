# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

Roughly in the editorial language of Better Half / Cult Holdings: sparse type, no dashboard chrome, the field is the page.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:43173](http://localhost:43173).

```bash
npm test    # engine + pattern invariants
npm run lint
```

## Play

- **Draw** on the field. Click a live cell to erase; drag to paint.
- **Play / Pause**, **Step**, **Clear**, **Chance**
- **Pace** — generations per second, 1–60
- **Inspirations** — load Gosper’s gun, the pulsar, acorn, copperhead, the fleet, and the rest

Keyboard: `Space` play/pause · arrows step · `C` clear · `R` chance · `I` inspirations · `+` / `-` pace · `Esc` close

The board is a torus. Edges wrap.

## Stack

Next.js, TypeScript, Tailwind. The simulation is a typed-array engine; the liquid look is a WebGL2 smooth-union of rounded boxes, with a Canvas2D gooey fallback.
