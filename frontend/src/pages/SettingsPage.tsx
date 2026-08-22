import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Select } from "@/components/ui/Field";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import { PROVIDER_LABELS } from "@/lib/format";
import { ALL_PROVIDERS, QUESTION_COUNT_OPTIONS, type ProviderName } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export default function SettingsPage() {
  const { notify } = useToast();
  const [settings, setSettings] = useState(loadSettings());

  function toggleProvider(p: ProviderName) {
    setSettings((s) => ({
      ...s,
      defaultProviders: s.defaultProviders.includes(p)
        ? s.defaultProviders.filter((x) => x !== p)
        : [...s.defaultProviders, p],
    }));
  }

  function save() {
    if (settings.defaultProviders.length === 0) {
      notify("error", "Select at least one default provider.");
      return;
    }
    saveSettings(settings);
    notify("success", "Defaults saved. New scans will start pre-filled with these values.");
  }

  function reset() {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    notify("success", "Defaults reset.");
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Defaults applied automatically when you open the Start New Scan dialog. Stored in this browser."
      />

      <Card className="max-w-xl">
        <CardHeader title="Default scan configuration" subtitle="Used to prefill Number of questions and AI providers on every new scan." />
        <CardBody className="space-y-4">
          <FieldWrap label="Default number of questions">
            <Select
              value={settings.defaultQuestionCount}
              onChange={(e) => setSettings((s) => ({ ...s, defaultQuestionCount: Number(e.target.value) }))}
            >
              {QUESTION_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </Select>
          </FieldWrap>

          <FieldWrap label="Default AI providers">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ALL_PROVIDERS.map((p) => (
                <label
                  key={p}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-3 py-2 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-soft)]"
                >
                  <input
                    type="checkbox"
                    checked={settings.defaultProviders.includes(p)}
                    onChange={() => toggleProvider(p)}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  {PROVIDER_LABELS[p]}
                </label>
              ))}
            </div>
          </FieldWrap>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={save} icon={<Save className="h-3.5 w-3.5" />}>
              Save defaults
            </Button>
            <Button variant="secondary" onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />}>
              Reset to defaults
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
