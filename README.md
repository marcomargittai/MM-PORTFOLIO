# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

## How we work

You build in **Cursor Cloud** (hosted, not My Machines). The agent commits to GitHub. A login item on the Mac pulls `main` about once a minute. It sleeps when there is nothing new, skips if you have local edits, and never runs Next or an agent worker.

The site URL is GitHub Pages on `main`. You do not need a terminal, `npm run dev`, or `agent worker start`.

Repo: [github.com/marcomargittai/MM-Portfolio](https://github.com/marcomargittai/MM-Portfolio)

On the Mac the puller is already installed as `com.marco.mm-portfolio-pull`. Pause it with:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.marco.mm-portfolio-pull.plist
```

Bring it back with:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.marco.mm-portfolio-pull.plist
```

When a Cloud Agent is done, have it push or merge to `main`. That is what the Mac pulls.

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
