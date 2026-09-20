/**
 * Standard Cooperative Chart of Accounts (COA) Template
 * ─────────────────────────────────────────────────────────────
 * "Standard COA Template Loader" seed payload for Nepal SACCOS /
 * cooperatives. Mirror of `assets/chart_of_accounts.json` (the NRB /
 * Cooperative-Department style hierarchy used by the project), normalized to
 * the `chart_of_accounts` schema:
 *   - `type` mapped to the DB enum (Asset/Liability/Equity/Income/Expense)
 *   - `parentCode` derived from dash-segmented GL codes (parent exists)
 *   - `allowPosting` = leaf accounts only (group/heading rows are non-posting)
 *   - `normalBalance` derived from account class
 *
 * Codes are unique per organization (coa_org_code_uniq) — re-seeding skips
 * existing codes instead of failing.
 */

export interface CoaTemplateAccount {
  /** Unique GL code within the organization, e.g. "04-100-001". */
  code: string;
  /** Account name (English). */
  name: string;
  /** Account name (Nepali / Devanagari), when known. */
  nameNepali: string | null;
  type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  /** GL code of the parent account, or null for a root account. */
  parentCode: string | null;
  /** Whether vouchers may post directly to this account. */
  allowPosting: boolean;
  /** Whether this account is a roll-up / control heading (non-posting). */
  isControlAccount: boolean;
  normalBalance: 'debit' | 'credit';
  /** Opening balance to seed (always 0 for the standard template). */
  balance: number;
}

