/**
 * Signature Match Service (pluggable)
 *
 * Deterministic matching pipeline for the withdrawal instrument's presented
 * signature vs the specimen on file. Providers implement a single interface and
 * can be weighted/added without touching the UI or the controller.
 *
 *   BaselineSignatureMatcher (default, dependency-free)
 *     - decodes PNG data-URLs that are produced by our own signature pads
 *     - flattens both images onto the same ink-coverage grid and compares
 *       per-cell agreement, global ink ratio, and a ±1 cell geometric shift
 *       (tolerates small offsets), returning a 0–100 score
 *     - non-PNG inputs fall back to a length/entropy heuristic flagged as
 *       low-confidence (a real CV provider can drop in and replace this)
 *
 * Every comparison is persisted to signature_verification_logs by the caller.
 */
import { inflateSync, type ZlibOptions } from 'zlib';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export type MatchVerdict = 'auto_approved' | 'teller_review' | 'blocked';

export interface SignatureMatchResult {
  score: number;
  verdict: MatchVerdict;
  provider: string;
  /** Human note for the log / display. */
  notes?: string;
  /** True when the baseline fell back to a low-confidence heuristic. */
  lowConfidence?: boolean;
}

export interface SignatureMatchContext {
  organizationId: string;
}

export interface SignatureMatchProvider {
  readonly id: string;
  readonly displayName: string;
  match(presented: string, specimen: string, ctx: SignatureMatchContext): Promise<SignatureMatchResult>;
}

// ─────────────────────────────────────────────────────────────
// Image bytes resolution (data URL · storage path · http(s))
// ─────────────────────────────────────────────────────────────

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[3];
  if (base64.length % 4 !== 0) return null;
  return { mime, buffer: Buffer.from(base64, 'base64') };
}

