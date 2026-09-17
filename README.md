# MM — Form that keeps living

An artistic [Conway’s Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) for a portfolio hero. Black field. White cells that fuse into liquid blobs. The classic setups, playable.

## How we work

You build in **Cursor Cloud** (hosted, not My Machines). The agent commits to GitHub. A login item on the Mac pulls `main` about once a minute. It sleeps when there is nothing new, skips if you have local edits, and never runs Next or an agent worker.

Local preview stays up at **http://127.0.0.1:43173** with no terminal. A login item serves the static export. After each pull it rebuilds, then you refresh the tab. GitHub Pages is the public URL.

You do not need `npm run dev` or `agent worker start`.

Repo: [github.com/marcomargittai/MM-PORTFOLIO](https://github.com/marcomargittai/MM-PORTFOLIO)

On the Mac the puller is `com.marco.mm-portfolio-pull` and the preview is `com.marco.mm-portfolio-preview`. Pause the puller with:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.marco.mm-portfolio-pull.plist
```

Bring the puller back with:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.marco.mm-portfolio-pull.plist
```

Pause the local preview with:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.marco.mm-portfolio-preview.plist
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
