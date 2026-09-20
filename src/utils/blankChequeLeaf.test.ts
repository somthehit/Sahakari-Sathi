/**
 * Blank-leaf transform tests.
 *
 * `toBlankLeafConfig` rewrites a saved cheque design so its leaves print blank
 * for handing to a member: the member-filled tokens (payee, amount, date) are
 * removed while all pre-printed stationery survives. These tests run the REAL
 * transform and feed its output through the REAL `resolveChequeTags` engine to
 * prove the rendered leaf carries no zero-amount / dash placeholder artifacts.
 *
 * Pure (no DOM / React): a representative config is built inline rather than
 * importing the runtime DEFAULT_CHEQUE_CONFIG, so the file transpiles cleanly.
 */
import { describe, it, expect } from 'vitest';
import { toBlankLeafConfig, blankLeafContext, HANDWRITTEN_TAGS } from './blankChequeLeaf';
import { resolveChequeTags } from './chequeTagEngine';
import type { ChequeDesignConfig, ChequeDraggableElement } from '../components/cheque/ChequeLeafCanvas';
import type { ChequeTagContext } from './chequeTagEngine';

/** A representative design mirroring the shipped default's element shapes. */
function sampleConfig(): ChequeDesignConfig {
  return {
    widthMm: 200,
    heightMm: 92,
    bankNameNp: 'साझा सहकारी संस्था लि.',
    bankNameEn: 'Sajha Co-operative Ltd.',
    branchName: 'Koteshwor',
    accentColor: '#047857',
    bgColor: '#f8fdfb',
    showLogo: true,
    showAccountPayeeCrossing: true,
    showMicrBand: true,
    micrCode: '977001234',
    micrTemplate: '⑈ {cheque_number} ⑈   {micr_code}   ⑆ {account_no} ⑆',
    micrFontSizePt: 11,
    enableSnapToGrid: true,
    gridSizeMm: 2.5,
    showGridLines: false,
    draggableElements: [
      { id: 'logo', type: 'logo', label: 'Logo', x: 6, y: 5, widthMm: 16, heightMm: 16 },
      { id: 'bank-np', type: 'tag_text', label: 'Institution (NP)', tagValue: '{bank_name_np}', x: 24, y: 5 },
      { id: 'branch', type: 'tag_text', label: 'Branch', tagValue: '{branch_name}', x: 24, y: 15 },
      { id: 'date-label', type: 'field_label', label: 'मिति / Date', x: 150, y: 6 },
      { id: 'date-boxes', type: 'tag_text', label: 'Date boxes', tagValue: '{date_boxes}', x: 150, y: 10 },
      { id: 'pay-label', type: 'field_label', label: 'भुक्तानी पाउने / Pay', x: 6, y: 30 },
      { id: 'payee', type: 'tag_text', label: 'Payee', tagValue: '{payee_name}  —  {or_bearer}', x: 34, y: 30 },
      { id: 'amount-words', type: 'tag_text', label: 'Amount in words', tagValue: '{amount_words}', x: 34, y: 42 },
      { id: 'amount-box', type: 'amount_box', label: 'Amount', tagValue: '{amount_figures}', x: 150, y: 40, widthMm: 44, heightMm: 11 },
      { id: 'acct-no', type: 'tag_text', label: 'Account No.', tagValue: '{account_no}', x: 34, y: 65 },
      { id: 'signature', type: 'signature_block', label: 'Signature', x: 138, y: 62 },
      { id: 'crossing', type: 'crossing', label: 'A/C Payee', x: 8, y: 3 },
    ] as ChequeDraggableElement[],
  } as ChequeDesignConfig;
}

const byId = (cfg: ChequeDesignConfig, id: string): ChequeDraggableElement | undefined =>
  cfg.draggableElements.find((e) => e.id === id);

describe('HANDWRITTEN_TAGS', () => {
  it('lists exactly the member-filled tokens', () => {
    expect(HANDWRITTEN_TAGS).toHaveLength(7);
    expect(HANDWRITTEN_TAGS).toContain('{payee_name}');
    expect(HANDWRITTEN_TAGS).toContain('{amount_figures}');
    expect(HANDWRITTEN_TAGS).toContain('{amount_words}');
    expect(HANDWRITTEN_TAGS).toContain('{amount_words_np}');
    expect(HANDWRITTEN_TAGS).toContain('{date_boxes}');
  });
});

