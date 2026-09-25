/* Spreadsheets for the owner — orders for dispatch, the mailing list.
 *
 * Every value here was typed by a customer, and a spreadsheet will run a cell
 * that starts with = + - @ as a formula. A "name" of =HYPERLINK(...) would
 * then execute on the owner's computer the moment the file is opened. Such
 * cells are prefixed with an apostrophe, which spreadsheets read as "this is
 * text", and which is invisible in the cell. */

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = "'" + s;
  // Quote everything: commas, quotes and line breaks in an address are normal.
  return '"' + s.replace(/"/g, '""') + '"';
}

/** Header row plus data rows → CSV text, with a BOM so Excel reads ₦ correctly. */
export function toCsv(header, rows) {
  const lines = [header, ...rows].map(r => r.map(cell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
