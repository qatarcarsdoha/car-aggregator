"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export function FilterSelect({
  paramName,
  label,
  value,
  options,
  allLabel,
  ariaLabel,
  disabled,
  clearParams,
}: {
  paramName: string;
  label: string;
  value: string | null;
  options: string[];
  allLabel: string;
  ariaLabel: string;
  disabled?: boolean;
  // Other query params to clear when this value changes (e.g. clear "model" when "make" changes).
  clearParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (!next || next === ALL) {
      sp.delete(paramName);
    } else {
      sp.set(paramName, next);
    }
    for (const k of clearParams ?? []) sp.delete(k);
    sp.set("page", "1");
    const s = sp.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  const selected = value ?? ALL;
  const isActive = !!value;

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
      <span className="label hidden sm:inline">{label}</span>
      <Select value={selected} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          aria-label={ariaLabel}
          data-active={isActive}
          className="h-11 sm:h-9 w-full sm:w-auto sm:min-w-[140px] min-w-0 rounded-full bg-paper/90 border border-ink/10 px-3.5 sm:px-4 text-sm font-medium text-ink hover:border-ink/30 focus:ring-2 focus:ring-ink/20 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:text-ink-muted [&>span]:truncate [&>span]:min-w-0 data-[active=true]:bg-brand data-[active=true]:text-white data-[active=true]:border-brand data-[active=true]:[&_svg]:text-white/80 data-[active=true]:shadow-soft"
        >
          <SelectValue placeholder={label}>
            {(v) => (v === ALL ? label : v)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          align="end"
          sideOffset={6}
          className="rounded-2xl border-ink/10 bg-paper/95 backdrop-blur shadow-lift w-[220px] max-h-72"
        >
          <SelectItem
            value={ALL}
            className="rounded-lg text-sm py-2.5 focus:bg-bone focus:text-ink data-[state=checked]:text-brand data-[state=checked]:font-medium"
          >
            {allLabel}
          </SelectItem>
          {options.map((o) => (
            <SelectItem
              key={o}
              value={o}
              className="rounded-lg text-sm py-2.5 focus:bg-bone focus:text-ink data-[state=checked]:text-brand data-[state=checked]:font-medium"
            >
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
