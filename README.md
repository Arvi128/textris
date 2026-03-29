# Textris

Tetris, but the blocks are **words** — each one measured by [Pretext](https://github.com/chenglou/pretext)'s `prepareWithSegments` + `layoutNextLine`. No DOM measurement, no `getBoundingClientRect`. Just canvas and pure arithmetic.

Words fall into rows. When a row's total measured width fills >= 92% of the board, it clears. Stack too high and it's game over.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Controls

| Key | Action |
|-----|--------|
| Left / Right | Move word horizontally |
| Down | Soft drop |
| Space | Hard drop (or start / resume) |
| Up | Swap current piece with next |
| P | Pause / resume |

## How Pretext is used

1. On init, every word in the pool is measured once with `prepareWithSegments(word, font)` then `layoutNextLine(prepared, cursor, Infinity)` to get its exact pixel width.
2. Each frame, landed and falling words are drawn with `ctx.fillText` at their stored position; collision and row-fill math uses the Pretext-measured widths.
3. Row clearing is a simple sum: `totalWidth / boardWidth >= 0.92`.

## Build

```bash
npm run build
npm run preview
```
