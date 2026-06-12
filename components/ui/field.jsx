import { cn } from "@/lib/utils";

// Label + control wrapper used across the config/knowledge forms.
export function Field({ label, children, className }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
