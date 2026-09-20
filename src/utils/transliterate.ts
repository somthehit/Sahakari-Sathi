/**
 * Rule-based Roman → Devanagari (Nepali) transliteration engine.
 *
 * Converts English-romanized names like "Ram Prasad Sharma" into
 * "राम प्रसाद शर्मा". Built entirely client-side (no external API).
 *
 * Strategy:
 *  1. Tokenize input into words, keeping punctuation.
 *  2. For each word, apply a cascade:
 *     a. Exact dictionary override for common Nepali given/family names.
 *     b. Rule-based phonetic engine (consonant/vowel tables + conjuncts).
 *     c. Fallback: keep word as-is when nothing matched.
 */

// ---------------------------------------------------------------------------
// Dictionary of common Nepali given/family names & honorifics (exact word → dev)
// ---------------------------------------------------------------------------
const NAME_OVERRIDES: Record<string, string> = {
  // Honorifics
  ram: 'राम',
  sita: 'सीता',
  gita: 'गीता',
  hari: 'हरि',
  krishna: 'कृष्ण',
  bishnu: 'विष्णु',
  shiva: 'शिव',
  ganesh: 'गणेश',
  laxmi: 'लक्ष्मी',
  saraswati: 'सरस्वती',
  durga: 'दुर्गा',
  devi: 'देवी',
  maya: 'माया',
  uma: 'उमा',
  puja: 'पूजा',
  renu: 'रेणु',
  sandhya: 'सन्ध्या',
  chandra: 'चन्द्र',
  // Given names (common)
  rajesh: 'राजेश',
  suresh: 'सुरेश',
  mahesh: 'महेश',
  dipesh: 'दीपेश',
  deepesh: 'दीपेश',
  ramesh: 'रमेश',
  bikash: 'विकास',
  bibek: 'विवेक',
  binod: 'विनोद',
  rajan: 'राजन',
  anita: 'अनिता',
  sunita: 'सुनिता',
  binita: 'बिनिता',
  kamala: 'कमला',
  sunil: 'सुनील',
  nisha: 'निशा',
  anjali: 'अन्जली',
  sushila: 'सुशीला',
  radha: 'राधा',
  // Family names
  kumar: 'कुमार',
  prasad: 'प्रसाद',
  bahadur: 'बहादुर',
  singh: 'सिंह',
  thapa: 'थापा',
  magar: 'मगर',
  gurung: 'गुरुङ',
  tamang: 'तामाङ',
  rai: 'राई',
  limbu: 'लिम्बु',
  sherpa: 'शेर्पा',
  karki: 'कार्की',
  adhikari: 'अधिकारी',
  shrestha: 'श्रेष्ठ',
  pokharel: 'पोखरेल',
  bhattarai: 'भट्टराई',
  koirala: 'कोइराला',
  regmi: 'रेग्मी',
  subedi: 'सुवेदी',
  gautam: 'गौतम',
  poudel: 'पौडेल',
  neupane: 'न्यौपाने',
  bastola: 'बास्तोला',
  dhungel: 'धुंगेल',
  joshi: 'जोशी',
  pandey: 'पाण्डे',
  sharma: 'शर्मा',
  acharya: 'आचार्य',
  giri: 'गिरी',
  dhakal: 'ढकाल',
  rana: 'राणा',
  malla: 'मल्ल',
  shah: 'शाह',
  mahat: 'महत',
  budha: 'बुढा',
  chaudhary: 'चौधरी',
  sarki: 'सार्की',
  damai: 'दमाई',
  khadka: 'खड्का',
  basnet: 'बस्नेत',
  kc: 'केसी',
  bhandari: 'भण्डारी',
  manandhar: 'मानन्धर',
  tuladhar: 'तुलाधर',
  srestha: 'श्रेष्ठ',
};

// ---------------------------------------------------------------------------
// Rule-based tables
// ---------------------------------------------------------------------------

