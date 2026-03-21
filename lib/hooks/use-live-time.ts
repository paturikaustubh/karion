"use client";

import { useState, useEffect } from "react";

/**
 * Returns a live-updating total seconds value.
 *
 * When isRunning is true, adds elapsed seconds since sessionStartedAt
 * to baseSeconds and ticks every second.
 * When isRunning is false, returns baseSeconds unchanged.
 *
 * @param baseSeconds - Total seconds already recorded (from API)
 * @param isRunning   - Whether a session is currently active
 * @param sessionStartedAt - ISO string of when the active session started
 */
export function useLiveTime(
  baseSeconds: number,
  isRunning: boolean,
  sessionStartedAt: string | null
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !sessionStartedAt) {
      setElapsed(0);
      return;
    }

    const startMs = new Date(sessionStartedAt).getTime();

    const tick = () =>
      setElapsed(Math.floor((Date.now() - startMs) / 1000));

    tick(); // immediate first tick — no flicker on mount
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, sessionStartedAt]);

  return baseSeconds + elapsed;
}
