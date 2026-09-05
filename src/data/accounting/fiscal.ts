// Fiscal calendar & period locking.
//
// Reference: Team.books_locked_before (a single nullable date) plus a
// JournalEntry::saving guard. Sabi models an explicit fiscal year broken into
// 12 monthly periods, each Open / Closed / Locked, and a hard "books locked
// before" date that the ledger enforces on every post and reversal.

export type PeriodStatus = "Open" | "Closed" | "Locked";

export type AccountingPeriod = {
  id: string;
  fiscalYear: number;
  month: number; // 1–12
  label: string; // "Jan 2026"
  startDate: string;
  endDate: string;
  status: PeriodStatus;
};

export type FiscalYear = {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  status: "Open" | "Closed";
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildPeriods(year: number): AccountingPeriod[] {
  const now = new Date();
  return MONTHS.map((m, i) => {
    const start = new Date(Date.UTC(year, i, 1));
    const end = new Date(Date.UTC(year, i + 1, 0));
    // Past whole months that are done are Closed; anything from last month's
    // close onward is Open. (Locking is a separate, explicit action.)
    const isPast = end < new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {
      id: `period-${year}-${i + 1}`,
      fiscalYear: year,
      month: i + 1,
      label: `${m} ${year}`,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: (isPast && i < 4 ? "Locked" : isPast ? "Closed" : "Open") as PeriodStatus,
    };
  });
}

export const seedFiscalYears: FiscalYear[] = [
  { id: "fy-2025", year: 2025, startDate: "2025-01-01T00:00:00.000Z", endDate: "2025-12-31T23:59:59.999Z", status: "Closed" },
  { id: "fy-2026", year: 2026, startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T23:59:59.999Z", status: "Open" },
];

export const seedPeriods: AccountingPeriod[] = buildPeriods(2026);

// Everything on or after 2026-01-01 is editable; the opening entry sits exactly
// on the boundary. Reference default is null (no lock) — Sabi seeds a realistic
// "prior year closed" lock.
export const seedBooksLockedBefore = "2026-01-01T00:00:00.000Z";
