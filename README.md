# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

Roughly in the editorial language of Better Half / Cult Holdings: sparse type, no dashboard chrome, the field is the page.

## Local clone, remote on GitHub

The repo **lives on GitHub** (the remote). You **clone** it onto the Mac (a local working copy). You **look at it locally** with `npm run dev` + Dia. You **push** commits so the cloud copy stays current. Cloud agents then `pull`. That is the whole loop — not the VM desktop.

```bash
git clone https://github.com/marcomargittai/mm-life.git
cd mm-life
npm install
npm run dev
```

Open **http://127.0.0.1:43173** in Dia. Use a **local** Cursor agent for anything you need to see. After a change you want saved: commit and push to `origin`.

```bash
npm test
npm run lint
```

## Play

- **Draw** on the field. Click a live cell to erase; drag to paint.
- **Play / Pause**, **Step**, **Clear**, **Chance**
- **Pace** — generations per second, 1–60
- **Goo** — live liquid melt. Drag it, then **Keep** to save the value (tell me the number later and I’ll lock it in)
- **Inspirations** — load Gosper’s gun, the pulsar, acorn, copperhead, the fleet, and the rest

Keyboard: `Space` play/pause · arrows step · `C` clear · `R` chance · `I` inspirations · `+` / `-` pace · `Esc` close

The board is a torus. Edges wrap.

## Stack

Next.js, TypeScript, Tailwind. The simulation is a typed-array engine. New cells grow out of the live neighbors they attach to, so a birth is a nub on an existing blob rather than a satellite that pops from its own center. Adjacent cells fillet; distant clusters do not.
