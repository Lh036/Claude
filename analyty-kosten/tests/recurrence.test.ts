import { describe, expect, it } from "vitest";
import { addMonths, monthlyBurnCents, nextDueDate, yearlyRecurringCents } from "../shared/recurrence";

describe("recurrence", () => {
  it("telt maanden op en klemt op de laatste dag van de maand", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
  });

  it("bepaalt de eerstvolgende termijn na de laatste boeking", () => {
    expect(nextDueDate("2026-01-31", "monthly", "2026-01-31")).toBe("2026-02-28");
    expect(nextDueDate("2026-01-31", "monthly", "2026-02-28")).toBe("2026-03-31");
    expect(nextDueDate("2026-01-10", "quarterly", "2026-04-10")).toBe("2026-07-10");
    expect(nextDueDate("2025-06-01", "yearly", "2025-06-01")).toBe("2026-06-01");
  });

  it("rekent maand- en jaarlasten exact uit", () => {
    const items = [
      { recurrence: "monthly" as const, exclCents: 2000 },
      { recurrence: "quarterly" as const, exclCents: 3000 },
      { recurrence: "yearly" as const, exclCents: 12000 },
      { recurrence: "none" as const, exclCents: 99999 },
    ];
    expect(yearlyRecurringCents(items)).toBe(24000 + 12000 + 12000);
    expect(monthlyBurnCents(items)).toBe(4000);
  });
});
