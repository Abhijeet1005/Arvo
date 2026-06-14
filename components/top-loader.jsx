'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// A thin top progress bar that animates during client-side route changes.
// App Router has no router events, so we start the bar on internal link
// clicks and complete it when the pathname actually changes.
export function TopLoader() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef(null);
  const hide = useRef(null);
  const first = useRef(true);

  function start() {
    clearInterval(trickle.current);
    clearTimeout(hide.current);
    setVisible(true);
    setProgress(8);
    // Ease toward 90% so the bar keeps moving while the route loads.
    trickle.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(0.4, (90 - p) * 0.08)));
    }, 220);
  }

  function finish() {
    clearInterval(trickle.current);
    setProgress(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 280);
  }

  // Begin the bar when an internal link is clicked.
  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      const target = a.getAttribute('target');
      if (!href || target === '_blank') return;
      if (!href.startsWith('/') || href.startsWith('//')) return; // internal routes only
      if (href.split('#')[0].split('?')[0] === pathname) return; // same page
      start();
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  // Complete the bar once the route has changed.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    finish();
  }, [pathname]);

  // Clean up timers on unmount.
  useEffect(
    () => () => {
      clearInterval(trickle.current);
      clearTimeout(hide.current);
    },
    []
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full rounded-r-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] transition-[width,opacity] duration-200 ease-out-strong"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