async function resolveImageBytes(value: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (value.startsWith('data:')) {
    const parsed = parseDataUrl(value);
    if (!parsed) return null;
    return { bytes: parsed.buffer, mime: parsed.mime };
  }

  // Storage path — `bucket/path/to/object`.
  if (value.includes('/') && !/^(https?:)?\/\//i.test(value)) {
    const [bucket, ...pathParts] = value.split('/');
    if (!bucket || pathParts.length === 0) return null;
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(pathParts.join('/'));
    if (error || !data) return null;
    const bytes = Buffer.from(await data.arrayBuffer());
    return { bytes, mime: 'image/png' };
  }

  // Absolute URL.
  if (/^https?:\/\//i.test(value)) {
    try {
      const res = await fetch(value);
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') || 'image/png';
      return { bytes, mime };
    } catch {
      return null;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Minimal PNG decoder (8-bit, non-interlaced, color types 0/2/3/4/6)
// ─────────────────────────────────────────────────────────────

interface PngImage {
  width: number;
  height: number;
  rgba: Buffer; // width*height*4
}

const CRC_TABLE = (() => {
  const table = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrcCheck(buf: Buffer, offset: number, length: number, expected: number): boolean {
  let crc = 0xffffffff;
  for (let i = 0; i < length; i++) crc = CRC_TABLE[(crc ^ buf[offset + i]) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  return crc === expected >>> 0;
}

function decodePng(buffer: Buffer): PngImage | null {
  if (buffer.length < 8 || !(buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)) {
    return null; // not a PNG
  }

  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 0;
  let interlaced = false;
  const idat: Buffer[] = [];
  let offset = 8;

  const readChunks = () => {
    while (offset + 8 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > buffer.length) return;
      if (!pngCrcCheck(buffer, dataStart, length, buffer.readUInt32BE(dataEnd))) return;
      if (chunkType === 'IHDR') {
        width = buffer.readUInt32BE(dataStart);
        height = buffer.readUInt32BE(dataStart + 4);
        bitDepth = buffer[dataStart + 8];
        colorType = buffer[dataStart + 9];
        interlaced = buffer[dataStart + 12] === 1;
      } else if (chunkType === 'IDAT') {
        idat.push(buffer.subarray(dataStart, dataEnd));
      } else if (chunkType === 'IEND') {
        return;
      }
      offset = dataEnd + 4;
    }
  };
  readChunks();

  if (!width || !height || idat.length === 0) return null;
  if (interlaced || bitDepth !== 8) return null;

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 3 ? 1 : 1;
  const bytesPerPixel = channels;

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat), { finishFlush: 0 } as ZlibOptions);
  } catch {
    return null;
  }

  const stride = width * bytesPerPixel;
  const expected = (stride + 1) * height;
  if (raw.length < expected) return null;

  const rgba = Buffer.alloc(width * height * 4);
  const palette = new Map<number, [number, number, number, number]>();

  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const recon = Buffer.alloc(stride);
    const paeth = (a: number, b: number, c: number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      if (pa <= pb && pa <= pc) return a;
      if (pb <= pc) return b;
      return c;
    };
    for (let x = 0; x < stride; x++) {
      const rawByte = line[x];
      const left = x >= bytesPerPixel ? recon[x - bytesPerPixel] : 0;
      const up = prev[x];
      const upLeft = x >= bytesPerPixel ? prev[x - bytesPerPixel] : 0;
      let val = rawByte;
      switch (filter) {
        case 0: break;
        case 1: val = (rawByte + left) & 0xff; break;
        case 2: val = (rawByte + up) & 0xff; break;
        case 3: val = (rawByte + ((left + up) >> 1)) & 0xff; break;
        case 4: val = (rawByte + paeth(left, up, upLeft)) & 0xff; break;
        default: return null;
      }
      recon[x] = val;
    }

    const write = (x: number, r: number, g: number, b: number, a: number) => {
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    };

    for (let x = 0; x < width; x++) {
      const s = x * bytesPerPixel;
      if (colorType === 6) {
        write(x, recon[s], recon[s + 1], recon[s + 2], recon[s + 3]);
      } else if (colorType === 2) {
        write(x, recon[s], recon[s + 1], recon[s + 2], 255);
      } else if (colorType === 4) {
        write(x, recon[s], recon[s], recon[s], recon[s + 1]);
      } else if (colorType === 0) {
        write(x, recon[s], recon[s], recon[s], 255);
      } else if (colorType === 3) {
        const idx = recon[s];
        palette.set(idx, palette.get(idx) ?? [idx, idx, idx, 255]);
        write(x, palette.get(idx)![0], palette.get(idx)![1], palette.get(idx)![2], palette.get(idx)![3]);
      }
    }
    prev = recon;
  }

  return { width, height, rgba };
}

// ─────────────────────────────────────────────────────────────
// Baseline provider
// ─────────────────────────────────────────────────────────────

const GRID = 24;

interface InkGrid {
  grid: number[][];
  inkRatio: number;
}

/** Flatten an image into a GRID×GRID ink-coverage matrix. */
function toInkGrid(img: PngImage): InkGrid {
  const grid = Array.from({ length: GRID }, () => new Array<number>(GRID).fill(0));
  const cellW = Math.max(1, Math.ceil(img.width / GRID));
  const cellH = Math.max(1, Math.ceil(img.height / GRID));
  let total = 0;
  let cells = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let ink = 0;
      let n = 0;
      for (let y = gy * cellH; y < Math.min((gy + 1) * cellH, img.height); y++) {
        for (let x = gx * cellW; x < Math.min((gx + 1) * cellW, img.width); x++) {
          const i = (y * img.width + x) * 4;
          const a = img.rgba[i + 3] / 255;
          const r = img.rgba[i];
          const g = img.rgba[i + 1];
          const b = img.rgba[i + 2];
          const dark = (255 - (0.299 * r + 0.587 * g + 0.114 * b)) / 255;
          ink += a * dark;
          n++;
        }
      }
      grid[gy][gx] = n > 0 ? ink / n : 0;
      total += grid[gy][gx];
      cells++;
    }
  }
  return { grid, inkRatio: cells ? total / cells : 0 };
}

function baseSimilarity(a: number[][], b: number[][]): number {
  let weighted = 0;
  let weightTotal = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const av = a[y][x];
      const bv = b[y][x];
      const weight = 0.35 + Math.max(av, bv);
      weighted += (1 - Math.abs(av - bv)) * weight;
      weightTotal += weight;
    }
  }
  return weightTotal ? weighted / weightTotal : 0;
}

/** Try ±1 cell shifts to tolerate minor rotational/positional drift. */
function bestShiftSimilarity(a: number[][], b: number[][]): number {
  const overlap = (dx: number, dy: number) => {
    let weighted = 0;
    let weightTotal = 0;
    for (let y = 0; y < GRID; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= GRID) continue;
      for (let x = 0; x < GRID; x++) {
        const sx = x + dx;
        if (sx < 0 || sx >= GRID) continue;
        const av = a[y][x];
        const bv = b[sy][sx];
        const weight = 0.35 + Math.max(av, bv);
        weighted += (1 - Math.abs(av - bv)) * weight;
        weightTotal += weight;
      }
    }
    return weightTotal ? weighted / weightTotal : 0;
  };
  let best = baseSimilarity(a, b);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      best = Math.max(best, overlap(dx, dy));
    }
  }
  return best;
}

