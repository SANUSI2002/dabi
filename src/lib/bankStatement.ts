// Reads a bank statement file into statement lines: the CSV export Nigerian banks give (a few lines of
// account details, then a header row; debit and credit in separate columns or one signed amount;
// dd/mm/yyyy or 03-Sep-2026 dates; narrations with commas in quotes) and OFX/QFX downloads. Rows that are
// not transactions (opening/closing balance, totals) are left out and counted.

export type ParsedStatementLine = { date: string; amount: number; description: string; reference?: string };
export type ParsedStatement = { format: "csv" | "ofx" | "rows"; lines: ParsedStatementLine[]; skipped: number; error?: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString() : null;
};
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** A statement date as noon UTC (so it never shifts a day), or null. Numeric dates are day-first unless that can't be. */
export function statementDate(raw: string): string | null {
  const text = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?$/i, ""); // drop a time of day
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{4})(\d{2})(\d{2})(\d{4,6})?(\.\d+)?(\[[^\]]*\])?$/); // OFX: 20260903120000[+1:WAT]
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], fullYear(+m[3])];
    return a > 12 || b <= 12 ? iso(y, b, a) : iso(y, a, b); // day/month, unless the second part can only be a day
  }
  m = text.match(/^(\d{1,2})[\s/.-]([a-z]{3,9})[\s/.,-]+(\d{2,4})$/i);
  if (m) { const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1; return month ? iso(fullYear(+m[3]), month, +m[1]) : null; }
  m = text.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m) { const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1; return month ? iso(+m[3], month, +m[2]) : null; }
  return null;
}

/** An amount as written on a statement: commas, ₦/NGN, (brackets) or a DR/CR mark. NaN when there is none. */
export function statementAmount(raw: string | undefined): number {
  if (raw === undefined) return NaN;
  let text = raw.trim().replace(/[₦,\s]|NGN/gi, "");
  if (!text || text === "-") return NaN;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) { sign = -1; text = text.slice(1, -1); }
  const mark = text.match(/(dr|cr)\.?$/i);
  if (mark) { if (mark[1].toLowerCase() === "dr") sign = -sign; text = text.slice(0, -mark[0].length); }
  if (!/^[+-]?\d*\.?\d+$/.test(text)) return NaN;
  return Math.round(sign * Number(text) * 100) / 100;
}

