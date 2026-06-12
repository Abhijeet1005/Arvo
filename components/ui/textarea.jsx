import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm leading-relaxed shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
