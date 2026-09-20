import type { ChequeDesignConfig, ChequeDraggableElement } from '../components/cheque/ChequeLeafCanvas';
import type { ChequeTagContext } from './chequeTagEngine';

/**
 * Blank-leaf transform for printing an unfilled cheque book handed to a member.
 *
 * A saved design's field templates carry {curly} tokens that `resolveChequeTags`
 * always resolves to *something* — an empty payee becomes "—", a zero amount
 * becomes "=0.00=" / "Rupees Zero Only", a missing date collapses to "". On a
 * blank leaf those fields must be genuinely empty so the member fills them in by
 * hand. This module rewrites a design so the "handwritten" tokens are removed
 * while everything pre-printed on real stationery (institution name, branch,
 * labels, the drawing account number, the "or Bearer" line, the empty amount
 * box, the signature block, the A/C-payee crossing and the MICR band) is kept.
 *
 * It is a pure function of the design — no DOM, no React — so it can be unit
 * tested in isolation against the real tag engine.
 */

/** Tokens a member writes on the leaf by hand — stripped for a blank print. */
export const HANDWRITTEN_TAGS: readonly string[] = [
  '{payee_name}',
  '{amount_words}',
  '{amount_words_np}',
  '{amount_figures}',
  '{date_bs}',
  '{date_ad}',
  '{date_boxes}',
];

/** Element kinds that are structural stationery and always survive as-is. */
const STRUCTURAL_TYPES = new Set(['logo', 'signature_block', 'crossing', 'line', 'rect']);

/** Remove every handwritten token from a template, then tidy dangling separators. */
function stripHandwrittenTags(template: string): string {
  let out = template;
  for (const tag of HANDWRITTEN_TAGS) {
    out = out.split(tag).join('');
  }
  // A template like "{payee_name}  —  {or_bearer}" leaves "  —  {or_bearer}";
  // drop leading/trailing whitespace and dash separators, collapse doubles.
  return out
    .replace(/^[\s—–-]+/, '')
    .replace(/[\s—–-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Rewrite a design so its leaves print blank (ready to hand to a member).
 * The original config is not mutated.
 */
export function toBlankLeafConfig(config: ChequeDesignConfig): ChequeDesignConfig {
  const elements: ChequeDraggableElement[] = [];

  for (const el of config.draggableElements) {
    // Logo / signature / crossing are pure stationery — keep untouched.
    if (STRUCTURAL_TYPES.has(el.type)) {
      elements.push(el);
      continue;
    }

    // The amount box keeps its outline but shows nothing. A single space keeps
    // `tagValue` truthy so the canvas renders the box (not its "Amount" label).
    if (el.type === 'amount_box') {
      elements.push({ ...el, tagValue: ' ' });
      continue;
    }

    // The date comb keeps its empty cells (the member hand-writes the date), so
    // the element survives with no value — the canvas then draws blank boxes.
    if (el.type === 'date_boxes') {
      elements.push({ ...el, tagValue: '' });
      continue;
    }

    // Text-bearing elements: strip the handwritten tokens. If nothing static is
    // left (e.g. a standalone {amount_words}), drop the element entirely.
    if (el.tagValue != null && el.tagValue !== '') {
      const stripped = stripHandwrittenTags(el.tagValue);
      if (stripped === '') continue;
      elements.push({ ...el, tagValue: stripped });
      continue;
    }

    // Field labels with no tagValue render their static label — keep them.
    elements.push(el);
  }

  return { ...config, draggableElements: elements };
}

export interface BlankLeafSource {
  chequeNumber: string;
  accountNo?: string;
  accountName?: string;
  branchName?: string;
  micrCode?: string;
}

/**
 * Build the render context for one blank leaf: the pre-printed identifiers
 * (cheque number, drawing account, branch, MICR) are populated; the
 * member-filled fields (payee, amount, date) are left empty.
 */
export function blankLeafContext(src: BlankLeafSource): Omit<ChequeTagContext, 'config'> {
  return {
    payeeName: '',
    amountFigures: 0,
    dateBs: '',
    dateAd: '',
    accountNo: src.accountNo || '',
    accountName: src.accountName || '',
    chequeNumber: src.chequeNumber || '',
    micrCode: src.micrCode,
    branchName: src.branchName,
  };
}