/** Splits CSV text into rows of cells, honouring quotes; the delimiter is whichever of , ; or tab the text uses most. */
export function csvRows(text: string): string[][] {
  const sample = text.slice(0, 4000);
  const delimiter = [",", ";", "\t"].map((d) => [d, sample.split(d).length] as const).sort((x, y) => y[1] - x[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const COLUMNS = {
  date: ["trans date", "transaction date", "tran date", "txn date", "posting date", "post date", "date", "value date"],
  description: ["narration", "description", "transaction details", "details", "remarks", "particulars", "memo", "narrative"],
  debit: ["debit", "debits", "debit amount", "withdrawal", "withdrawals", "money out", "dr", "paid out"],
  credit: ["credit", "credits", "credit amount", "deposit", "deposits", "lodgement", "lodgements", "money in", "cr", "paid in"],
  amount: ["amount", "transaction amount", "amount (ngn)", "amount(ngn)"],
  direction: ["dr/cr", "cr/dr", "debit/credit", "d/c", "type", "transaction type"],
  reference: ["reference", "ref", "ref no", "ref. no", "reference number", "transaction ref", "trans ref", "cheque no", "chq no", "cheque number", "document number"],
};
type Column = keyof typeof COLUMNS;
const clean = (h: string) => h.toLowerCase().replace(/[^a-z0-9(). ]/g, " ").replace(/\s+/g, " ").trim();

function headerOf(row: string[]): Partial<Record<Column, number>> | null {
  const found: Partial<Record<Column, number>> = {};
  for (const key of Object.keys(COLUMNS) as Column[]) {
    // the earliest synonym wins (trans date before value date), whichever column it is in
    for (const name of COLUMNS[key]) {
      const at = row.findIndex((cell, i) => clean(cell) === clean(name) && !Object.values(found).includes(i));
      if (at >= 0) { found[key] = at; break; }
    }
  }
  const hasMoney = found.amount !== undefined || found.debit !== undefined || found.credit !== undefined;
  return found.date !== undefined && hasMoney ? found : null;
}

function fromCsv(text: string): ParsedStatement {
  const rows = csvRows(text);
  const at = rows.slice(0, 40).findIndex((r) => headerOf(r));
  if (at < 0) return fromRows(rows);
  const col = headerOf(rows[at])!;
  const cell = (r: string[], key: Column) => (col[key] === undefined ? undefined : r[col[key]!]);
  const lines: ParsedStatementLine[] = [];
  let skipped = 0;
  for (const r of rows.slice(at + 1)) {
    const date = statementDate(cell(r, "date") ?? "");
    const debit = statementAmount(cell(r, "debit"));
    const credit = statementAmount(cell(r, "credit"));
    let amount = col.amount !== undefined && !(debit || credit) ? statementAmount(cell(r, "amount")) : (Math.abs(credit) || 0) - (Math.abs(debit) || 0);
    const direction = cell(r, "direction")?.trim().toLowerCase();
    if (amount > 0 && direction && /^(d|dr|debit)$/.test(direction)) amount = -amount; // one amount column with a DR/CR column beside it
    const description = (cell(r, "description") ?? "").replace(/\s+/g, " ").trim();
    if (!date || !amount || /^(opening|closing|balance b\/?f|balance c\/?f|total)/i.test(description)) { skipped++; continue; }
    const reference = cell(r, "reference")?.trim();
    lines.push({ date, amount, description: description || "Bank statement line", ...(reference ? { reference: reference.slice(0, 100) } : {}) });
  }
  return { format: "csv", lines, skipped };
}

/** The plain form: one line per row — date, amount, description. */
function fromRows(rows: string[][]): ParsedStatement {
  const lines: ParsedStatementLine[] = [];
  let skipped = 0;
  for (const [rawDate = "", rawAmount, ...rest] of rows) {
    const date = statementDate(rawDate);
    const amount = statementAmount(rawAmount);
    if (!date || !amount) { skipped++; continue; }
    lines.push({ date, amount, description: rest.join(" ").trim() || "Bank statement line" });
  }
  return { format: "rows", lines, skipped };
}

function fromOfx(text: string): ParsedStatement {
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"))?.[1]?.trim();
  const lines: ParsedStatementLine[] = [];
  let skipped = 0;
  for (const b of blocks) {
    const date = statementDate(tag(b, "DTPOSTED") ?? "");
    const amount = statementAmount(tag(b, "TRNAMT"));
    if (!date || !amount) { skipped++; continue; }
    const description = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" — ") || "Bank statement line";
    const reference = tag(b, "CHECKNUM") || tag(b, "FITID");
    lines.push({ date, amount, description, ...(reference ? { reference: reference.slice(0, 100) } : {}) });
  }
  return { format: "ofx", lines, skipped };
}

/** Reads statement text: OFX/QFX if it looks like one, otherwise CSV (with a header) or plain rows. */
export function parseStatement(text: string): ParsedStatement {
  const body = text.replace(/^﻿/, "");
  if (!body.trim()) return { format: "rows", lines: [], skipped: 0, error: "The statement is empty." };
  const parsed = /<OFX>|<STMTTRN>/i.test(body) ? fromOfx(body) : fromCsv(body);
  return parsed.lines.length ? parsed : { ...parsed, error: "No transactions were found. Check the file is a bank statement (CSV or OFX) with dates and amounts." };
}

type KeyedLine = { date: string; amount: number; description: string; reference?: string };
const lineKey = (l: KeyedLine) => `${l.date.slice(0, 10)}|${Math.round(l.amount * 100) / 100}|${(l.reference || l.description).trim().toLowerCase()}`;
/** The incoming lines not already held for the account — same day, amount and reference (or description), once per copy held (the server applies the same rule). */
export function newLinesOnly<T extends KeyedLine>(held: KeyedLine[], incoming: T[]): T[] {
  const copies = new Map<string, number>();
  for (const l of held) copies.set(lineKey(l), (copies.get(lineKey(l)) ?? 0) + 1);
  return incoming.filter((l) => { const n = copies.get(lineKey(l)) ?? 0; if (n) copies.set(lineKey(l), n - 1); return !n; });
}
