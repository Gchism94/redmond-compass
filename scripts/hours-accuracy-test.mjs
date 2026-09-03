import assert from "node:assert/strict";
import { build } from "esbuild";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => undefined },
});

// Bundle the production TypeScript entry so this focused test exercises the same module
// (including localization) without adding a second test runner to the app.
const [{ text: code }] = (await build({
  entryPoints: ["src/lib/hours.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": "./src" },
})).outputFiles;
const hours = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const closed = () => ({ open: "", close: "", closed: true });
const week = (overrides = {}) => ({
  sun: closed(),
  mon: closed(),
  tue: closed(),
  wed: closed(),
  thu: closed(),
  fri: closed(),
  sat: closed(),
  ...overrides,
});

const allClosed = { week: week() };
assert.equal(hours.hasValidWeeklyHours(allClosed), false, "blank all-closed form is not a usable schedule");
assert.equal(hours.getOpenStatus(allClosed).state, "unknown", "all-closed data never claims Closed");
assert.equal(
  hours.hoursTextFallback(allClosed, "  By appointment  "),
  "By appointment",
  "legacy text is trimmed and preserved as prose",
);

const partial = { week: { mon: { open: "09:00", close: "17:00" } } };
assert.equal(hours.hasValidWeeklyHours(partial), false, "partial weeks are not canonical");
assert.equal(hours.getOpenStatus(partial).state, "unknown", "partial weeks never claim Open or Closed");

const malformed = { week: week({ mon: { open: "25:00", close: "17:00" } }) };
assert.equal(hours.hasValidWeeklyHours(malformed), false, "invalid clock values are rejected");

const regular = { week: week({ mon: { open: "09:00", close: "17:00" } }) };
assert.equal(hours.hasValidWeeklyHours(regular), true, "a complete schedule with an open day is usable");
assert.equal(
  hours.getOpenStatus(regular, new Date(2026, 7, 31, 10, 0)).state,
  "open",
  "valid schedules can make a live Open claim",
);
assert.equal(hours.hoursTextFallback(regular, "old prose"), undefined, "valid structured data stays canonical");
assert.equal(
  hours.formatHoursTextDisplay("Open 7 days a week 11am to Close"),
  "Daily · 11 AM–close",
  "unstructured hours get a conservative display cleanup",
);
assert.equal(
  hours.formatHoursTextDisplay("By Appointment"),
  "By Appointment",
  "non-schedule prose is not rewritten",
);

const overnight = { week: week({ mon: { open: "20:00", close: "02:00" } }) };
const overnightStatus = hours.getOpenStatus(overnight, new Date(2026, 8, 1, 1, 0));
assert.equal(overnightStatus.state, "open", "overnight service remains open after midnight");
assert.match(overnightStatus.detail, /2:00 AM/, "overnight close time is retained");

const invalidSpecial = {
  ...regular,
  special: [{ date: "2026-08-31", open: "later", close: "soon" }],
};
assert.equal(
  hours.getOpenStatus(invalidSpecial, new Date(2026, 7, 31, 10, 0)).state,
  "unknown",
  "an invalid same-day override suppresses a live status claim",
);

console.log("hours accuracy tests passed");
