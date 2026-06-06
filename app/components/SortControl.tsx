"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, type SortValue } from "./sort-options";

export function SortControl({ value }: { value: SortValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string | null) {
    if (!next) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("sort", next);
    sp.set("page", "1");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <span className="label hidden sm:inline">Sort</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Sort listings"
          data-active={value !== "newest"}
          className="h-11 sm:h-9 w-full sm:w-auto sm:min-w-[140px] min-w-0 rounded-full bg-paper/90 border border-ink/10 px-3.5 sm:px-4 text-sm font-medium text-ink hover:border-ink/30 focus:ring-2 focus:ring-ink/20 focus:ring-offset-0 [&_svg]:text-ink-muted [&>span]:truncate [&>span]:min-w-0 data-[active=true]:bg-brand data-[active=true]:text-white data-[active=true]:border-brand data-[active=true]:[&_svg]:text-white/80 data-[active=true]:shadow-soft"
        >
          <SelectValue placeholder="Sort">
            {(v) => (v === "newest" ? "Sort" : SORT_OPTIONS.find((o) => o.value === v)?.label ?? "Sort")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="end"
          sideOffset={6}
          className="rounded-2xl border-ink/10 bg-paper/95 backdrop-blur shadow-lift min-w-[220px]"
        >
          {SORT_OPTIONS.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              className="rounded-lg text-sm py-2.5 focus:bg-bone focus:text-ink data-[state=checked]:text-brand data-[state=checked]:font-medium"
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
