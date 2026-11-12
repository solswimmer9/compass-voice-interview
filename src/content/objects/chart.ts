// Draws an unlabelled line chart as an SVG string for an object interview. Server-only, pure.
// Only the x-axis years are written on the chart; the y-axis has unlabelled gridlines, and
// there is no title or legend, so the student has to reason about what it shows.

export type ChartPoint = { x: number; y: number };
export type ChartSeries = { points: ChartPoint[]; dashed?: boolean; dots?: boolean };

export type LineChartInput = {
  series: ChartSeries[];
  /** x range, and the years written under the axis. */
  xMin: number;
  xMax: number;
  xTicks: number[];
  /** y range. Gridlines are drawn at yGrid, with no labels. */
  yMin: number;
  yMax: number;
  yGrid: number[];
};

const WIDTH = 640;
const HEIGHT = 400;
const PAD = { left: 32, right: 32, top: 24, bottom: 52 };
const AXIS = "#8b8e96";
const GRID = "#34363c";
const LINE = "#f4f4f5";
const DASHED = "#a9acb4";
const FONT = "ui-sans-serif, system-ui, sans-serif";

const round = (value: number) => Math.round(value * 10) / 10;

export function lineChartSvg(input: LineChartInput): string {
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const bottom = PAD.top + plotH;
  const right = WIDTH - PAD.right;
  const x = (value: number) =>
    round(PAD.left + ((value - input.xMin) / (input.xMax - input.xMin)) * plotW);
  const y = (value: number) =>
    round(PAD.top + (1 - (value - input.yMin) / (input.yMax - input.yMin)) * plotH);

  const grid = input.yGrid.map(
    (value) =>
      `<line x1="${PAD.left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="${GRID}" stroke-width="1"/>`,
  );
  const axes = [
    `<line x1="${PAD.left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${AXIS}" stroke-width="1.5"/>`,
    `<line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${bottom}" stroke="${AXIS}" stroke-width="1.5"/>`,
  ];
  const ticks = input.xTicks.map(
    (value) =>
      `<line x1="${x(value)}" y1="${bottom}" x2="${x(value)}" y2="${bottom + 6}" stroke="${AXIS}" stroke-width="1"/>` +
      `<text x="${x(value)}" y="${bottom + 30}" fill="${AXIS}" font-family="${FONT}" font-size="20" text-anchor="middle">${value}</text>`,
  );
  const lines = input.series.map((series) => {
    const points = series.points.map((p) => `${x(p.x)},${y(p.y)}`).join(" ");
    const stroke = series.dashed ? `${DASHED}" stroke-dasharray="10 7` : LINE;
    const dots = series.dots
      ? series.points.map((p) => `<circle cx="${x(p.x)}" cy="${y(p.y)}" r="4" fill="${LINE}"/>`)
      : [];
    return `<polyline fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${points}"/>${dots.join("")}`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${[...grid, ...axes, ...ticks, ...lines].join("")}</svg>`;
}
