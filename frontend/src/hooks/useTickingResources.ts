import { useEffect, useRef, useState } from 'react';

type ResMap = Record<string, number>;

/**
 * Makes a resource bar feel alive: between server updates it interpolates each
 * resource forward at its per-hour production rate, and flashes a resource when a
 * fresh server snapshot increases it.
 *
 * @param resources server-truth resource amounts (re-anchors the count-up when it changes)
 * @param production per-hour production rates keyed by the same resource names
 * @returns display = smoothly advancing amounts, flash = resources that just jumped up
 */
export function useTickingResources(resources?: ResMap, production?: ResMap) {
  const [display, setDisplay] = useState<ResMap>(resources || {});
  const [flash, setFlash] = useState<Record<string, boolean>>({});

  // anchor = last server truth + the time we received it; the loop extrapolates from here
  const anchorRef = useRef<{ res: ResMap; t: number }>({ res: resources || {}, t: Date.now() });
  const prodRef = useRef<ResMap>(production || {});
  prodRef.current = production || {};

  // Re-anchor whenever server truth changes; flash any resource that went up
  useEffect(() => {
    if (!resources) return;
    const prev = anchorRef.current.res;
    const bumped: Record<string, boolean> = {};
    for (const k of Object.keys(resources)) {
      if (prev[k] !== undefined && resources[k] > prev[k] + 0.01) bumped[k] = true;
    }
    anchorRef.current = { res: { ...resources }, t: Date.now() };
    setDisplay({ ...resources });
    if (Object.keys(bumped).length) {
      setFlash(bumped);
      const id = setTimeout(() => setFlash({}), 900);
      return () => clearTimeout(id);
    }
  }, [resources]);

  // Tick the display forward a few times a second (cheap, smooth enough to read as "live")
  useEffect(() => {
    const id = setInterval(() => {
      const { res, t } = anchorRef.current;
      const elapsed = (Date.now() - t) / 1000; // seconds since last server truth
      const prod = prodRef.current;
      const next: ResMap = {};
      for (const k of Object.keys(res)) {
        const perSecond = (prod[k] || 0) / 3600;
        next[k] = res[k] + perSecond * elapsed;
      }
      setDisplay(next);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return { display, flash };
}
