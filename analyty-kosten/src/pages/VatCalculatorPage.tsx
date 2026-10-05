import { useState } from "react";
import { Calculator } from "lucide-react";
import { formatEuro } from "@/lib/format";
import { Card, CardHeader, Field, Input, PageHeader, Segmented } from "@/components/ui";
import { calculateVat, parseAmountToCents, type AmountBasis, type VatRate } from "@shared/vat";

const RATES: VatRate[] = [21, 9];

export default function VatCalculatorPage() {
  const [amount, setAmount] = useState("100");
  const [basis, setBasis] = useState<AmountBasis>("excl");
  const [rate, setRate] = useState<VatRate>(21);

  const cents = parseAmountToCents(amount);
  const result = cents === null ? null : calculateVat(cents, rate, basis);

  return (
    <div>
      <PageHeader
        title="BTW-calculator"
        subtitle="Vaste formule, geen AI: altijd exact op de cent. Dezelfde berekening als bij het toevoegen van kosten."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <div className="space-y-4">
            <Field label="Bedrag (€)" error={amount.trim() && cents === null ? "Geen geldig bedrag, bv. 1.234,56" : undefined}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg tabular-nums" autoFocus />
            </Field>
            <Field label="Dit bedrag is">
              <Segmented
                ariaLabel="Bedrag inclusief of exclusief BTW"
                value={basis}
                onChange={setBasis}
                options={[
                  { value: "excl", label: "Excl. BTW" },
                  { value: "incl", label: "Incl. BTW" },
                ]}
              />
            </Field>
            <Field label="BTW-tarief">
              <Segmented ariaLabel="BTW-tarief" value={rate} onChange={setRate} options={RATES.map((r) => ({ value: r, label: `${r}%` }))} />
            </Field>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ResultTile label="Excl. BTW" cents={result?.exclCents} />
            <ResultTile label={`BTW ${rate}%`} cents={result?.vatCents} highlight />
            <ResultTile label="Incl. BTW" cents={result?.inclCents} />
          </div>

          <Card>
            <CardHeader title="Zo is het berekend" subtitle="Afronding: half naar boven op hele centen." />
            <div className="space-y-2 px-5 pb-5 font-mono text-sm">
              {result && cents !== null ? (
                basis === "excl" ? (
                  <>
                    <Line label="BTW" formula={`${formatEuro(cents)} × ${rate} / 100`} value={result.vatCents} />
                    <Line label="Incl." formula={`${formatEuro(cents)} + ${formatEuro(result.vatCents)}`} value={result.inclCents} />
                  </>
                ) : (
                  <>
                    <Line label="BTW" formula={`${formatEuro(cents)} × ${rate} / ${100 + rate}`} value={result.vatCents} />
                    <Line label="Excl." formula={`${formatEuro(cents)} − ${formatEuro(result.vatCents)}`} value={result.exclCents} />
                  </>
                )
              ) : (
                <p className="font-sans text-[var(--color-ink-muted)]">Vul een bedrag in.</p>
              )}
            </div>
          </Card>

          {cents !== null && (
            <Card>
              <CardHeader title="Beide tarieven naast elkaar" subtitle={`Voor ${formatEuro(cents)} ${basis === "excl" ? "excl." : "incl."} BTW`} />
              <div className="grid grid-cols-2 gap-3 px-5 pb-5 text-sm">
                {RATES.map((r) => {
                  const res = calculateVat(cents, r, basis);
                  return (
                    <div key={r} className="rounded-xl bg-[var(--color-surface-muted)] p-3">
                      <div className="mb-1 font-semibold">{r}%</div>
                      <div className="flex justify-between tabular-nums">
                        <span className="text-[var(--color-ink-muted)]">Excl.</span> {formatEuro(res.exclCents)}
                      </div>
                      <div className="flex justify-between tabular-nums">
                        <span className="text-[var(--color-ink-muted)]">BTW</span> {formatEuro(res.vatCents)}
                      </div>
                      <div className="flex justify-between font-medium tabular-nums">
                        <span className="text-[var(--color-ink-muted)]">Incl.</span> {formatEuro(res.inclCents)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultTile({ label, cents, highlight }: { label: string; cents: number | undefined; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-2xl bg-[var(--color-lime)] p-4" : "rounded-2xl border border-[var(--color-border)] bg-white p-4"}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-ink-muted)]">
        {highlight && <Calculator className="h-3.5 w-3.5 text-[var(--color-ink)]" />}
        <span className={highlight ? "text-[var(--color-ink)]" : undefined}>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{cents === undefined ? "—" : formatEuro(cents)}</div>
    </div>
  );
}

function Line({ label, formula, value }: { label: string; formula: string; value: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2">
      <span>
        <span className="font-sans font-medium">{label}</span> = {formula}
      </span>
      <span className="font-semibold">= {formatEuro(value)}</span>
    </div>
  );
}
