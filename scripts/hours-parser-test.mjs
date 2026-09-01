import assert from "node:assert/strict";
import { build } from "esbuild";

const [{ text: code }] = (await build({
  entryPoints: ["supabase/functions/sync-sheet/hours-parser.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
})).outputFiles;
const { parseHoursText, PARSED_WEEKDAYS } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

const parsed = (text) => {
  const result = parseHoursText(text);
  assert.ok(result, `expected a parsed schedule for: ${text}`);
  assert.deepEqual(Object.keys(result.week), PARSED_WEEKDAYS, "every parse supplies all seven days");
  return result.week;
};
const isClosed = (day) => day.closed === true && day.open === "" && day.close === "";

let week = parsed("Mon - Fri 8am - 5pm");
assert.deepEqual(week.mon, { open: "08:00", close: "17:00" });
assert.ok(isClosed(week.sat) && isClosed(week.sun), "unmentioned weekend becomes explicitly closed");

week = parsed("Tue-Thur 3 pm - 8 pm / Fri-Sat 2 pm - 9 pm / Sun-Mon Closed");
assert.deepEqual(week.tue, { open: "15:00", close: "20:00" });
assert.deepEqual(week.sat, { open: "14:00", close: "21:00" });
assert.ok(isClosed(week.sun) && isClosed(week.mon));

week = parsed("Sun - Thurs 11 am - 9 pm / Fri - Sat 11 am - 10 pm");
assert.deepEqual(week.mon, { open: "11:00", close: "21:00" }, "circular day ranges work");
assert.deepEqual(week.fri, { open: "11:00", close: "22:00" });

week = parsed("7am - 12am");
assert.ok(PARSED_WEEKDAYS.every((day) => week[day].open === "07:00" && week[day].close === "00:00"));

week = parsed("11:00 AM - 10:00 PM (Closed Monday & Tuesday)");
assert.ok(isClosed(week.mon) && isClosed(week.tue), "closed exceptions override a daily range");
assert.deepEqual(week.wed, { open: "11:00", close: "22:00" });

week = parsed("7am-2pm Tuesday through Sunday");
assert.ok(isClosed(week.mon), "time-first day ranges are supported");
assert.deepEqual(week.sun, { open: "07:00", close: "14:00" });

week = parsed("M - F 9am - 7pm Sat 10am - 5pm Sun 8am - 5pm");
assert.deepEqual(week.mon, { open: "09:00", close: "19:00" });
assert.deepEqual(week.sun, { open: "08:00", close: "17:00" });

week = parsed("Mon - Fri 7:30am - 5 pm. Sat 7:30am - Noon");
assert.deepEqual(week.sat, { open: "07:30", close: "12:00" }, "noon is canonicalized");

week = parsed("Class Hours Mon - Thurs 11:00 a.m. - 8:00 p.m");
assert.deepEqual(week.thu, { open: "11:00", close: "20:00" }, "a.m./p.m. punctuation is normalized");

week = parsed("Mon, Wed, Thurs, Fri, Sat, Sun 11:00 AM-10:00 PM, Tue 9:00 AM-10:00 PM");
assert.deepEqual(week.tue, { open: "09:00", close: "22:00" });
assert.deepEqual(week.wed, { open: "11:00", close: "22:00" }, "day lists are supported");

for (const text of [
  "Appointment Only",
  "Mon-Fri: 8:30am-5pm, Sat-Sun: By appointment only",
  "Breakfast 7am-2pm, Lunch 11am-9pm, Dinner 4pm-9pm",
  "Daily 12pm-5pm | Live Music Thu 5pm-8pm",
  "Fridays 3pm-7pm May-August",
  "Tues-Sun 11am-9pm (or sold out)",
  "Mon-Thu 8am-4:30pm (24/7 mobile service)",
  "Mon 9am-5pm, Mon 10am-6pm",
  "Mon 9-5",
  "12am-12am",
]) {
  assert.equal(parseHoursText(text), undefined, `ambiguous/unsupported text stays prose: ${text}`);
}

console.log("hours parser tests passed");
