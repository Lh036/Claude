import { describe, expect, it } from "vitest";
import { calculateVat, centsToInput, parseAmountToCents, VAT_RATES } from "../shared/vat";

describe("calculateVat", () => {
  it("berekent BTW over een bedrag exclusief BTW", () => {
    expect(calculateVat(10000, 21, "excl")).toEqual({ rate: 21, exclCents: 10000, vatCents: 2100, inclCents: 12100 });
    expect(calculateVat(10000, 9, "excl")).toEqual({ rate: 9, exclCents: 10000, vatCents: 900, inclCents: 10900 });
    expect(calculateVat(10000, 0, "excl")).toEqual({ rate: 0, exclCents: 10000, vatCents: 0, inclCents: 10000 });
  });

  it("haalt BTW uit een bedrag inclusief BTW", () => {
    expect(calculateVat(12100, 21, "incl")).toEqual({ rate: 21, exclCents: 10000, vatCents: 2100, inclCents: 12100 });
    expect(calculateVat(10900, 9, "incl")).toEqual({ rate: 9, exclCents: 10000, vatCents: 900, inclCents: 10900 });
    // € 9,99 incl. 21%: 999 × 21 / 121 = 173,38… -> € 1,73 BTW, € 8,26 excl.
    expect(calculateVat(999, 21, "incl")).toEqual({ rate: 21, exclCents: 826, vatCents: 173, inclCents: 999 });
  });

  it("rondt half naar boven af op hele centen", () => {
    // € 0,50 × 9% = 4,5 cent -> 5 cent
    expect(calculateVat(50, 9, "excl").vatCents).toBe(5);
    // € 0,49 × 9% = 4,41 cent -> 4 cent
    expect(calculateVat(49, 9, "excl").vatCents).toBe(4);
    // € 0,50 × 21% = 10,5 cent -> 11 cent
    expect(calculateVat(50, 21, "excl").vatCents).toBe(11);
    // € 1,09 incl. 9%: 109 × 9 / 109 = 9 cent exact
    expect(calculateVat(109, 9, "incl").vatCents).toBe(9);
  });

  it("excl + btw = incl, altijd — voor elk bedrag tot € 1.000 en elk tarief", () => {
    for (const rate of VAT_RATES) {
      for (let cents = 0; cents <= 100000; cents += 7) {
        for (const basis of ["excl", "incl"] as const) {
          const r = calculateVat(cents, rate, basis);
          expect(r.exclCents + r.vatCents).toBe(r.inclCents);
          expect(Number.isInteger(r.vatCents)).toBe(true);
          // BTW wijkt nooit meer dan een halve cent af van de exacte waarde.
          const exact = basis === "excl" ? (cents * rate) / 100 : (cents * rate) / (100 + rate);
          expect(Math.abs(r.vatCents - exact)).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it("weigert ongeldige invoer", () => {
    expect(() => calculateVat(-1, 21, "excl")).toThrow();
    expect(() => calculateVat(1.5, 21, "excl")).toThrow();
    // @ts-expect-error — 19% bestaat niet in Nederland
    expect(() => calculateVat(100, 19, "excl")).toThrow();
  });

  it("werkt exact voor grote bedragen", () => {
    expect(calculateVat(123_456_789_00, 21, "excl")).toEqual({
      rate: 21,
      exclCents: 123_456_789_00,
      vatCents: 25_925_925_69,
      inclCents: 149_382_714_69,
    });
  });
});

describe("parseAmountToCents", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["12.50", 1250],
    ["0,01", 1],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234", 123400],
    ["€ 9,99", 999],
    ["1 234,56", 123456],
    ["1.000.000", 100000000],
  ])("%s -> %i cent", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "12,345", "1,2,3", "-5", "12,", ",50", "1.23.4"])("weigert %j", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });

  it("centsToInput is het omgekeerde", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(centsToInput(5)).toBe("0,05");
    expect(parseAmountToCents(centsToInput(98765))).toBe(98765);
  });
});
