import { ChevronLeft, ChevronRight } from "lucide-react";
import { PendingPageChip, PendingArrowLink } from "./PendingLink";

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  // Show up to 5 page chips around the current page, with ellipses.
  const windowSize = 2;
  const pages: (number | "…")[] = [];
  const start = Math.max(1, page - windowSize);
  const end = Math.min(totalPages, page + windowSize);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("…");
  }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 sm:gap-2 py-10">
      {prev ? (
        <PendingArrowLink href={buildHref(prev)} dir="prev" />
      ) : (
        <DisabledArrow dir="prev" />
      )}

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="px-1.5 text-ink-muted text-sm select-none">
              …
            </span>
          ) : p === page ? (
            <ActiveChip key={p} page={p} />
          ) : (
            <PendingPageChip key={p} page={p} href={buildHref(p)} />
          )
        )}
      </div>

      {next ? (
        <PendingArrowLink href={buildHref(next)} dir="next" />
      ) : (
        <DisabledArrow dir="next" />
      )}
    </nav>
  );
}

const CHIP_BASE =
  "min-w-[44px] h-11 sm:min-w-[36px] sm:h-9 px-2 inline-flex items-center justify-center rounded-full text-sm font-mono select-none";

function ActiveChip({ page }: { page: number }) {
  return <span className={`${CHIP_BASE} bg-ink text-bone`}>{page}</span>;
}

function DisabledArrow({ dir }: { dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <span className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-full border border-ink/5 text-ink-muted-2 cursor-not-allowed select-none">
      <Icon size={16} />
    </span>
  );
}
