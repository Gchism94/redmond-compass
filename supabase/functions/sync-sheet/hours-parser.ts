/**
 * Conservative parser for the legacy `Hours` Sheet column.
 *
 * The original prose remains in `hours_text`; this only returns a canonical seven-day
 * schedule when the text describes one unambiguous opening interval per day. Unsupported
 * cases (appointments, seasonal schedules, multiple services/intervals, or conflicting
 * clauses) deliberately return undefined so the app never invents an Open/Closed claim.
 */

export const PARSED_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type ParsedWeekday = (typeof PARSED_WEEKDAYS)[number];

export interface ParsedDayHours {
  open: string;
  close: string;
  closed?: boolean;
}

export interface ParsedHours {
  week: Record<ParsedWeekday, ParsedDayHours>;
}

const DAY_TOKEN =
  "(?:mondays?|mon|tuesdays?|tues?|wednesdays?|weds?|wed|thursdays?|thurs?|thur|thu|fridays?|fri|saturdays?|sat|sundays?|sun)";
const DAY_EXPRESSION =
  `(?:every\\s+day|daily|weekdays?|weekends?|m\\s*-\\s*f|${DAY_TOKEN}\\s*(?:-|through)\\s*${DAY_TOKEN}|${DAY_TOKEN}(?:\\s*(?:,|&|and)\\s*${DAY_TOKEN})+|${DAY_TOKEN})`;
const CLOCK = "(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)|noon|midnight)";
const TIME_RANGE = `${CLOCK}\\s*(?:-|to)\\s*${CLOCK}`;

const closedDay = (): ParsedDayHours => ({ open: "", close: "", closed: true });

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/a\s*\.?\s*m\.?/g, "am")
    .replace(/p\s*\.?\s*m\.?/g, "pm")
    .replace(/\s+/g, " ")
    .trim();
}

function dayFromToken(token: string): ParsedWeekday | undefined {
  const value = token.toLowerCase().replace(/s$/, "");
  if (value === "monday" || value === "mon") return "mon";
  if (value === "tuesday" || value === "tue") return "tue";
  if (value === "wednesday" || value === "wed") return "wed";
  if (value === "thursday" || value === "thur" || value === "thu") return "thu";
  if (value === "friday" || value === "fri") return "fri";
  if (value === "saturday" || value === "sat") return "sat";
  if (value === "sunday" || value === "sun") return "sun";
  return undefined;
}

function inclusiveRange(from: ParsedWeekday, to: ParsedWeekday): ParsedWeekday[] {
  const out: ParsedWeekday[] = [];
  let index = PARSED_WEEKDAYS.indexOf(from);
  for (let count = 0; count < PARSED_WEEKDAYS.length; count++) {
    const day = PARSED_WEEKDAYS[index];
    out.push(day);
    if (day === to) return out;
    index = (index + 1) % PARSED_WEEKDAYS.length;
  }
  return [];
}

function parseDayExpression(input: string): ParsedWeekday[] | undefined {
  const value = input.trim().replace(/^open\s+/, "");
  if (/^(?:every\s+day|daily)$/.test(value)) return [...PARSED_WEEKDAYS];
  if (/^weekdays?$/.test(value) || /^m\s*-\s*f$/.test(value)) return PARSED_WEEKDAYS.slice(0, 5);
  if (/^weekends?$/.test(value)) return ["sat", "sun"];

  const range = value.match(new RegExp(`^(${DAY_TOKEN})\\s*(?:-|through)\\s*(${DAY_TOKEN})$`, "i"));
  if (range) {
    const from = dayFromToken(range[1]);
    const to = dayFromToken(range[2]);
    return from && to ? inclusiveRange(from, to) : undefined;
  }

  const tokens = value.match(new RegExp(DAY_TOKEN, "gi")) ?? [];
  const days = tokens.map(dayFromToken);
  if (!days.length || days.some((day) => !day)) return undefined;
  return [...new Set(days as ParsedWeekday[])];
}

