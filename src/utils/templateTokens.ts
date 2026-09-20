/**
 * Document Template Studio — Token Registry & Resolution
 *
 * Defines all available data tokens per template category,
 * resolves tokens to formatted values (Nepali currency, BS dates, Devanagari numerals).
 */
import { DateConverter } from '../utils/nepaliCalendar';
import { numberToNepaliWords } from '../utils/numberToNepaliWords';

// ── Types ──────────────────────────────────────────────────────────────────

export type TokenCategory = 'receipt' | 'voucher' | 'report' | 'certificate' | 'shared';
export type TokenDataType = 'currency' | 'date_bs' | 'date_ad' | 'text' | 'number' | 'image' | 'boolean';

export interface TokenDefinition {
  token: string;
  category: TokenCategory;
  dataType: TokenDataType;
  label: string;
  defaultFormat?: string;
  description?: string;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;       // pt
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  devanagariDigits?: boolean;
}

export interface ElementBorder {
  width?: number;        // px
  color?: string;        // hex
  style?: 'solid' | 'dashed' | 'dotted' | 'none';
  radius?: number;       // px, border-radius
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'field' | 'image' | 'table' | 'line' | 'qrcode' | 'signatureLine' | 'pageBreak';
  x: number;              // mm from left
  y: number;              // mm from top
  width?: number;
  height?: number;
  rotation?: number;
  // type-specific
  content?: string;       // text: static content, may contain {{tokens}}
  token?: string;         // field: bound token path
  format?: string;        // field: format override
  source?: string;        // image: URL or token
  dataSource?: string;    // table: data source key
  columns?: TableColumn[];
  style?: TextStyle;
  // line
  x2?: number;
  y2?: number;
  strokeColor?: string;
  strokeWidth?: number;
  // qrcode
  dataToken?: string;
  // signature
  label?: string;
  // border styling
  border?: ElementBorder;
  // conditional visibility
  condition?: { token: string; operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains'; value: string };
}

export interface TableColumn {
  token: string;
  label: string;
  width?: number;         // percentage or mm
  format?: string;
  align?: 'left' | 'center' | 'right';
  style?: TextStyle;
}

export interface TemplateLayout {
  pageSize: { width: number; height: number };  // mm
  elements: TemplateElement[];
}

// ── Page Sizes (mm) ────────────────────────────────────────────────────────

export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4:     { width: 210, height: 297 },
  A5:     { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
  Legal:  { width: 216, height: 356 },
  Thermal80: { width: 80, height: 297 },  // 80mm thermal roll
  Thermal58: { width: 58, height: 297 },  // 58mm thermal roll
};

// ── Token Registry ─────────────────────────────────────────────────────────

export const TOKEN_REGISTRY: TokenDefinition[] = [
  // ── Shared org-level tokens ──────────────────────────────────────────────
  { token: 'org.name',            category: 'shared', dataType: 'text',     label: 'Cooperative Name' },
  { token: 'org.code',            category: 'shared', dataType: 'text',     label: 'Cooperative Code' },
  { token: 'org.address',         category: 'shared', dataType: 'text',     label: 'Address' },
  { token: 'org.registrationNo',  category: 'shared', dataType: 'text',     label: 'Registration No.' },
  { token: 'org.panNo',           category: 'shared', dataType: 'text',     label: 'PAN / VAT No.' },
  { token: 'org.phone',           category: 'shared', dataType: 'text',     label: 'Phone' },
  { token: 'org.email',           category: 'shared', dataType: 'text',     label: 'Email' },
  { token: 'org.website',         category: 'shared', dataType: 'text',     label: 'Website' },
  { token: 'org.logo',            category: 'shared', dataType: 'image',    label: 'Cooperative Logo' },
  { token: 'org.sealImage',       category: 'shared', dataType: 'image',    label: 'Official Seal' },
  { token: 'org.fiscalYear',      category: 'shared', dataType: 'text',     label: 'Fiscal Year' },

  // ── Receipt tokens ───────────────────────────────────────────────────────
  { token: 'receipt.number',       category: 'receipt', dataType: 'text',   label: 'Receipt Number' },
  { token: 'receipt.dateBs',       category: 'receipt', dataType: 'date_bs', label: 'Date (BS)' },
  { token: 'receipt.dateAd',       category: 'receipt', dataType: 'date_ad', label: 'Date (AD)' },
  { token: 'receipt.type',         category: 'receipt', dataType: 'text',   label: 'Receipt Type' },
  { token: 'receipt.description',  category: 'receipt', dataType: 'text',   label: 'Description' },
  { token: 'receipt.status',       category: 'receipt', dataType: 'text',   label: 'Status' },
  { token: 'member.name',          category: 'receipt', dataType: 'text',   label: 'Member Name' },
  { token: 'member.memberNo',      category: 'receipt', dataType: 'text',   label: 'Member Number' },
  { token: 'member.address',       category: 'receipt', dataType: 'text',   label: 'Member Address' },
  { token: 'member.phone',         category: 'receipt', dataType: 'text',   label: 'Member Phone' },
  { token: 'transaction.amount',    category: 'receipt', dataType: 'currency', label: 'Transaction Amount' },
  { token: 'transaction.amountInWords', category: 'receipt', dataType: 'text', label: 'Amount in Words' },
  { token: 'transaction.type',      category: 'receipt', dataType: 'text',  label: 'Transaction Type' },
  { token: 'transaction.reference', category: 'receipt', dataType: 'text',  label: 'Reference Number' },
  { token: 'transaction.method',    category: 'receipt', dataType: 'text',  label: 'Payment Method' },
  { token: 'transaction.balance',   category: 'receipt', dataType: 'currency', label: 'Account Balance' },
  { token: 'staff.name',           category: 'receipt', dataType: 'text',   label: 'Staff Name' },
  { token: 'staff.signature',      category: 'receipt', dataType: 'image',  label: 'Staff Signature' },

  // ── Voucher tokens ───────────────────────────────────────────────────────
  { token: 'voucher.number',       category: 'voucher', dataType: 'text',   label: 'Voucher Number' },
  { token: 'voucher.dateBs',       category: 'voucher', dataType: 'date_bs', label: 'Date (BS)' },
  { token: 'voucher.dateAd',       category: 'voucher', dataType: 'date_ad', label: 'Date (AD)' },
  { token: 'voucher.type',         category: 'voucher', dataType: 'text',   label: 'Voucher Type' },
  { token: 'voucher.debitAccount',  category: 'voucher', dataType: 'text',  label: 'Debit Account' },
  { token: 'voucher.creditAccount', category: 'voucher', dataType: 'text',  label: 'Credit Account' },
  { token: 'voucher.amount',        category: 'voucher', dataType: 'currency', label: 'Amount' },
  { token: 'voucher.amountInWords', category: 'voucher', dataType: 'text',  label: 'Amount in Words' },
  { token: 'voucher.remarks',       category: 'voucher', dataType: 'text',  label: 'Remarks' },
  { token: 'voucher.narration',     category: 'voucher', dataType: 'text',  label: 'Narration' },
  { token: 'voucher.entries',       category: 'voucher', dataType: 'text',  label: 'Voucher Entries (Table)' },
  { token: 'approvedBy.name',      category: 'voucher', dataType: 'text',   label: 'Approved By' },
  { token: 'approvedBy.signature',  category: 'voucher', dataType: 'image', label: 'Approved By Signature' },
  { token: 'preparedBy.name',      category: 'voucher', dataType: 'text',   label: 'Prepared By' },
  { token: 'preparedBy.signature',  category: 'voucher', dataType: 'image', label: 'Prepared By Signature' },

  // ── Certificate tokens ───────────────────────────────────────────────────
  { token: 'certificate.number',    category: 'certificate', dataType: 'text', label: 'Certificate Number' },
  { token: 'certificate.dateBs',    category: 'certificate', dataType: 'date_bs', label: 'Issue Date (BS)' },
  { token: 'certificate.dateAd',    category: 'certificate', dataType: 'date_ad', label: 'Issue Date (AD)' },
  { token: 'certificate.type',      category: 'certificate', dataType: 'text', label: 'Certificate Type' },
  { token: 'member.name',           category: 'certificate', dataType: 'text', label: 'Member Name' },
  { token: 'member.memberNo',       category: 'certificate', dataType: 'text', label: 'Member Number' },
  { token: 'member.fatherName',     category: 'certificate', dataType: 'text', label: "Father's Name" },
  { token: 'member.grandfatherName', category: 'certificate', dataType: 'text', label: "Grandfather's Name" },
  { token: 'member.address',        category: 'certificate', dataType: 'text', label: 'Member Address' },
  { token: 'share.count',           category: 'certificate', dataType: 'number', label: 'Share Count' },
  { token: 'share.value',           category: 'certificate', dataType: 'currency', label: 'Share Value' },
  { token: 'share.totalValue',      category: 'certificate', dataType: 'currency', label: 'Total Share Value' },
  { token: 'share.class',           category: 'certificate', dataType: 'text', label: 'Share Class' },
  { token: 'president.name',        category: 'certificate', dataType: 'text', label: 'President Name' },
  { token: 'president.signatureImage', category: 'certificate', dataType: 'image', label: 'President Signature' },
  { token: 'manager.name',          category: 'certificate', dataType: 'text', label: 'Manager Name' },
  { token: 'manager.signatureImage', category: 'certificate', dataType: 'image', label: 'Manager Signature' },

  // ── Report tokens ────────────────────────────────────────────────────────
  { token: 'report.title',          category: 'report', dataType: 'text',   label: 'Report Title' },
  { token: 'report.periodStart',    category: 'report', dataType: 'date_bs', label: 'Period Start (BS)' },
  { token: 'report.periodEnd',      category: 'report', dataType: 'date_bs', label: 'Period End (BS)' },
  { token: 'report.generatedDate',  category: 'report', dataType: 'date_bs', label: 'Generated Date (BS)' },
  { token: 'report.preparedBy',     category: 'report', dataType: 'text',   label: 'Prepared By' },
  { token: 'report.approvedBy',     category: 'report', dataType: 'text',   label: 'Approved By' },
  { token: 'report.dataset',        category: 'report', dataType: 'text',   label: 'Report Dataset (Table)' },
];

// ── Table Data Sources ─────────────────────────────────────────────────────

export interface TableDataSource {
  key: string;
  label: string;
  category: TokenCategory;
  columns: { token: string; label: string; dataType: TokenDataType }[];
}

export const TABLE_DATA_SOURCES: TableDataSource[] = [
  {
    key: 'voucher.entries',
    label: 'Voucher Entries',
    category: 'voucher',
    columns: [
      { token: 'accountCode', label: 'Account Code', dataType: 'text' },
      { token: 'accountName', label: 'Account Name', dataType: 'text' },
      { token: 'debit', label: 'Debit', dataType: 'currency' },
      { token: 'credit', label: 'Credit', dataType: 'currency' },
      { token: 'remarks', label: 'Remarks', dataType: 'text' },
    ],
  },
  {
    key: 'receipt.items',
    label: 'Receipt Line Items',
    category: 'receipt',
    columns: [
      { token: 'description', label: 'Description', dataType: 'text' },
      { token: 'amount', label: 'Amount', dataType: 'currency' },
    ],
  },
  {
    key: 'member.shares',
    label: 'Share Holdings',
    category: 'certificate',
    columns: [
      { token: 'shareClass', label: 'Share Class', dataType: 'text' },
      { token: 'count', label: 'Count', dataType: 'number' },
      { token: 'value', label: 'Value', dataType: 'currency' },
    ],
  },
  {
    key: 'report.dataRows',
    label: 'Report Data Rows',
    category: 'report',
    columns: [
      { token: 'label', label: 'Label', dataType: 'text' },
      { token: 'value', label: 'Value', dataType: 'text' },
    ],
  },
];

// ── Resolution Helpers ─────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function toDevanagariDigits(text: string): string {
  const devanagariDigits = ['०','१','२','३','४','५','६','७','८','९'];
  return text.replace(/[0-9]/g, d => devanagariDigits[parseInt(d)]);
}

