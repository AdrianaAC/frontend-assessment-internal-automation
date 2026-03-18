const MAX_RESOURCE_SEGMENT_LENGTH = 80;
const MAX_CHANNEL_SLUG_LENGTH = 48;

// Removes accents so names can be reused safely in system-generated identifiers.
function removeDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

// Standardizes email addresses for matching and storage.
export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

// Verifies that a date string is both well-formed and a real calendar date.
export function isValidISODateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Trims date input so validated dates are stored in a consistent format.
export function normalizeISODateString(value: string) {
  return value.trim();
}

// Collapses noisy spacing before names are reused in generated resources.
function normalizeResourceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

// Cleans text so it is safe to use as part of a folder path.
export function sanitizePathSegment(
  value: string,
  fallback = "Unnamed Client"
) {
  const sanitizedValue = normalizeResourceText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, MAX_RESOURCE_SEGMENT_LENGTH)
    .trim();

  return sanitizedValue.length > 0 ? sanitizedValue : fallback;
}

// Cleans text so it is safe to show as a generated workspace name.
export function sanitizeDisplayName(
  value: string,
  fallback = "Unnamed Workspace"
) {
  const sanitizedValue = normalizeResourceText(value)
    .replace(/[\u0000-\u001F]/g, "")
    .slice(0, MAX_RESOURCE_SEGMENT_LENGTH)
    .trim();

  return sanitizedValue.length > 0 ? sanitizedValue : fallback;
}

// Builds a short channel slug that only contains safe URL-style characters.
export function buildChannelSlug(value: string, suffix = "kickoff") {
  const baseSlug = removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  const safeBase = baseSlug.length > 0 ? baseSlug : "client";
  const maxBaseLength = Math.max(1, MAX_CHANNEL_SLUG_LENGTH - suffix.length - 1);
  const truncatedBase = safeBase.slice(0, maxBaseLength).replace(/-+$/g, "");

  return `${truncatedBase.length > 0 ? truncatedBase : "client"}-${suffix}`;
}
