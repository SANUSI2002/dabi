import { describe, expect, it } from "vitest";
import { parseStatement, statementAmount, statementDate } from "./bankStatement";

const day = (iso: string | null) => iso?.slice(0, 10);

describe("bank statement files", () => {
  it("reads Nigerian statement dates day-first, never shifting a day", () => {
    expect(day(statementDate("03/09/2026"))).toBe("2026-09-03");
    expect(day(statementDate("03-Sep-2026"))).toBe("2026-09-03");
    expect(day(statementDate("03-SEP-26"))).toBe("2026-09-03");
    expect(day(statementDate("2026-09-03"))).toBe("2026-09-03");
    expect(day(statementDate("09/25/2026"))).toBe("2026-09-25"); // only month-first can be right
    expect(day(statementDate("03/09/2026 14:22"))).toBe("2026-09-03");
    expect(day(statementDate("20260903120000[+1:WAT]"))).toBe("2026-09-03");
    expect(statementDate("31/02/2026")).toBeNull();
    expect(statementDate("Opening balance")).toBeNull();
  });

  it("reads amounts as banks write them", () => {
    expect(statementAmount("₦1,250,000.50")).toBe(1250000.5);
    expect(statementAmount("(12,500.00)")).toBe(-12500);
    expect(statementAmount("12,500.00 DR")).toBe(-12500);
    expect(statementAmount("45000CR")).toBe(45000);
    expect(statementAmount("")).toBeNaN();
    expect(statementAmount("-")).toBeNaN();
  });

  it("reads a bank CSV export: account details first, separate debit and credit, quoted narrations", () => {
    const csv = [
      "Account Name,SABI TEST GENERAL HOSPITAL",
      "Account Number,0123456789",
      "Period,01-Sep-2026 to 30-Sep-2026",
      "",
      "Trans Date,Value Date,Reference,Narration,Debit,Credit,Balance",
      "01-Sep-2026,01-Sep-2026,,Opening Balance,,,\"2,000,000.00\"",
      "03-Sep-2026,03-Sep-2026,NIP/778,\"TRF FROM ADEBAYO, OLUWASEUN - HMO\",,\"45,000.00\",\"2,045,000.00\"",
      "04-Sep-2026,05-Sep-2026,POS-112,POS TERMINAL RENTAL,\"12,500.00\",,\"2,032,500.00\"",
      "30-Sep-2026,30-Sep-2026,,Closing Balance,,,\"2,032,500.00\"",
    ].join("\r\n");
    const parsed = parseStatement(csv);
    expect(parsed.format).toBe("csv");
    expect(parsed.lines).toEqual([
      { date: "2026-09-03T12:00:00.000Z", amount: 45000, description: "TRF FROM ADEBAYO, OLUWASEUN - HMO", reference: "NIP/778" },
      { date: "2026-09-04T12:00:00.000Z", amount: -12500, description: "POS TERMINAL RENTAL", reference: "POS-112" },
    ]);
    expect(parsed.skipped).toBe(2); // opening and closing balance
  });

  it("reads one amount column with a DR/CR column, and semicolon files", () => {
    const parsed = parseStatement("Date;Description;Amount;DR/CR\n03/09/2026;SMS ALERT CHARGES;52.50;DR\n04/09/2026;TRANSFER IN;10000;CR\n");
    expect(parsed.lines.map((l) => [day(l.date), l.amount])).toEqual([["2026-09-03", -52.5], ["2026-09-04", 10000]]);
  });

  it("reads OFX downloads", () => {
    const ofx = "OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260904120000[+1:WAT]<TRNAMT>-12500.00<FITID>778901<NAME>POS TERMINAL RENTAL</STMTTRN>\n<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260905<TRNAMT>45000<FITID>778902<NAME>TRANSFER<MEMO>HMO settlement</STMTTRN>\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    expect(parseStatement(ofx)).toEqual({ format: "ofx", skipped: 0, lines: [
      { date: "2026-09-04T12:00:00.000Z", amount: -12500, description: "POS TERMINAL RENTAL", reference: "778901" },
      { date: "2026-09-05T12:00:00.000Z", amount: 45000, description: "TRANSFER — HMO settlement", reference: "778902" },
    ] });
  });

  it("still takes pasted rows of date, amount, description", () => {
    const parsed = parseStatement("2026-09-01, -12500, POS terminal rental\n2026-09-03, 45000, Transfer from patient\nnot a row");
    expect(parsed).toMatchObject({ format: "rows", skipped: 1 });
    expect(parsed.lines[1]).toEqual({ date: "2026-09-03T12:00:00.000Z", amount: 45000, description: "Transfer from patient" });
  });

  it("says so when nothing in the file is a transaction", () => {
    expect(parseStatement("hello\nworld").error).toMatch(/No transactions/);
    expect(parseStatement("").error).toMatch(/empty/);
  });
});
