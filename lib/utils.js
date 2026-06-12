import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui + 21st.dev class-merge helper.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
