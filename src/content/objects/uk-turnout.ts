// DRAFT object for Prof Matt. Written by Claude for the owner's review; never shown to students.
// UK general election turnout (valid votes as a share of the registered electorate), 1945-2024.
// OWNER CHECK BEFORE APPROVAL: these figures are approximate and must be checked one by one
// against the House of Commons Library's figures (UK Election Statistics, CBP-7529, and the
// 2024 results) before this object is approved.
import type { InterviewObject } from "../types.ts";
import { lineChartSvg } from "./chart.ts";

/** [election date as a fractional year, turnout per cent]. Two elections in 1974. */
export const UK_TURNOUT: ReadonlyArray<readonly [when: number, percent: number]> = [
  [1945.5, 72.8], // July 1945
  [1950.15, 83.9], // February 1950
  [1951.8, 82.6], // October 1951
  [1955.4, 76.8], // May 1955
  [1959.8, 78.7], // October 1959
  [1964.8, 77.1], // October 1964
  [1966.25, 75.8], // March 1966
  [1970.45, 72.0], // June 1970
  [1974.15, 78.8], // February 1974
  [1974.8, 72.8], // October 1974
  [1979.35, 76.0], // May 1979
  [1983.45, 72.7], // June 1983
  [1987.45, 75.3], // June 1987
  [1992.3, 77.7], // April 1992
  [1997.35, 71.4], // May 1997
  [2001.45, 59.4], // June 2001
  [2005.35, 61.4], // May 2005
  [2010.35, 65.1], // May 2010
  [2015.35, 66.4], // May 2015
  [2017.45, 68.8], // June 2017
  [2019.95, 67.3], // December 2019
  [2024.5, 59.7], // July 2024
];

const object: InterviewObject = {
  id: "ppe-chart-a",
  tutor: "ppe",
  status: "draft",
  title: "UK general election turnout, 1945-2024",
  svg: lineChartSvg({
    series: [{ points: UK_TURNOUT.map(([x, y]) => ({ x, y })), dots: true }],
    xMin: 1944,
    xMax: 2026,
    xTicks: [1945, 1960, 1975, 1990, 2005, 2020],
    yMin: 50,
    yMax: 90,
    yGrid: [60, 70, 80, 90],
  }),
  alt: "An unlabelled line chart: one line joining 22 dots at uneven intervals between 1945 and 2024.",
  notes: {
    shows:
      "Turnout at every UK general election from 1945 to 2024: valid votes as a share of registered electors. What the student sees: one line through 22 dots at uneven intervals (two dots close together in 1974), no title and no y-axis numbers. The y-axis runs from 50 to 90 per cent with unlabelled gridlines at 60, 70, 80 and 90. The line sits between about 71 and 84 per cent until 1997 (highest 83.9 in 1950), drops sharply to 59.4 in 2001, recovers to 68.8 by 2017, then falls to 59.7 in 2024, almost as low as 2001. Hints you may give if the student is stuck: each dot is a single event, not a yearly measurement; the scale runs from 50 to 90 per cent.",
    opening:
      "I've put a chart on the table with no labels: one line, a dot for each point. What do you think it could be measuring, and what makes you think so?",
    probes: [
      "The dots come at uneven intervals, and two are very close together in the seventies. What does that suggest about what is being measured?",
      "Something changes sharply around 2001 and never fully recovers. What kinds of explanation could there be, and how would you tell them apart?",
      "Is it the people who changed, or what they were being offered? What evidence would separate the two?",
      "Each figure is a share of people on a register. What happens to the number if the register itself changes?",
      "Is a lower figure a problem? For whom, and does it make the result any less legitimate?",
    ],
    goodReasoning:
      'Reasons from features of the chart: uneven spacing and a close pair point to events called at irregular times, and a percentage that stays well above half suggests participation rather than, say, a vote share. Tests rival readings before settling. Once there, separates explanations for the 2001 fall and tests them: a foregone result (a landslide expected again) versus long-run detachment from parties versus generational change; notes that turnout rose again when contests looked close (2015 to 2017) and fell when one did not (2024), and that closeness varies seat by seat. Spots the denominator: turnout is measured against the register, so changes in who is registered (for example the move to individual registration in 2014) move the figure without anyone changing their behaviour. On legitimacy, distinguishes a low share of voters from a low share of the vote, and asks what would actually raise participation (compulsory voting, easier registration, more competitive seats) and at what cost. Weak moves: "people are apathetic" as a full explanation; reading one dip as a trend; treating a lower figure as automatically illegitimate or as automatically fine.',
  },
  sources: [
    {
      title: "House of Commons Library, UK Election Statistics: 1918-2023 (CBP-7529)",
      url: "https://commonslibrary.parliament.uk/research-briefings/cbp-7529/",
      kind: "data",
    },
    {
      title:
        "UK Parliament election results, general election of 4 July 2024 (electorate 48,224,212; valid votes 28,809,340)",
      url: "https://electionresults.parliament.uk/general-elections/6/countries",
      kind: "data",
    },
  ],
  reviewedBy: "",
  reviewedAt: "",
};

export default object;
