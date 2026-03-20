/**
 * Merges overlapping session intervals and returns total wall-clock seconds.
 * Sessions with null endTime are treated as still running (endTime = now).
 */
export function mergeIntervals(
  sessions: { startTime: Date; endTime: Date | null }[]
): number {
  if (sessions.length === 0) return 0;

  const intervals = sessions
    .map((s) => ({
      start: s.startTime.getTime(),
      end: (s.endTime ?? new Date()).getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  let totalMs = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;

  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].start <= curEnd) {
      curEnd = Math.max(curEnd, intervals[i].end);
    } else {
      totalMs += curEnd - curStart;
      curStart = intervals[i].start;
      curEnd = intervals[i].end;
    }
  }
  totalMs += curEnd - curStart;

  return Math.floor(totalMs / 1000);
}

/**
 * Formats seconds into human-readable duration string.
 * e.g. 3661 → "1h 1m"
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return "<1m";
}
