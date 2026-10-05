import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { openDb } from "../server/db";
import { createApp } from "../server/app";
import type { Category, Expense, Summary } from "../shared/types";

let server: Server;
let base: string;

beforeEach(async () => {
  const app = createApp(openDb(":memory:"));
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: (text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text) as T };
}

const base21 = { amountBasis: "excl" as const, vatRate: 21 as const };

describe("kosten-API", () => {
  it("heeft standaardcategorieën", async () => {
    const { data } = await call<Category[]>("GET", "/categories");
    expect(data.map((c) => c.name)).toContain("AI & API's");
    expect(data.length).toBe(7);
  });

  it("voegt kosten toe, rekent BTW server-side uit, wijzigt en verwijdert", async () => {
    const [cat] = (await call<Category[]>("GET", "/categories")).data;
    const created = await call<Expense>("POST", "/expenses", {
      date: "2026-10-01",
      description: "OpenAI API",
      supplier: "OpenAI",
      categoryId: cat!.id,
      amountCents: 12100,
      amountBasis: "incl",
      vatRate: 21,
      notes: "Oktober",
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ exclCents: 10000, vatCents: 2100, inclCents: 12100, recurrence: "none", receiptUrl: null });

    const updated = await call<Expense>("PATCH", `/expenses/${created.data.id}`, { vatRate: 9 });
    expect(updated.data).toMatchObject({ exclCents: 11101, vatCents: 999, inclCents: 12100 });

    const list = await call<Expense[]>("GET", "/expenses");
    expect(list.data).toHaveLength(1);

    expect((await call("DELETE", `/expenses/${created.data.id}`)).status).toBe(204);
    expect((await call<Expense[]>("GET", "/expenses")).data).toHaveLength(0);
    expect((await call("DELETE", `/expenses/${created.data.id}`)).status).toBe(404);
  });

  it("valideert invoer", async () => {
    const bad = [
      { date: "2026-13-01", description: "x", amountCents: 100, ...base21 },
      { date: "2026-02-30", description: "x", amountCents: 100, ...base21 },
      { date: "2026-01-01", description: "", amountCents: 100, ...base21 },
      { date: "2026-01-01", description: "x", amountCents: 1.5, ...base21 },
      { date: "2026-01-01", description: "x", amountCents: 100, amountBasis: "excl", vatRate: 19 },
      { date: "2026-01-01", description: "x", amountCents: 100, ...base21, categoryId: "cat_bestaat_niet" },
    ];
    for (const body of bad) {
      const { status } = await call("POST", "/expenses", body);
      expect([400, 404]).toContain(status);
    }
  });

  it("filtert op periode, categorie, zoekterm en type", async () => {
    const cats = (await call<Category[]>("GET", "/categories")).data;
    await call("POST", "/expenses", { date: "2026-01-05", description: "Hetzner server", supplier: "Hetzner", categoryId: cats[1]!.id, amountCents: 5000, ...base21, recurrence: "monthly" });
    await call("POST", "/expenses", { date: "2026-02-05", description: "Google Ads 100%_korting", supplier: "Google", categoryId: cats[3]!.id, amountCents: 20000, ...base21 });
    await call("POST", "/expenses", { date: "2026-03-05", description: "Laptop", amountCents: 150000, ...base21 });

    expect((await call<Expense[]>("GET", "/expenses?from=2026-02-01&to=2026-02-28")).data.map((e) => e.description)).toEqual(["Google Ads 100%_korting"]);
    expect((await call<Expense[]>("GET", `/expenses?categoryId=${cats[1]!.id}`)).data).toHaveLength(1);
    expect((await call<Expense[]>("GET", "/expenses?categoryId=none")).data.map((e) => e.description)).toEqual(["Laptop"]);
    expect((await call<Expense[]>("GET", "/expenses?q=hetz")).data).toHaveLength(1);
    expect((await call<Expense[]>("GET", "/expenses?q=%25_")).data).toHaveLength(1); // % en _ zijn letterlijk
    expect((await call<Expense[]>("GET", "/expenses?supplier=google")).data).toHaveLength(1);
    expect((await call<Expense[]>("GET", "/expenses?type=recurring")).data).toHaveLength(1);
    expect((await call<Expense[]>("GET", "/expenses?type=one-off")).data).toHaveLength(2);
  });

  it("boekt de volgende termijn van een terugkerende kost", async () => {
    const series = (await call<Expense>("POST", "/expenses", { date: "2026-01-31", description: "Vercel", amountCents: 2000, ...base21, recurrence: "monthly" })).data;
    const first = (await call<Expense>("POST", `/expenses/${series.id}/book-next`)).data;
    expect(first).toMatchObject({ date: "2026-02-28", seriesId: series.id, recurrence: "none", inclCents: 2420 });
    const second = (await call<Expense>("POST", `/expenses/${series.id}/book-next`)).data;
    expect(second.date).toBe("2026-03-31");
    expect((await call("POST", `/expenses/${first.id}/book-next`)).status).toBe(409);
  });

  it("maakt een dashboardoverzicht met budgetten, kwartalen en maandlasten", async () => {
    const cats = (await call<Category[]>("GET", "/categories")).data;
    await call("PATCH", `/categories/${cats[0]!.id}`, { monthlyBudgetCents: 10000 });
    await call("POST", "/expenses", { date: "2026-03-10", description: "Claude API", categoryId: cats[0]!.id, amountCents: 15000, ...base21 });
    await call("POST", "/expenses", { date: "2026-05-01", description: "Hosting", categoryId: cats[1]!.id, amountCents: 1200, ...base21, recurrence: "yearly" });
    await call("POST", "/expenses", { date: "2026-02-20", description: "Vorige maand", amountCents: 1000, amountBasis: "excl", vatRate: 9 });
    await call("POST", "/expenses", { date: "2025-12-01", description: "Vorig jaar", amountCents: 999999, ...base21 });

    // Een kost in januari moet meetellen in het jaartotaal, ook als "deze maand" later in het jaar ligt.
    await call("POST", "/expenses", { date: "2026-01-05", description: "Januari", amountCents: 700, ...base21 });
    const october = (await call<Summary>("GET", "/summary?year=2026&month=10")).data;
    expect(october.totals.year.count).toBe(4);
    expect(october.byMonth[0]!.exclCents).toBe(700);
    const january = (await call<Summary>("GET", "/summary?year=2026&month=1")).data;
    expect(january.totals.previousMonth.exclCents).toBe(999999);
    expect(january.totals.year.exclCents).toBe(october.totals.year.exclCents);
    await call("DELETE", `/expenses/${(await call<Expense[]>("GET", "/expenses?q=Januari")).data[0]!.id}`);

    const { data } = await call<Summary>("GET", "/summary?year=2026&month=3");
    expect(data.totals.month).toEqual({ exclCents: 15000, vatCents: 3150, inclCents: 18150, count: 1 });
    expect(data.totals.previousMonth.exclCents).toBe(1000);
    expect(data.totals.year.exclCents).toBe(15000 + 1200 + 1000);
    expect(data.byMonth[2]!.exclCents).toBe(15000);
    expect(data.vatByQuarter[0]!.vatCents).toBe(3150 + 90);
    expect(data.vatByQuarter[1]!.vatCents).toBe(252);
    expect(data.budgets).toEqual([{ categoryId: cats[0]!.id, name: cats[0]!.name, color: cats[0]!.color, budgetCents: 10000, spentCents: 15000 }]);
    expect(data.monthlyBurnCents).toBe(100);
    expect(data.recurring[0]!.nextDueDate).toBe("2027-05-01");
    expect(data.byCategory[0]!.name).toBe(cats[0]!.name);
  });

  it("beheert categorieën en verplaatst kosten bij verwijderen", async () => {
    const created = (await call<Category>("POST", "/categories", { name: "Reizen", monthlyBudgetCents: 50000 })).data;
    expect((await call("POST", "/categories", { name: "reizen" })).status).toBe(409);
    const other = (await call<Category[]>("GET", "/categories")).data.find((c) => c.name === "Overig")!;
    const exp = (await call<Expense>("POST", "/expenses", { date: "2026-04-01", description: "Trein", categoryId: created.id, amountCents: 500, amountBasis: "incl", vatRate: 9 })).data;

    expect((await call("DELETE", `/categories/${created.id}?reassignTo=${other.id}`)).status).toBe(204);
    expect((await call<Expense>("GET", `/expenses/${exp.id}`)).data.categoryId).toBe(other.id);
  });

  it("exporteert CSV voor Nederlandse Excel", async () => {
    await call("POST", "/expenses", { date: "2026-04-01", description: "=HYPERLINK(\"x\")", supplier: "A; B", amountCents: 123456, ...base21 });
    const res = await fetch(`${base}/expenses/export.csv`);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    const lines = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Datum;Omschrijving;Leverancier;Categorie;Excl. BTW;BTW %;BTW;Incl. BTW;Type;Notities;Bon-link");
    expect(lines[1]).toBe(`2026-04-01;"'=HYPERLINK(""x"")";"A; B";;1234,56;21;259,26;1493,82;Eenmalig;;`);
    expect(lines[2]).toBe("Totaal;;;;1234,56;;259,26;1493,82;;;");
  });
});