function formatIndianNumberSystem(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const lastThree = intPart.slice(-3);
  const otherNumbers = intPart.slice(0, -3);
  const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const result = otherNumbers ? `${formattedOther},${lastThree}` : lastThree;
  return `${sign}${result}.${decPart}`;
}

function formatNepaliCurrency(amount: number, format?: string): string {
  if (format === 'words') {
    return numberToNepaliWords(amount);
  }
  const formatted = formatIndianNumberSystem(amount);
  if (format === 'both') {
    return `रू. ${formatted}।- (${numberToNepaliWords(amount)})`;
  }
  return `रू. ${formatted}।-`;
}

function formatNepaliNumber(value: number): string {
  return formatIndianNumberSystem(value).replace(/\.\d+$/, ''); // no decimals
}

// ── Main Resolution Function ───────────────────────────────────────────────

export function resolveToken(
  token: string,
  context: Record<string, any>,
  format?: string,
  devanagariDigits?: boolean,
): string {
  const value = getNestedValue(context, token);
  if (value == null || value === '') return '';

  const definition = TOKEN_REGISTRY.find(t => t.token === token);
  let result: string;

  switch (definition?.dataType) {
    case 'currency':
      result = formatNepaliCurrency(Number(value), format);
      break;
    case 'date_bs':
      try {
        result = DateConverter.formatBs(String(value));
      } catch {
        result = String(value);
      }
      break;
    case 'date_ad':
      try {
        const ad = DateConverter.bsToAd(String(value));
        result = ad ? new Date(ad).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : String(value);
      } catch {
        result = String(value);
      }
      break;
    case 'number':
      result = formatNepaliNumber(Number(value));
      break;
    case 'image':
      result = String(value); // URL
      break;
    case 'boolean':
      result = value ? 'Yes' : 'No';
      break;
    default:
      result = String(value);
  }

  if (devanagariDigits && definition?.dataType !== 'image') {
    result = toDevanagariDigits(result);
  }

  return result;
}

