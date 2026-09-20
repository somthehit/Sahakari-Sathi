/**
 * Share Ceiling Engine (सेयर सीमा इन्जिन)
 *
 * Three ceilings are enforced for every share ISSUE, checked cheapest/most-local
 * first so a rejection short-circuits before touching the org-wide row:
 *
 *   1. Share-type ceiling  — the requested kitta range must fit within the
 *      share type's approved max_allowed_kitta (a kitta-number ceiling).
 *   2. Organization kitta ceiling — totalIssuedKitta + quantity must not
 *      exceed authorizedTotalKitta.
 *   3. Organization capital ceiling — totalIssuedCapital + totalAmount must
 *      not exceed authorizedCapitalCeiling.
 *
 * IMPORTANT: checkShareCeilings must be called INSIDE the same DB transaction
 * that performs the issuance, against rows already locked with SELECT ... FOR
 * UPDATE (lock order: organization_share_settings -> share_types). Checking in a
 * pre-flight read before the transaction is NOT sufficient — another issuance
 * can commit in between the check and the write.
 */
export class ShareCeilingError extends Error {}

/**
 * Dynamic per-type kitta allocation against the org pool.
 *
 * When an admin creates or edits a share type, the Max Allowed Kitta ceiling
 * must fit within the org's authorizedTotalKitta minus the ceilings already
 * committed to the OTHER share types:
 *
 *   allocatedToOtherTypes = Σ maxAllowedKitta (other types)
 *   availablePoolForType  = max(0, authorizedTotalKitta - allocatedToOtherTypes)
 *
 * Edit mode is allowed to KEEP the type's existing ceiling even when the pool
 * is currently exceeded (legacy over-allocation), but may never raise it. NULL
 * (unlimited) ceilings from legacy types consume the entire pool — you cannot
 * bound a new allocation while an unlimited sibling exists.
 */
export interface MaxAllowedKittaInput {
  authorizedTotalKitta: number;
  /** maxAllowedKitta of every OTHER type (null = legacy unlimited). */
  otherTypeCeilings: Array<number | null>;
  /** The type's own current ceiling when editing (null on create). */
  currentCeiling?: number | null;
}

export interface MaxAllowedKittaResult {
  allocatedToOtherTypes: number;
  availablePoolForType: number;
  /** The hard max a user may enter / save (pool, or the current ceiling on edit). */
  allowedMax: number;
  isOverAllocated: boolean;
}

export function computeMaxAllowedKitta(input: MaxAllowedKittaInput): MaxAllowedKittaResult {
  const authorized = Number(input.authorizedTotalKitta) || 0;
  const hasUnlimitedOther = input.otherTypeCeilings.some((c) => c == null);
  const allocatedToOtherTypes = hasUnlimitedOther
    ? authorized
    : (input.otherTypeCeilings as Array<number | null>).reduce((sum, c) => sum + (Number(c) || 0), 0);
  const availablePoolForType = Math.max(0, authorized - allocatedToOtherTypes);
  const current = Number(input.currentCeiling) || 0;
  const allowedMax = Math.max(availablePoolForType, current);
  return { allocatedToOtherTypes, availablePoolForType, allowedMax, isOverAllocated: allocatedToOtherTypes > authorized };
}

export interface ShareTypeCeilingView {
  name: string;
  kittaStartBase: number | null;
  currentKittaPointer: number;
  maxAllowedKitta: number | null;
  autoSequence: boolean;
}

export interface OrgShareCeilingView {
  totalIssuedKitta: number;
  authorizedTotalKitta: number;
  totalIssuedCapital: number;
  authorizedCapitalCeiling: number;
}

export interface CheckCeilingsParams {
  shareType: ShareTypeCeilingView;
  orgSettings: OrgShareCeilingView;
  quantity: number;
  totalAmount: number;
  /**
   * Required range end kitta for a MANUAL entry (autoSequence=false). When
   * omitted, the engine derives the next automatic range from the pointer.
   */
  manualEndKitta?: number | null;
}

/** Next automatic start kitta for a share type (honours kitta_start_base). */
export function nextStartKitta(type: Pick<ShareTypeCeilingView, 'kittaStartBase' | 'currentKittaPointer'>): number {
  const base = type.kittaStartBase != null ? type.kittaStartBase : 0;
  return Math.max(type.currentKittaPointer + 1, base);
}

/** Auto allocation of the next `quantity` kitta for a share type. */
export function computeKittaRange(type: Pick<ShareTypeCeilingView, 'kittaStartBase' | 'currentKittaPointer'>, quantity: number): { start: number; end: number } {
  const start = nextStartKitta(type);
  return { start, end: start + quantity - 1 };
}

/**
 * Master ceiling check. Throws ShareCeilingError with the remaining headroom in
 * the message. Cheap org-free checks run first.
 */
export function checkShareCeilings(params: CheckCeilingsParams): void {
  const { shareType, orgSettings, quantity, totalAmount } = params;

  const requiredEndKitta =
    params.manualEndKitta != null
      ? params.manualEndKitta
      : computeKittaRange(shareType, quantity).end;

  // 1. Share-type ceiling (kitta-number ceiling).
  if (shareType.maxAllowedKitta != null && requiredEndKitta > shareType.maxAllowedKitta) {
    const requiredStart = requiredEndKitta - quantity + 1;
    const remaining = Math.max(0, shareType.maxAllowedKitta - requiredStart + 1);
    throw new ShareCeilingError(
      `${shareType.name} can issue at most ${remaining} more kitta (ceiling: ${shareType.maxAllowedKitta}).`
    );
  }

  // 2. Organization kitta ceiling.
  const orgKittaRemaining = orgSettings.authorizedTotalKitta - orgSettings.totalIssuedKitta;
  if (quantity > orgKittaRemaining) {
    throw new ShareCeilingError(
      `Organization-wide kitta ceiling reached. Remaining: ${Math.max(0, orgKittaRemaining)} of ${orgSettings.authorizedTotalKitta}.`
    );
  }

  // 3. Organization capital ceiling.
  const capitalRemaining = Number(orgSettings.authorizedCapitalCeiling) - Number(orgSettings.totalIssuedCapital);
  if (totalAmount > capitalRemaining) {
    throw new ShareCeilingError(
      `Authorized capital ceiling reached. Remaining: NPR ${capitalRemaining.toLocaleString()} of NPR ${Number(orgSettings.authorizedCapitalCeiling).toLocaleString()}.`
    );
  }
}