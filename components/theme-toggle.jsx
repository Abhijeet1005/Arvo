'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch (e) {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-150 ease-out-strong hover:bg-secondary hover:text-foreground active:scale-95"
    >
      {/* Render the icon only after mount so it matches the resolved theme (no hydration mismatch) */}
      {mounted && (dark ? <Sun className="size-4" /> : <Moon className="size-4" />)}
    </button>
  );
}
