import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px] accent-gradient shadow-[0_10px_26px_-12px_rgba(124,108,255,0.9)]">
        <span className="absolute inset-[1px] rounded-[10px] bg-[#080c16]/85" />
        <svg
          viewBox="0 0 24 24"
          className="relative h-[19px] w-[19px]"
          fill="none"
          aria-hidden
        >
          <path
            d="M5.5 17.5v-11l6.5 4.8 6.5-4.8v11"
            stroke="url(#logo-grad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5.5" cy="6.5" r="1.7" fill="#b9b0ff" />
          <circle cx="18.5" cy="6.5" r="1.7" fill="#67e8f9" />
          <circle cx="12" cy="11.3" r="1.45" fill="white" />
          <defs>
            <linearGradient id="logo-grad" x1="5" y1="6" x2="19" y2="18">
              <stop stopColor="#a99cff" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-white">
            CS-LearnMate
          </span>
          <span className="mt-1 hidden whitespace-nowrap text-[9.5px] font-medium tracking-[0.06em] text-slate-500 sm:block">
            计算机专业智能学习助手
          </span>
        </span>
      ) : null}
    </Link>
  );
}
