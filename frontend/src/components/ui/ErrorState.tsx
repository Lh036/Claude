import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/40 px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-[var(--color-danger-soft)] p-3 text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-ink-muted)]">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} icon={<RotateCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
      {message}
    </p>
  );
}
