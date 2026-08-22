import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Input, Textarea } from "@/components/ui/Field";
import { InlineError } from "@/components/ui/ErrorState";
import { businessApi, ApiError } from "@/lib/api";
import type { Business, BusinessInput } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

function isValidWebsite(value: string): boolean {
  if (!value.trim()) return true; // optional field
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    new URL(withScheme);
    return true;
  } catch {
    return false;
  }
}

export function AddBusinessModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (business: Business) => void;
}) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [form, setForm] = useState<BusinessInput>({
    companyName: "",
    website: "",
    industry: "",
    location: "",
    description: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: businessApi.create,
    onSuccess: (business) => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      notify("success", `${business.companyName} was added.`);
      reset();
      onClose();
      onCreated?.(business);
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : "Could not save this business. Please try again.");
    },
  });

  function reset() {
    setForm({ companyName: "", website: "", industry: "", location: "", description: "" });
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.companyName || form.companyName.trim().length < 2) {
      errors.companyName = "Company name must be at least 2 characters.";
    }
    if (form.website && !isValidWebsite(form.website)) {
      errors.website = "Enter a valid URL, e.g. https://example.com";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    setSubmitError(null);
    if (!validate()) return;
    mutation.mutate({
      companyName: form.companyName.trim(),
      website: form.website?.trim() || null,
      industry: form.industry?.trim() || null,
      location: form.location?.trim() || null,
      description: form.description?.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add business"
      subtitle="This information seeds business research and question generation for scans."
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} icon={<Building2 className="h-4 w-4" />}>
            Add business
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldWrap label="Company name" required error={fieldErrors.companyName}>
          <Input
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="Amsterdam Marketing BV"
            invalid={!!fieldErrors.companyName}
            autoFocus
          />
        </FieldWrap>

        <FieldWrap label="Website" error={fieldErrors.website} hint="Optional, but recommended for stronger business research.">
          <Input
            value={form.website ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://amsterdammarketing.nl"
            invalid={!!fieldErrors.website}
          />
        </FieldWrap>

        <div className="grid grid-cols-2 gap-4">
          <FieldWrap label="Industry">
            <Input
              value={form.industry ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              placeholder="Marketing agency"
            />
          </FieldWrap>
          <FieldWrap label="Location">
            <Input
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Amsterdam"
            />
          </FieldWrap>
        </div>

        <FieldWrap label="Description" hint="Used to ground question generation in real services/propositions.">
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="What does this business do, who does it serve, what makes it different?"
            rows={3}
          />
        </FieldWrap>

        {submitError && <InlineError message={submitError} />}
      </div>
    </Modal>
  );
}
