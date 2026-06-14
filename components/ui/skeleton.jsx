import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return <div className={cn("animate-pulse rounded-md bg-stone-200/70 dark:bg-stone-700/40", className)} {...props} />;
}

export { Skeleton };