function parseClock(input: string): string | undefined {
  const value = input.trim().toLowerCase();
  if (value === "noon") return "12:00";
  if (value === "midnight") return "00:00";
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return undefined;
  if (match[3] === "am") hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(input: string): ParsedDayHours | undefined {
  const match = input.trim().match(new RegExp(`^(${CLOCK})\\s*(?:-|to)\\s*(${CLOCK})$`, "i"));
  if (!match) return undefined;
  const open = parseClock(match[1]);
  const close = parseClock(match[2]);
  if (!open || !close || open === close) return undefined;
  return { open, close };
}

function sameHours(a: ParsedDayHours, b: ParsedDayHours): boolean {
  return a.open === b.open && a.close === b.close && Boolean(a.closed) === Boolean(b.closed);
}

/**
 * Parse a weekly schedule while preserving uncertainty as uncertainty.
 *
 * Unmentioned days in an otherwise day-qualified weekly schedule become explicit closed
 * days. A lone range (for example `7am - 12am`) applies daily. Explicit closed exceptions
 * can override that daily range (`11am - 10pm, closed Monday & Tuesday`).
 */
export function parseHoursText(input: string | null | undefined): ParsedHours | undefined {
  const text = normalize(input ?? "");
  if (!text) return undefined;

  // These phrases describe access rules, seasons, or competing service schedules that the
  // one-interval schema cannot honestly reduce to a live Open/Closed state.
  if (/\b(?:appointment|availability|call\s+or\s+email|check\s+website|sold\s+out|24\s*\/\s*7)\b/.test(text)) {
    return undefined;
  }
  if (/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(text)) {
    return undefined;
  }

  const assignments = new Map<ParsedWeekday, ParsedDayHours>();
  const explicitClosed = new Set<ParsedWeekday>();
  let openClauses = 0;
  let conflict = false;

  const assignOpen = (days: ParsedWeekday[], hours: ParsedDayHours) => {
    openClauses++;
    for (const day of days) {
      const current = assignments.get(day);
      if (current && !sameHours(current, hours)) conflict = true;
      else assignments.set(day, hours);
    }
  };
  const assignClosed = (days: ParsedWeekday[]) => {
    for (const day of days) explicitClosed.add(day);
  };

  // Day first: `Mon-Fri 8am-5pm`, `Sun-Mon Closed`, or `Daily 11am to 10pm`.
  const dayFirst = new RegExp(`(${DAY_EXPRESSION})\\s*(?::|-)??\\s*(${TIME_RANGE}|closed)`, "gi");
  for (const match of text.matchAll(dayFirst)) {
    const days = parseDayExpression(match[1]);
    if (!days) { conflict = true; continue; }
    if (match[2].toLowerCase() === "closed") assignClosed(days);
    else {
      const hours = parseTimeRange(match[2]);
      if (!hours) conflict = true;
      else assignOpen(days, hours);
    }
  }

  // Time first occurs in legacy entries such as `7am-2pm Tuesday through Sunday`.
  const timeFirst = text.match(new RegExp(`^(${TIME_RANGE})\\s+(${DAY_EXPRESSION})(?:\\b|$)`, "i"));
  if (timeFirst) {
    const hours = parseTimeRange(timeFirst[1]);
    const days = parseDayExpression(timeFirst[2]);
    if (!hours || !days) conflict = true;
    else assignOpen(days, hours);
  }

  // Status first: `(Closed Monday & Tuesday)` or `- Closed Sundays`.
  const closedFirst = new RegExp(`closed\\s+(${DAY_EXPRESSION})`, "gi");
  for (const match of text.matchAll(closedFirst)) {
    const days = parseDayExpression(match[1]);
    if (!days) conflict = true;
    else assignClosed(days);
  }

  const allRanges = [...text.matchAll(new RegExp(TIME_RANGE, "gi"))].map((match) => match[0]);
  let usedDailyDefault = false;
  if (openClauses === 0 && allRanges.length === 1) {
    const hours = parseTimeRange(allRanges[0]);
    if (!hours) return undefined;
    for (const day of PARSED_WEEKDAYS) assignments.set(day, hours);
    usedDailyDefault = true;
  } else if (allRanges.length !== openClauses) {
    // An unmatched extra range usually means multiple services or multiple intervals/day.
    return undefined;
  }

  if (conflict || assignments.size === 0) return undefined;

  for (const day of explicitClosed) {
    const current = assignments.get(day);
    if (current && !usedDailyDefault) return undefined;
    assignments.set(day, closedDay());
  }

  const week = {} as Record<ParsedWeekday, ParsedDayHours>;
  for (const day of PARSED_WEEKDAYS) week[day] = assignments.get(day) ?? closedDay();
  if (!PARSED_WEEKDAYS.some((day) => !week[day].closed)) return undefined;
  return { week };
}
