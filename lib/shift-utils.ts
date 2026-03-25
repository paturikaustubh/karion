// lib/shift-utils.ts

/**
 * Given a UTC check-in time ("HH:mm") and a reference `now`,
 * returns the start and end of the currently active shift.
 *
 * A shift runs from checkInTime on day D to checkInTime on day D+1 minus 1 minute.
 * If now >= today's checkIn  → active shift started today.
 * If now < today's checkIn   → active shift started yesterday.
 */
export function getCurrentShift(
  checkInTimeUTC: string,  // "HH:mm" in UTC
  now: Date = new Date()
): { start: Date; end: Date } {
  const [hours, minutes] = checkInTimeUTC.split(":").map(Number);

  const todayCheckIn = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );

  const shiftStart =
    now >= todayCheckIn
      ? todayCheckIn
      : new Date(todayCheckIn.getTime() - 24 * 60 * 60 * 1000);

  // 24 hours - 1 minute
  const shiftEnd = new Date(shiftStart.getTime() + 24 * 60 * 60 * 1000 - 60 * 1000);

  return { start: shiftStart, end: shiftEnd };
}
