/**
 * CSV generation with two non-obvious protections:
 *
 *  1. RFC 4180 quoting - a comma, quote or newline inside a value cannot break
 *     the column structure.
 *  2. Formula-injection prefixing - a value beginning with = + - @ is treated
 *     by spreadsheet software as a formula. Such values are prefixed with an
 *     apostrophe so opening a payroll export can never execute a formula an
 *     employee typed into a text field.
 */

const dangerous = /^[=+\-@\t\r]/;

const cell = (value) => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (dangerous.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const toCsv = (rows, columns) => {
  const header = columns.map((column) => cell(column.label)).join(",");
  const lines = (rows || []).map((row) =>
    columns
      .map((column) => {
        const raw = typeof column.value === "function" ? column.value(row) : row[column.key];
        return cell(column.format ? column.format(raw, row) : raw);
      })
      .join(",")
  );
  return [header, ...lines].join("\r\n");
};

export const sendCsv = (res, filename, columns, rows) => {
  const body = toCsv(rows, columns);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // UTF-8 BOM so Excel renders non-ASCII names and the rupee sign correctly.
  return res.status(200).send(`\uFEFF${body}`);
};

export default { toCsv, sendCsv };