/** Low-confidence fallback when either image cannot be decoded as PNG. */
function heuristicSimilarity(aBytes: Buffer, bBytes: Buffer): { score: number; notes: string } {
  const common = Math.min(aBytes.length, bBytes.length);
  if (common === 0) return { score: 0, notes: 'Empty image payload.' };
  const lenRatio = Math.min(aBytes.length, bBytes.length) / Math.max(aBytes.length, bBytes.length);

  // Entropy sampling over the paired byte streams — a weak structural proxy.
  let acc = 0;
  const samples = Math.min(1024, common);
  for (let i = 0; i < samples; i++) {
    const a = aBytes[Math.floor((i / samples) * aBytes.length)];
    const b = bBytes[Math.floor((i / samples) * bBytes.length)];
    acc += a === b ? 1 : 0;
  }
  const byteAgreement = samples ? acc / samples : 0;
  const score = Math.round(Math.min(100, Math.max(0, lenRatio * 55 + byteAgreement * 45)) * 100) / 100;
  return { score, notes: 'One or both images are not PNG — heuristic comparison, low confidence.' };
}

function verdictOf(score: number): MatchVerdict {
  if (score >= 90) return 'auto_approved';
  if (score >= 70) return 'teller_review';
  return 'blocked';
}

export class BaselineSignatureMatcher implements SignatureMatchProvider {
  readonly id = 'baseline-v1';
  readonly displayName = 'Baseline image matcher (deterministic)';

  async match(presented: string, specimen: string): Promise<SignatureMatchResult> {
    const [presentedRes, specimenRes] = await Promise.all([
      resolveImageBytes(presented),
      resolveImageBytes(specimen),
    ]);
    if (!presentedRes || !specimenRes) {
      return { score: 0, verdict: 'blocked', provider: this.id, notes: 'Could not resolve one or both signature images.', lowConfidence: true };
    }

    const a = decodePng(presentedRes.bytes);
    const b = decodePng(specimenRes.bytes);
    if (!a || !b) {
      const heur = heuristicSimilarity(presentedRes.bytes, specimenRes.bytes);
      return { score: heur.score, verdict: verdictOf(heur.score), provider: this.id, notes: heur.notes, lowConfidence: true };
    }

    const pa = toInkGrid(a);
    const pb = toInkGrid(b);
    const inkAgreement = 1 - Math.abs(pa.inkRatio - pb.inkRatio);
    const geometry = bestShiftSimilarity(pa.grid, pb.grid);
    const score = Math.round((geometry * 0.85 + inkAgreement * 0.15) * 10000) / 100;

    return {
      score: Math.min(100, Math.max(0, score)),
      verdict: verdictOf(score),
      provider: this.id,
      notes: `Grid ${GRID}×${GRID} ink-agreement ${(geometry * 100).toFixed(1)}%, ink-ratio ${(inkAgreement * 100).toFixed(1)}% (${a.width}×${a.height} vs ${b.width}×${b.height}px).`,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Registry + dispatcher
// ─────────────────────────────────────────────────────────────

const providers = new Map<string, SignatureMatchProvider>();
providers.set('baseline-v1', new BaselineSignatureMatcher());

export function registerSignatureMatchProvider(provider: SignatureMatchProvider): void {
  providers.set(provider.id, provider);
}

export function getSignatureMatchProviders(): SignatureMatchProvider[] {
  return Array.from(providers.values());
}

export function getSignatureMatchProvider(id?: string): SignatureMatchProvider {
  const provider = id ? providers.get(id) : undefined;
  return provider ?? providers.get('baseline-v1')!;
}

export interface SignatureVerifyRequest {
  accountId: string;
  memberId: string;
  presentedImageUrl: string;
  specimenImageUrl: string;
  specimenId?: string | null;
  providerId?: string;
}

export const signatureMatchService = {
  async verify(request: SignatureVerifyRequest, organizationId: string): Promise<SignatureMatchResult & { providerId: string }> {
    const provider = getSignatureMatchProvider(request.providerId);
    const result = await provider.match(request.presentedImageUrl, request.specimenImageUrl, { organizationId });
    return { ...result, providerId: provider.id };
  },
};