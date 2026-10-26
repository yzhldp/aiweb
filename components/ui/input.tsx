import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-accent/45 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-none rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 transition-colors focus:border-accent/45 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