describe('toBlankLeafConfig — element handling', () => {
  it('drops a standalone date-boxes element', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'date-boxes') === undefined).toBe(true);
  });

  it('drops a standalone amount-in-words element', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'amount-words') === undefined).toBe(true);
  });

  it('reduces the payee element to only its static "or Bearer" remainder', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'payee')?.tagValue).toBe('{or_bearer}');
  });

  it('keeps the amount box outline but blanks its content', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    const box = byId(blank, 'amount-box');
    expect(box === undefined).toBe(false);
    expect(box?.tagValue).toBe(' ');
  });

  it('preserves the pre-printed account number', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'acct-no')?.tagValue).toBe('{account_no}');
  });

  it('keeps structural stationery (logo, signature, crossing)', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'logo') === undefined).toBe(false);
    expect(byId(blank, 'signature') === undefined).toBe(false);
    expect(byId(blank, 'crossing') === undefined).toBe(false);
  });

  it('keeps field labels that have no tag', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(byId(blank, 'date-label') === undefined).toBe(false);
    expect(byId(blank, 'pay-label') === undefined).toBe(false);
  });

  it('does not mutate the original config', () => {
    const original = sampleConfig();
    toBlankLeafConfig(original);
    expect(byId(original, 'date-boxes') === undefined).toBe(false);
    expect(byId(original, 'payee')?.tagValue).toBe('{payee_name}  —  {or_bearer}');
    expect(byId(original, 'amount-box')?.tagValue).toBe('{amount_figures}');
  });

  it('leaves the MICR template untouched', () => {
    const blank = toBlankLeafConfig(sampleConfig());
    expect(blank.micrTemplate).toBe('⑈ {cheque_number} ⑈   {micr_code}   ⑆ {account_no} ⑆');
  });
});

describe('toBlankLeafConfig — rendered output through the real tag engine', () => {
  const blank = toBlankLeafConfig(sampleConfig());
  const ctx: ChequeTagContext = {
    config: blank,
    ...blankLeafContext({
      chequeNumber: 'CHQ-000101',
      accountNo: '001-0100-0000123',
      accountName: 'Sita Devi',
    }),
  };

  it('renders the pay line as the static bearer text, not an em dash', () => {
    const out = resolveChequeTags(byId(blank, 'payee')!.tagValue!, ctx);
    expect(out).toContain('Bearer');
    expect(out).not.toContain('—');
  });

  it('renders the amount box empty (no zero figure)', () => {
    const out = resolveChequeTags(byId(blank, 'amount-box')!.tagValue!, ctx);
    expect(out.trim()).toBe('');
    expect(out).not.toContain('0.00');
  });

  it('still prints the drawing account number', () => {
    expect(resolveChequeTags(byId(blank, 'acct-no')!.tagValue!, ctx)).toBe('001-0100-0000123');
  });

  it('MICR band still carries the cheque number and account number', () => {
    const micr = resolveChequeTags(blank.micrTemplate, ctx);
    expect(micr).toContain('CHQ-000101');
    expect(micr).toContain('001-0100-0000123');
  });

  it('no surviving element renders a zero-amount or empty-words artifact', () => {
    for (const el of blank.draggableElements) {
      if (!el.tagValue) continue;
      const out = resolveChequeTags(el.tagValue, ctx);
      expect(out).not.toContain('=0.00=');
      expect(out).not.toContain('Rupees Zero Only');
    }
  });
});

describe('blankLeafContext', () => {
  it('leaves member-filled fields empty and populates pre-printed identifiers', () => {
    const c = blankLeafContext({
      chequeNumber: 'CHQ-000101',
      accountNo: '001-0100-0000123',
      accountName: 'Sita Devi',
    });
    expect(c.payeeName).toBe('');
    expect(c.dateBs).toBe('');
    expect(c.dateAd).toBe('');
    expect(c.amountFigures).toBe(0);
    expect(c.chequeNumber).toBe('CHQ-000101');
    expect(c.accountNo).toBe('001-0100-0000123');
    expect(c.accountName).toBe('Sita Devi');
  });

  it('defaults missing identifiers to empty strings', () => {
    const c = blankLeafContext({ chequeNumber: 'CHQ-1' });
    expect(c.accountNo).toBe('');
    expect(c.accountName).toBe('');
  });
});
