import { sendCsv } from "../utils/csv.js";

/** Thin wrapper so controllers do not need to know the response shape. */
export const csvResponse = (res, filename, columns, rows) =>
  sendCsv(res, filename, columns, rows);

export default { csvResponse };
