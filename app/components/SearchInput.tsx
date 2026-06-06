"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchInput({ value }: { value: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [text, setText] = useState(value ?? "");
  const lastPushed = useRef(value ?? "");

  useEffect(() => {
    const next = value ?? "";
    setText(next);
    lastPushed.current = next;
  }, [value]);

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === lastPushed.current) return;

    const flush = () => {
      const sp = new URLSearchParams(params.toString());
      if (trimmed) sp.set("q", trimmed);
      else sp.delete("q");
      sp.set("page", "1");
      lastPushed.current = trimmed;
      const s = sp.toString();
      router.push(s ? `${pathname}?${s}` : pathname);
    };

    // No debounce when the box is cleared — clearing should feel instant so
    // the Suspense skeleton can show immediately rather than waiting 350ms.
    if (!trimmed) {
      flush();
      return;
    }

    const t = setTimeout(flush, 350);
    return () => clearTimeout(t);
  }, [text, params, pathname, router]);

  const hasText = text.length > 0;

  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-muted"
        aria-hidden
      />
      <Input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label="Search listings"
        placeholder="Search make, model, color…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-11 sm:h-9 rounded-full bg-paper/90 border-ink/10 pl-9 pr-10 text-sm font-medium text-ink placeholder:text-ink-muted-2 hover:border-ink/30 focus-visible:border-ink/30 focus-visible:ring-ink/20"
      />
      {hasText && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          onClick={() => setText("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full text-ink-muted hover:text-ink hover:bg-ink/5"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