export const DEFAULT_COA_TEMPLATE: CoaTemplateAccount[] = [
  { code: "01", name: "Equity", nameNepali: null, type: "Liability", parentCode: null, allowPosting: false, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "02", name: "Expenses", nameNepali: "खर्च खाता", type: "Expense", parentCode: null, allowPosting: false, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "03", name: "Income & Gain", nameNepali: "आम्दानी खाता", type: "Income", parentCode: null, allowPosting: false, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "04", name: "Assets", nameNepali: "सम्पत्ती खाता", type: "Asset", parentCode: null, allowPosting: false, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "05", name: "Liabilities", nameNepali: "दायित्त्व खाता", type: "Liability", parentCode: null, allowPosting: false, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-10", name: "Share Capital", nameNepali: null, type: "Liability", parentCode: "01", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20", name: "Reserve Funds", nameNepali: "काेष हिसाब", type: "Liability", parentCode: "01", allowPosting: false, isControlAccount: true, normalBalance: "credit", balance: 0 },
  { code: "04-100", name: "Investment", nameNepali: "लगानी", type: "Asset", parentCode: "04", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "04-110", name: "Loan A/c", nameNepali: "कर्जा दिएकाे हिसाब", type: "Asset", parentCode: "04", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "04-120", name: "Receivable", nameNepali: "पाउनु पर्ने हिसाब", type: "Asset", parentCode: "04", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "04-130", name: "Current Assets", nameNepali: "चालु सम्पत्ती", type: "Asset", parentCode: "04", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "04-140", name: "Fixed Assets", nameNepali: "अचल सम्पत्ती", type: "Asset", parentCode: "04", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "04-80", name: "Cash", nameNepali: "नगद हिसाब", type: "Asset", parentCode: "04", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "04-90", name: "Bank A/c", nameNepali: "बैँक खाता", type: "Asset", parentCode: "04", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "05-30", name: "Member Deposit", nameNepali: "बचत खाता", type: "Liability", parentCode: "05", allowPosting: false, isControlAccount: true, normalBalance: "credit", balance: 0 },
  { code: "05-40", name: "Loans Payable", nameNepali: "लिएकाे कर्जा", type: "Liability", parentCode: "05", allowPosting: false, isControlAccount: true, normalBalance: "credit", balance: 0 },
  { code: "05-50", name: "Grant", nameNepali: "अनुदान", type: "Liability", parentCode: "05", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-60", name: "Payable", nameNepali: "भुक्तानी दिनुपर्ने", type: "Liability", parentCode: "05", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-70", name: "Other Payable", nameNepali: "अन्य भुक्तानी दिनुपर्ने", type: "Liability", parentCode: "05", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-001", name: "General Reserve Fund", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-002", name: "Share Redemption Reserve", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-003", name: "Social Responsibility Fund", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-004", name: "Education Fund", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-005", name: "Loan Loss Reserve", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-006", name: "Staff Welfare Fund", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "01-20-007", name: "Special Reserves", nameNepali: null, type: "Liability", parentCode: "01-20", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "02-150-001", name: "Operational Expenses", nameNepali: null, type: "Expense", parentCode: "02", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "02-150-002", name: "Administrative Expenses", nameNepali: null, type: "Expense", parentCode: "02", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "03-160-01", name: "Direct Income", nameNepali: null, type: "Income", parentCode: "03", allowPosting: false, isControlAccount: true, normalBalance: "credit", balance: 0 },
  { code: "03-160-02", name: "Indirect Income", nameNepali: null, type: "Income", parentCode: "03", allowPosting: false, isControlAccount: true, normalBalance: "credit", balance: 0 },
  { code: "04-100-001", name: "Sahakari Bank Limited Account", nameNepali: null, type: "Asset", parentCode: "04-100", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "04-110-001", name: "Krishi Karja Account", nameNepali: null, type: "Asset", parentCode: "04-110", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "05-30-001", name: "Current Account", nameNepali: null, type: "Liability", parentCode: "05-30", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-30-002", name: "Saving Account", nameNepali: null, type: "Liability", parentCode: "05-30", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-30-003", name: "Fixed Diposit", nameNepali: null, type: "Liability", parentCode: "05-30", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-30-004", name: "Daily Saving Account", nameNepali: null, type: "Liability", parentCode: "05-30", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "05-40-001", name: "RMDC Account", nameNepali: null, type: "Liability", parentCode: "05-40", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "02-150-001-001", name: "Goods Purchases", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-002", name: "Carries & wages", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-003", name: "Interest Paid", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-004", name: "Fuel & Transport", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-005", name: "Maintenance", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-006", name: "Depreciation", nameNepali: null, type: "Expense", parentCode: "02-150-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-001", name: "Salaries & Allowance", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-003", name: "Interest Paid", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-004", name: "Electricity & Internet", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-005", name: "Stationary & Miscellaneous", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-006", name: "Insurance", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-007", name: "Dividends Paid", nameNepali: null, type: "Expense", parentCode: "02-150-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "03-160-01-001", name: "Goods Sales", nameNepali: null, type: "Income", parentCode: "03-160-01", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-01-002", name: "Interest From Loan", nameNepali: null, type: "Income", parentCode: "03-160-01", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-01-003", name: "Interest From Investment", nameNepali: null, type: "Income", parentCode: "03-160-01", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-01-004", name: "Administrative Grant", nameNepali: "अनुदान", type: "Income", parentCode: "03-160-01", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-001", name: "Membership Fee", nameNepali: null, type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-002", name: "Entry Fee", nameNepali: "प्रवेश शुल्क", type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-003", name: "Services Fee", nameNepali: "सेवा शुल्क", type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-004", name: "Late Fee Charge", nameNepali: "विलम्ब शुल्क", type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-005", name: "Commission Receiced", nameNepali: null, type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-006", name: "Rental Income", nameNepali: null, type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-007", name: "Discount Get", nameNepali: null, type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "03-160-02-008", name: "Miscellaneous Income", nameNepali: null, type: "Income", parentCode: "03-160-02", allowPosting: true, isControlAccount: false, normalBalance: "credit", balance: 0 },
  { code: "02-150-001-003-001", name: "Interest Paid - Deposit", nameNepali: null, type: "Expense", parentCode: "02-150-001-003", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-001-003-002", name: "Interest Paid - Loan", nameNepali: null, type: "Expense", parentCode: "02-150-001-003", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-001-001", name: "Staff Salaries", nameNepali: null, type: "Expense", parentCode: "02-150-002-001", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-001-002", name: "Allowance", nameNepali: null, type: "Expense", parentCode: "02-150-002-001", allowPosting: false, isControlAccount: true, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-001-002-001", name: "Allowance - Meeting", nameNepali: null, type: "Expense", parentCode: "02-150-002-001-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
  { code: "02-150-002-001-002-002", name: "Allowance - Staff", nameNepali: null, type: "Expense", parentCode: "02-150-002-001-002", allowPosting: true, isControlAccount: false, normalBalance: "debit", balance: 0 },
];