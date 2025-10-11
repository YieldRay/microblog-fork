import { Temporal } from "@js-temporal/polyfill";

/**
 * Parse database timestamp to Temporal.Instant
 * Handles both SQLite and PostgreSQL timestamp formats
 *
 * @param timestamp - Database timestamp string
 * @returns Temporal.Instant object
 *
 * @example
 * // SQLite formats
 * parseTimestamp("2025-10-11 17:22:24")
 * parseTimestamp("2025-10-11T17:22:24Z")
 *
 * @example
 * // PostgreSQL formats
 * parseTimestamp("2025-10-11T17:22:24.746985+00:00")
 * parseTimestamp("2025-10-11 17:22:24.746985+00")
 * parseTimestamp("2025-10-11 17:22:24.746985+00Z")
 */
export function parseTimestamp(timestamp: string): Temporal.Instant {
  let normalized = timestamp.trim();

  // Replace space with T if needed
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  // Fix PostgreSQL timezone format: +00 -> +00:00, +00Z -> +00:00
  normalized = normalized.replace(/\+(\d{2})Z?$/, "+$1:00");
  normalized = normalized.replace(/-(\d{2})Z?$/, "-$1:00");

  // Add Z if no timezone specified
  if (
    !normalized.includes("+") &&
    !normalized.includes("-") &&
    !normalized.endsWith("Z")
  ) {
    normalized += "Z";
  }

  return Temporal.Instant.from(normalized);
}

/**
 * Format relative time (e.g., "2 hours ago", "just now")
 */
export function formatRelativeTime(timestamp: string): string {
  const time = parseTimestamp(timestamp);
  const currentTime = Temporal.Now.instant();
  const duration = currentTime.since(time);

  const totalMinutes = duration.total("minutes");
  const totalHours = duration.total("hours");
  const totalDays = duration.total("days");

  if (totalMinutes < 1) return "just now";
  if (totalMinutes < 60) return `${Math.floor(totalMinutes)} minutes ago`;
  if (totalHours < 24) return `${Math.floor(totalHours)} hours ago`;
  return `${Math.floor(totalDays)} days ago`;
}

/**
 * Format timestamp for display in locale format
 */
export function formatForDisplay(timestamp: string): string {
  return parseTimestamp(timestamp)
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime()
    .toLocaleString();
}

/**
 * Format timestamp for datetime attribute (ISO 8601)
 */
export function formatForDateTimeAttribute(timestamp: string): string {
  return parseTimestamp(timestamp).toString();
}
