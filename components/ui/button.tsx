import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 active:scale-[0.985]",
  {
    variants: {
      variant: {
        primary:
          "bg-white text-ink-950 hover:bg-slate-100 shadow-[0_12px_30px_-18px_rgba(255,255,255,0.65)]",
        accent:
          "accent-gradient text-white shadow-[0_16px_45px_-20px_rgba(124,108,255,0.8)] hover:brightness-110",
        secondary:
          "border border-white/10 bg-white/[0.055] text-slate-100 hover:border-white/20 hover:bg-white/[0.09]",
        outline:
          "border border-white/12 bg-transparent text-slate-200 hover:border-accent/40 hover:bg-accent/[0.08] hover:text-white",
        ghost:
          "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
        danger:
          "border border-rose-400/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/18 hover:text-rose-200",
        soft:
          "bg-accent/15 text-accent-soft border border-accent/25 hover:bg-accent/22",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 rounded-[14px] px-6 text-[15px]",
        icon: "h-9 w-9 rounded-lg",
        "icon-sm": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button };