// Resolve text content that may contain {{token}} placeholders
export function resolveTextContent(
  content: string,
  context: Record<string, any>,
  devanagariDigits?: boolean,
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (_, token) => {
    return resolveToken(token.trim(), context, undefined, devanagariDigits);
  });
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTemplate(
  layout: TemplateLayout,
  category: TokenCategory,
): ValidationResult {
  const errors: string[] = [];
  const availableTokens = TOKEN_REGISTRY
    .filter(t => t.category === category || t.category === 'shared')
    .map(t => t.token);

  layout.elements.forEach((el, idx) => {
    if (el.type === 'field' && el.token && !availableTokens.includes(el.token)) {
      errors.push(`Element ${idx + 1}: Unknown token "${el.token}" — not available for ${category} templates`);
    }
    if (el.type === 'table' && el.columns) {
      el.columns.forEach(col => {
        if (col.token && !availableTokens.includes(col.token)) {
          errors.push(`Table column "${col.token}" is not a valid token for ${category} templates`);
        }
      });
    }
    // Check page bounds
    if (el.x !== undefined && el.x < 0) errors.push(`Element ${idx + 1}: x position cannot be negative`);
    if (el.y !== undefined && el.y < 0) errors.push(`Element ${idx + 1}: y position cannot be negative`);
  });

  return { valid: errors.length === 0, errors };
}

