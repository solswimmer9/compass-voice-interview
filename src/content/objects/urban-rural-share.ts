// DRAFT object for Dr River. Written by Claude for the owner's review; never shown to students.
// Figures are from UN DESA, World Urbanization Prospects: The 2018 Revision (percentage of the
// world's population at mid-year living in urban areas; 2020 and 2025 are projections). Check
// every figure against the WUP 2018 data file before approval.
import type { InterviewObject } from "../types.ts";
import { lineChartSvg } from "./chart.ts";

/** World population living in urban areas, per cent. Rural is 100 minus this. */
export const URBAN_SHARE: ReadonlyArray<readonly [year: number, percent: number]> = [
  [1950, 29.6],
  [1960, 33.8],
  [1970, 36.6],
  [1980, 39.3],
  [1990, 43.0],
  [2000, 46.7],
  [2010, 51.7],
  [2015, 53.9],
  [2020, 56.2],
  [2025, 58.3],
];

const object: InterviewObject = {
  id: "geo-chart-a",
  tutor: "geography",
  status: "draft",
  title: "World urban and rural population share, 1950-2025",
  svg: lineChartSvg({
    series: [
      { points: URBAN_SHARE.map(([x, y]) => ({ x, y })) },
      {
        points: URBAN_SHARE.map(([x, y]) => ({ x, y: Math.round((100 - y) * 10) / 10 })),
        dashed: true,
      },
    ],
    xMin: 1950,
    xMax: 2025,
    xTicks: [1950, 1975, 2000, 2025],
    yMin: 0,
    yMax: 100,
    yGrid: [25, 50, 75, 100],
  }),
  alt: "An unlabelled line chart with two lines, a solid one and a dashed one, over the years 1950 to 2025.",
  notes: {
    shows:
      "The share of the world's population living in urban areas (solid line) and rural areas (dashed line), 1950 to 2025, from the UN's World Urbanization Prospects. What the student sees: no title and no y-axis numbers; the y-axis runs from 0 to 100 per cent with unlabelled gridlines at 25, 50, 75 and 100. The solid line rises steadily from about 30 per cent in 1950 to about 58 per cent in 2025; the dashed line is its mirror image, falling from about 70 to about 42 per cent. They cross just above the middle gridline around 2007, when, by the UN's count, more people lived in towns and cities than in the countryside for the first time. 2020 and 2025 are projections. Hints you may give if the student is stuck: the two lines always add up to the same total; the middle gridline is half.",
    opening:
      "Here are two lines over the last seventy-five years, with no labels. What do you think they could be showing, and what makes you think so?",
    probes: [
      "Notice the lines mirror each other exactly. What does that tell you about how they are related?",
      "They cross around 2007. Does that crossing matter in itself, or is it just a convenient headline?",
      "Each country decides for itself what counts as the thing the solid line measures. How might that change the picture?",
      "Pick a country you know something about. Would its lines look like this, and what would make them cross earlier or later?",
      "The last stretch is a forecast. How would you make it, and what could bend the line?",
    ],
    goodReasoning:
      "Reasons from the shape before naming an answer: two mirror-image lines must be complementary shares of one whole, so the guess must be a pair that adds up to everything. Tests rival readings against the evidence (for example, land use or age groups would not mirror like this), and accepts or rejects them for stated reasons. Once there, questions the category itself: national definitions of urban vary widely, from a few thousand residents to tens of thousands, so the crossing point depends on who drew the line; a common global method (the Degree of Urbanisation) puts the urban share far higher. Asks about scale (a world average hides very different continents) and about what drives the change (natural increase in cities as well as migration, and rural places being reclassified as they grow). Weak moves: naming an answer and defending it without testing alternatives; treating the 2007 crossing as a real event rather than an artefact of definitions; assuming the trend must continue.",
  },
  sources: [
    {
      title:
        "UN DESA Population Division, World Urbanization Prospects: The 2018 Revision (percentage urban, world)",
      url: "https://population.un.org/wup/",
      kind: "data",
    },
    {
      title:
        "European Commission and others, Applying the Degree of Urbanisation: A methodological manual to define cities, towns and rural areas for international comparisons (2021)",
      url: "https://ec.europa.eu/eurostat/en/web/products-manuals-and-guidelines/-/ks-02-20-499",
      kind: "data",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default object;
