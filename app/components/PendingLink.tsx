"use client";

import Link, { useLinkStatus } from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function StatusBox({
  base,
  idle,
  pending,
  children,
}: {
  base: string;
  idle: string;
  pending: string;
  children: React.ReactNode;
}) {
  const { pending: isPending } = useLinkStatus();
  return (
    <span
      data-pending={isPending}
      className={`${base} ${isPending ? pending : idle}`}
    >
      {children}
    </span>
  );
}

const CHIP_BASE =
  "min-w-[44px] h-11 sm:min-w-[36px] sm:h-9 px-2 inline-flex items-center justify-center rounded-full text-sm font-mono transition-all duration-150 select-none touch-manipulation [-webkit-tap-highlight-color:transparent]";

const CHIP_IDLE =
  "text-ink border border-ink/10 bg-paper/60 hover:bg-ink/5 hover:border-ink/20 active:bg-ink active:text-bone active:border-ink";

const CHIP_PENDING =
  "bg-ink text-bone border border-ink shadow-soft scale-[1.02]";

export function PendingPageChip({ href, page }: { href: string; page: number }) {
  return (
    <Link href={href}>
      <StatusBox base={CHIP_BASE} idle={CHIP_IDLE} pending={CHIP_PENDING}>
        {page}
      </StatusBox>
    </Link>
  );
}

const ARROW_BASE =
  "h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-full border transition-all duration-150 select-none touch-manipulation [-webkit-tap-highlight-color:transparent]";

const ARROW_IDLE =
  "border-ink/10 bg-paper/60 text-ink hover:bg-ink hover:text-bone hover:border-ink active:bg-ink active:text-bone active:border-ink";

const ARROW_PENDING = "bg-ink text-bone border-ink shadow-soft";

export function PendingArrowLink({
  href,
  dir,
}: {
  href: string;
  dir: "prev" | "next";
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Link
      href={href}
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
    >
      <StatusBox base={ARROW_BASE} idle={ARROW_IDLE} pending={ARROW_PENDING}>
        <Icon size={16} />
      </StatusBox>
    </Link>
  );
}
