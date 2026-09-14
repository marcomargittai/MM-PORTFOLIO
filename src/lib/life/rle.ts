export type Cell = readonly [x: number, y: number];

export interface DecodedRle {
  width: number;
  height: number;
  cells: Cell[];
}

export function decodeRle(rle: string): DecodedRle {
  const body = rle
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !/^x\s*=/i.test(line))
    .join("");

  const cells: Cell[] = [];
  let x = 0;
  let y = 0;
  let i = 0;

  while (i < body.length) {
    const ch = body[i]!;
    if (ch === "!") break;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    let run = 0;
    while (i < body.length && body[i]! >= "0" && body[i]! <= "9") {
      run = run * 10 + (body[i]!.charCodeAt(0) - 48);
      i += 1;
    }
    const count = run === 0 ? 1 : run;
    if (i >= body.length) break;

    const tag = body[i]!;
    i += 1;

    if (tag === "!") break;
    if (tag === "$") {
      y += count;
      x = 0;
      continue;
    }
    if (tag === "b" || tag === "B" || tag === ".") {
      x += count;
      continue;
    }

    for (let k = 0; k < count; k += 1) {
      cells.push([x, y]);
      x += 1;
    }
  }

  return normalizeCells(cells);
}

export function normalizeCells(input: readonly Cell[]): DecodedRle {
  if (input.length === 0) return { width: 0, height: 0, cells: [] };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [cx, cy] of input) {
    if (cx < minX) minX = cx;
    if (cy < minY) minY = cy;
    if (cx > maxX) maxX = cx;
    if (cy > maxY) maxY = cy;
  }

  const cells: Cell[] =
    minX === 0 && minY === 0
      ? [...input]
      : input.map(([cx, cy]) => [cx - minX, cy - minY]);

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cells,
  };
}

export function mergeDecoded(parts: { cells: readonly Cell[]; ox: number; oy: number }[]): DecodedRle {
  const cells: Cell[] = [];
  for (const part of parts) {
    for (const [x, y] of part.cells) {
      cells.push([x + part.ox, y + part.oy]);
    }
  }
  return normalizeCells(cells);
}
