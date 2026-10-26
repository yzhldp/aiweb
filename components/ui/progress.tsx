import { cn } from "@/lib/utils";

export function Progress({
  value,
  indeterminate = false,
  className,
  barClassName,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]",
        className
      )}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div className="h-full w-full animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,rgba(124,108,255,0.85),rgba(34,211,238,0.7),transparent)] bg-[length:200%_100%]" />
      ) : (
        <div
          className={cn(
            "h-full rounded-full accent-gradient transition-all duration-500",
            barClassName
          )}
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
        />
      )}
    </div>
  );
}
