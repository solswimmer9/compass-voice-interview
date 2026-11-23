// Small labelled SVG diagrams for roadmap scenarios. Server-only, pure. Unlike object charts,
// these may be labelled: they give the student facts to reason with, not a puzzle to name.

const AXIS = "#8b8e96";
const LINE = "#f4f4f5";
const MUTED = "#a9acb4";
const FONT = "ui-sans-serif, system-ui, sans-serif";

const text = (x: number, y: number, body: string, size = 18, fill = AXIS, anchor = "middle") =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="${size}" text-anchor="${anchor}">${body}</text>`;

export type Stage = { label: string; celsius: number };

/**
 * Temperature against time for repeated cycles of the given stages, each stage a labelled
 * plateau. `cycles` full cycles are drawn, then a gap marked "...".
 */
export function thermalCycleSvg(stages: Stage[], cycles = 2): string {
  const W = 640;
  const H = 400;
  const left = 70;
  const right = W - 24;
  const top = 40;
  const bottom = H - 60;
  const tMin = 20;
  const tMax = 100;
  const y = (c: number) => Math.round(bottom - ((c - tMin) / (tMax - tMin)) * (bottom - top));
  const plateau = 60;
  const ramp = 18;
  const width = cycles * stages.length * (plateau + ramp);
  const scale = (right - left - 40) / width;
  let x = left;
  let previous = y(tMin + 5);
  const points: string[] = [`${x},${previous}`];
  const labels: string[] = [];
  for (let c = 0; c < cycles; c++) {
    for (const stage of stages) {
      const level = y(stage.celsius);
      x += ramp * scale;
      points.push(`${Math.round(x)},${level}`);
      const start = x;
      x += plateau * scale;
      points.push(`${Math.round(x)},${level}`);
      if (c === 0) {
        const mid = Math.round((start + x) / 2);
        labels.push(text(mid, level - 26, stage.label, 15, LINE));
        labels.push(text(mid, level - 8, `${stage.celsius}°C`, 15, MUTED));
      }
      previous = level;
    }
  }
  const axes = [
    `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${AXIS}" stroke-width="1.5"/>`,
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${AXIS}" stroke-width="1.5"/>`,
    text((left + right) / 2, H - 18, "Time", 18),
    `<text x="22" y="${(top + bottom) / 2}" fill="${AXIS}" font-family="${FONT}" font-size="18" text-anchor="middle" transform="rotate(-90 22 ${(top + bottom) / 2})">Temperature</text>`,
    text(right - 14, previous + 6, "...", 22, LINE),
  ];
  const line = `<polyline fill="none" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" points="${points.join(" ")}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${[...axes, line, ...labels].join("")}</svg>`;
}

/** Boxes left to right, joined by arrows, each with a heading and short lines of detail. */
export function flowSvg(boxes: [heading: string, detail: string[]][]): string {
  const W = 640;
  const H = 260;
  const gap = 46;
  const boxW = (W - 40 - gap * (boxes.length - 1)) / boxes.length;
  const top = 70;
  const boxH = 140;
  const parts = boxes.map(([heading, detail], i) => {
    const x = Math.round(20 + i * (boxW + gap));
    const cx = Math.round(x + boxW / 2);
    const arrow =
      i < boxes.length - 1
        ? `<line x1="${x + boxW + 6}" y1="${top + boxH / 2}" x2="${x + boxW + gap - 10}" y2="${top + boxH / 2}" stroke="${AXIS}" stroke-width="2"/>` +
          `<polygon points="${x + boxW + gap - 4},${top + boxH / 2} ${x + boxW + gap - 14},${top + boxH / 2 - 6} ${x + boxW + gap - 14},${top + boxH / 2 + 6}" fill="${AXIS}"/>`
        : "";
    return (
      `<rect x="${x}" y="${top}" width="${Math.round(boxW)}" height="${boxH}" rx="10" fill="none" stroke="${MUTED}" stroke-width="1.5"/>` +
      text(cx, top + 48, heading, 22, LINE) +
      detail.map((line, n) => text(cx, top + 80 + n * 20, line, 15, MUTED)).join("") +
      arrow
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join("")}</svg>`;
}
