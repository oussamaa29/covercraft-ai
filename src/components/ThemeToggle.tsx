"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "system" | "light" | "dark";
const KEY = "covercraft:theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const ICONS = { system: Monitor, light: Sun, dark: Moon };
const LABELS = { system: "System theme", light: "Light theme", dark: "Dark theme" };

/** Runs in <head> before paint, so a saved theme never flashes the wrong one. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
}

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** Cycles System → Light → Dark. The tokens in globals.css do the rest. */
export function ThemeToggle({ className }: { className?: string }) {
  // The source of truth is data-theme on <html> (set by the head script or
  // apply()); the server always renders "system".
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={`${LABELS[theme]} — switch to ${LABELS[next].toLowerCase()}`}
      title={LABELS[theme]}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft",
        className
      )}
    >
      <Icon size={17} />
    </button>
  );
}
