import { describe, expect, it } from "vitest";
import { dayEndIso, dayStartIso, isoDate, shortDate } from "./format";

describe("a picked day's bounds", () => {
  it("are the hospital's own midnight and last instant, so the day never shifts", () => {
    const start = new Date(dayStartIso("2026-10-23"));
    const end = new Date(dayEndIso("2026-10-23"));
    expect([start.getHours(), start.getMinutes(), isoDate(start)]).toEqual([0, 0, "2026-10-23"]);
    expect([end.getHours(), end.getMinutes(), isoDate(end)]).toEqual([23, 59, "2026-10-23"]);
    expect(shortDate(dayEndIso("2026-10-23"))).toBe("23 Oct 2026"); // not 24 Oct, as UTC 23:59 showed in Lagos
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
  });
});
