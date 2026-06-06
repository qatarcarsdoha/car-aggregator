"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative inline-flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-ink/10 bg-paper/60 backdrop-blur transition hover:bg-paper hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      suppressHydrationWarning
    >
      <Sun
        size={15}
        className="absolute transition-all duration-300 rotate-0 scale-100 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        size={15}
        className="absolute transition-all duration-300 rotate-90 scale-0 dark:rotate-0 dark:scale-100"
      />
    </button>
  );
}