// ── Token Picker Helpers ───────────────────────────────────────────────────

export function getTokensForCategory(category: TokenCategory): TokenDefinition[] {
  return TOKEN_REGISTRY.filter(t => t.category === category || t.category === 'shared');
}

export function getTableDataSourcesForCategory(category: TokenCategory): TableDataSource[] {
  return TABLE_DATA_SOURCES.filter(t => t.category === category);
}

// ── Sample Data for Preview ────────────────────────────────────────────────

export function getSampleData(category: TokenCategory): Record<string, any> {
  const shared = {
    'org.name': 'Shree Dipshikha Krisi Sahakari Santha Ltd.',
    'org.code': 'DPSCO',
    'org.address': 'Gauriganga-1, Chaumala, Kailali',
    'org.registrationNo': 'COP-2083-0001',
    'org.panNo': '613124397',
    'org.phone': '+977-9825695432',
    'org.email': 'info@dpccoop.com.np',
    'org.website': 'www.dpscoop.com.np',
    'org.fiscalYear': '2082/83',
  };

  const categoryData: Record<string, Record<string, any>> = {
    receipt: {
      'receipt.number': 'RCP-2082-001234',
      'receipt.dateBs': '2082-05-15',
      'receipt.type': 'Deposit Receipt',
      'receipt.description': 'Savings deposit',
      'receipt.status': 'Completed',
      'member.name': 'राजेश कुमार शर्मा',
      'member.memberNo': 'M-00123',
      'member.address': 'Gauriganga-5, Kailali',
      'member.phone': '+977-9841234567',
      'transaction.amount': 50000,
      'transaction.amountInWords': 'नं. ५०,०००।- (पचास हजार रुपैयाँ मात्र)',
      'transaction.type': 'Deposit',
      'transaction.reference': 'REF-2082-0567',
      'transaction.method': 'Cash',
      'transaction.balance': 125000,
      'staff.name': 'सीता देवी',
    },
    voucher: {
      'voucher.number': 'VP-2082-00456',
      'voucher.dateBs': '2082-05-15',
      'voucher.type': 'Payment Voucher',
      'voucher.debitAccount': 'Loan Disbursement',
      'voucher.creditAccount': 'Cash at Bank',
      'voucher.amount': 150000,
      'voucher.amountInWords': 'एक लाख पचास हजार रुपैयाँ मात्र',
      'voucher.remarks': 'Loan disbursement to member M-00123',
      'voucher.narration': 'Loan amount transferred to member savings account',
      'approvedBy.name': 'बिमल प्रसाद चौधरी',
      'preparedBy.name': 'सीता देवी',
    },
    certificate: {
      'certificate.number': 'SHC-2082-000789',
      'certificate.dateBs': '2082-05-15',
      'certificate.type': 'Share Certificate',
      'member.name': 'राजेश कुमार शर्मा',
      'member.memberNo': 'M-00123',
      'member.fatherName': 'श्याम प्रसाद शर्मा',
      'member.grandfatherName': 'राम लखन शर्मा',
      'member.address': 'Gauriganga-5, Kailali',
      'share.count': 50,
      'share.value': 1000,
      'share.totalValue': 50000,
      'share.class': 'Ordinary',
      'president.name': 'बिमल प्रसाद चौधरी',
      'manager.name': 'रमेश कुमार गुप्ता',
    },
    report: {
      'report.title': 'Annual Balance Sheet',
      'report.periodStart': '2082-01-01',
      'report.periodEnd': '2082-12-30',
      'report.generatedDate': '2082-12-30',
      'report.preparedBy': 'सीता देवी',
      'report.approvedBy': 'बिमल प्रसाद चौधरी',
    },
  };

  return { ...shared, ...categoryData[category] };
}
