"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowUp, House } from "lucide-react";

const SCROLL_THRESHOLD = 320;

export function BackToTopButton() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pageParam = params.get("page");
  const onLaterPage = !!pageParam && pageParam !== "1";

  // On a later page: always show, so the user can always escape back to the
  // start of the feed. On page 1: only show after the user has scrolled enough
  // that "back to top" is a useful affordance.
  const visible = onLaterPage || scrolled;

  function onClick() {
    if (onLaterPage) {
      const sp = new URLSearchParams(params.toString());
      sp.delete("page");
      const s = sp.toString();
      router.push(s ? `${pathname}?${s}` : pathname);
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const label = onLaterPage ? "Back to first page" : "Back to top";
  const Icon = onLaterPage ? House : ArrowUp;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-visible={visible}
      className="sm:hidden fixed bottom-5 right-5 z-30 inline-flex items-center justify-center size-11 rounded-full bg-paper/90 backdrop-blur border border-ink/10 text-ink shadow-soft transition-all duration-200 active:scale-95 active:bg-ink active:text-bone active:border-ink [-webkit-tap-highlight-color:transparent] data-[visible=false]:opacity-0 data-[visible=false]:translate-y-3 data-[visible=false]:pointer-events-none"
    >
      <Icon className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}
