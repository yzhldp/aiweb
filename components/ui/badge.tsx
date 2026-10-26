import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 tracking-wide",
  {
    variants: {
      variant: {
        accent: "border-accent/25 bg-accent/12 text-accent-soft",
        cyan: "border-cyan/25 bg-cyan/10 text-cyan-soft",
        mint: "border-mint/25 bg-mint/10 text-mint-soft",
        amber: "border-amber/25 bg-amber/10 text-amber-soft",
        danger: "border-rose-400/25 bg-rose-400/10 text-rose-300",
        muted: "border-white/10 bg-white/[0.04] text-slate-400",
        outline: "border-white/12 bg-transparent text-slate-300",
      },
    },
    defaultVariants: { variant: "muted" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
