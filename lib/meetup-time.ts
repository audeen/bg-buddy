export const DEFAULT_MEETUP_DURATION_MINUTES = 240;

type MeetupTimeFields = {
  scheduledAt: Date | null;
  durationMinutes?: number | null;
};

/** End of a meetup (start + duration) or null if no date is set. */
export function meetupEndsAt(meetup: MeetupTimeFields): Date | null {
  if (!meetup.scheduledAt) return null;
  const minutes = meetup.durationMinutes ?? DEFAULT_MEETUP_DURATION_MINUTES;
  return new Date(meetup.scheduledAt.getTime() + minutes * 60_000);
}

/**
 * A meetup counts as past once its end time is before `now`.
 * Meetups without a scheduled date are treated as upcoming.
 */
export function isMeetupPast(
  meetup: MeetupTimeFields,
  now: Date = new Date(),
): boolean {
  const endsAt = meetupEndsAt(meetup);
  if (!endsAt) return false;
  return endsAt.getTime() < now.getTime();
}
