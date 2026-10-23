/**
 * Date-only helpers for records such as leave, where a day range is
 * inclusive and must not shift when the browser's timezone differs from the
 * server's.
 *
 * A leave request from 28 Oct to 1 Nov is five working calendar days, not
 * four: both the first and last day are part of the leave. Extracting the
 * YYYY-MM-DD prefix keeps the result stable for Mongo ISO timestamps.
 */
const dateKey = (value) => {
  if (!value) return NaN;
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NaN;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
};

/** Inclusive number of calendar days, or 0 for an invalid/reversed range. */
export const inclusiveDays = (start, end) => {
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  if (Number.isNaN(startKey) || Number.isNaN(endKey) || endKey < startKey) return 0;
  return Math.round((endKey - startKey) / 86400000) + 1;
};