// Independent vowel forms (word-initial or after another vowel)
const INDEPENDENT_VOWELS: Record<string, string> = {
  aa: 'आ',
  a: 'अ',
  ee: 'ई',
  ii: 'ई',
  i: 'इ',
  oo: 'ऊ',
  uu: 'ऊ',
  u: 'उ',
  ai: 'ऐ',
  au: 'औ',
  e: 'ए',
  o: 'ओ',
};

// Dependent vowel signs (matras) appended to a consonant
const DEPENDENT_VOWELS: Record<string, string> = {
  aa: 'ा',
  a: '', // inherent schwa → no sign
  ee: 'ी',
  ii: 'ी',
  i: 'ि',
  oo: 'ू',
  uu: 'ू',
  u: 'ु',
  ai: 'ै',
  au: 'ौ',
  e: 'े',
  o: 'ो',
};

// Consonant table, longest-first so the scanner matches greedily.
const CONSONANTS: Array<[string, string]> = [
  ['ksh', 'क्ष'],
  ['ks', 'क्ष'],
  ['dny', 'ज्ञ'],
  ['jny', 'ज्ञ'],
  ['gy', 'ज्ञ'],
  ['shri', 'श्री'],
  ['shree', 'श्री'],
  ['shr', 'श्र'],
  ['chh', 'छ'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['ch', 'च'],
  ['jh', 'झ'],
  ['th', 'थ'],
  ['dh', 'ध'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['sh', 'श'],
  ['ng', 'ङ'],
  ['thh', 'ठ'],
  ['dhh', 'ढ'],
  ['nn', 'ण'],
  ['k', 'क'],
  ['g', 'ग'],
  ['j', 'ज'],
  ['t', 'त'],
  ['d', 'द'],
  ['n', 'न'],
  ['p', 'प'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['v', 'व'],
  ['w', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
  ['z', 'ज'],
  ['f', 'फ'],
  ['q', 'क'],
  ['x', 'क्स'],
];

// Final 'a' after these consonants is typically retained (open final syllable).
const KEEP_FINAL_A: Record<string, boolean> = {
  t: true, d: true, k: true, g: true, p: true, b: true, ch: true, c: true,
  j: true, s: true, sh: true, h: true, v: true, w: true, y: true, z: true,
  f: true, q: true, th: true, dh: true, kh: true, gh: true, ph: true, bh: true, jh: true,
  chh: true, nn: true, ksh: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isLatinLetter = (c: string): boolean => /[a-zA-Z]/.test(c);

const isDevanagari = (w: string): boolean => /[\u0900-\u097F]/.test(w);

const lower = (w: string): string => w.toLowerCase();

/** Strips surrounding whitespace/punctuation for matching, returns [core, suffix]. */
function splitPunct(token: string): { core: string; suffix: string } {
  const m = token.match(/^(.*?)([.,!?;:'"()\-]*)$/);
  return m ? { core: m[1], suffix: m[2] } : { core: token, suffix: '' };
}

// ---------------------------------------------------------------------------
// Phonetic engine
// ---------------------------------------------------------------------------

interface Phoneme {
  type: 'C' | 'V' | 'X';
  text: string;
}

/** Scans a lowercase romanized word into consonant/vowel phonemes. */
function scanPhonemes(word: string): Phoneme[] {
  const out: Phoneme[] = [];
  let i = 0;
  const n = word.length;

  while (i < n) {
    const ch = word[i];

    if (!isLatinLetter(ch)) {
      out.push({ type: 'X', text: ch });
      i += 1;
      continue;
    }

    // Try longest consonant first.
    let matchedConsonant = false;
    for (const [key] of CONSONANTS) {
      if (word.slice(i, i + key.length) === key) {
        out.push({ type: 'C', text: key });
        i += key.length;
        matchedConsonant = true;
        break;
      }
    }
    if (matchedConsonant) continue;

    // Try vowels.
    let matchedVowel = false;
    const vKeys = Object.keys(INDEPENDENT_VOWELS).sort((a, b) => b.length - a.length);
    for (const vKey of vKeys) {
      if (word.slice(i, i + vKey.length) === vKey) {
        out.push({ type: 'V', text: vKey });
        i += vKey.length;
        matchedVowel = true;
        break;
      }
    }
    if (matchedVowel) continue;

    // Unknown letter.
    out.push({ type: 'X', text: ch });
    i += 1;
  }

  return out;
}

const consonantDev = (key: string): string => {
  for (const [k, v] of CONSONANTS) {
    if (k === key) return v;
  }
  return key;
};

/** Transliterate a single lowercase word with the phonetic engine. */
function transliteratePhonetic(word: string): string {
  const ph = scanPhonemes(word);
  if (ph.length === 0) return word;

  const out: string[] = [];
  const n = ph.length;

  for (let i = 0; i < n; i++) {
    const cur = ph[i];

    if (cur.type === 'X') {
      out.push(cur.text);
      continue;
    }

    if (cur.type === 'V') {
      // Vowel after a consonant → dependent matra on the previous consonant.
      if (i > 0 && ph[i - 1].type === 'C') {
        // Consonant is rendered as base + matra. Since the consonant was already
        // emitted in the previous iteration, we need to pull it back.
        continue;
      }
      // Word-initial or after another vowel → independent form.
      out.push(INDEPENDENT_VOWELS[cur.text] || cur.text);
      continue;
    }

    // Consonant: find the vowel that immediately follows (if any).
    const next = i + 1 < n ? ph[i + 1] : null;
    const hasMatra = next && next.type === 'V';

    if (hasMatra) {
      // Two-pass approach: since we emit base+matra together, we must handle the
      // "vowel was already skipped" case. Instead, look ahead: the consonant is
      // emitted here together with its matra, and we skip the vowel in the loop.
      const vKey = next!.text;
      const matra = DEPENDENT_VOWELS[vKey];

      // Schwa heuristic for the explicit 'a':
      //  - If the word ends here (consonant + 'a' final), retain 'a' when the
      //    final consonant is an open-ending stop, otherwise drop it.
      //  - If 'a' is medial, keep it (inherent) — it produces the standard
      //    open syllable like "ra" in Rajan.
      if (vKey === 'a') {
        const isFinal = i + 2 >= n;
        const prevC = i > 0 ? ph[i - 1] : null;
        const followingIsC = i + 2 < n && ph[i + 2].type === 'C';

        if (isFinal && !KEEP_FINAL_A[cur.text]) {
          // Drop the final schwa → bare consonant (राजन → न)
          out.push(consonantDev(cur.text));
          i += 1; // consume the vowel
          continue;
        }

        if (!isFinal && followingIsC && prevC && prevC.type === 'C') {
          // Medial schwa between two consonants (e.g. "chandra" = ch a n d r a):
          // the 'a' after 'ch' opens the syllable → keep, no matra.
          out.push(consonantDev(cur.text));
          i += 1;
          continue;
        }
      }

      out.push(consonantDev(cur.text) + matra);
      i += 1; // consume the vowel
      continue;
    }

    // No vowel follows → consonant is followed by another consonant or ends word.
    const nextIsConsonant = next && next.type === 'C';
    if (nextIsConsonant) {
      // Conjunct: virama (halant) joins the two consonants.
      out.push(consonantDev(cur.text) + '्');
    } else {
      // Word-final consonant (no trailing vowel): drop inherent schwa.
      out.push(consonantDev(cur.text));
    }
  }

  return out.join('');
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function transliterateToNepali(input: string): string {
  if (!input || typeof input !== 'string') return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  // Already Devanagari — return as-is.
  if (isDevanagari(trimmed)) return trimmed;

  const tokens = trimmed.split(/(\s+)/);
  const result = tokens.map((token) => {
    if (/^\s+$/.test(token) || token === '') return token;

    const { core, suffix } = splitPunct(token);

    // 1. Dictionary override (exact, case-insensitive)
    const dict = NAME_OVERRIDES[lower(core)];
    if (dict) return dict + suffix;

    // 2. Phonetic engine
    const phon = transliteratePhonetic(lower(core));
    if (phon && phon !== lower(core)) {
      return phon + suffix;
    }

    // 3. Fallback
    return token;
  });

  return result.join('');
}
