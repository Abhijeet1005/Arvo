import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-indigo-500 text-white",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-indigo-100 bg-indigo-50 text-indigo-700",
        success: "border-emerald-100 bg-emerald-50 text-emerald-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
