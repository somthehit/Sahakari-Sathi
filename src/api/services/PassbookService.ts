/**
 * Passbook Service
 *
 * Owns the passbook subsystem that sits alongside the teller savings flows:
 *   • print layouts (calibratable designs — mirrors the cheque design studio)
 *   • physical booklets (issuance + renewal chain, capacity tracking)
 *   • the two-step print flow — build a print payload with NO side effects, then
 *     confirm it landed, which atomically advances the account's continuation
 *     marker and writes the print log. This is the safety fix over the previous
 *     printer, which advanced the marker the instant a PDF was generated (a
 *     jammed print silently lost lines).
 *
 * Ledger reads (summary + unprinted transactions) are delegated to
 * SavingsDepositService so there is a single source of truth for balances.
 */
import { and, eq, desc, ne } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  passbookDesigns,
  passbookBooks,
  passbookPrintLog,
  savingsAccounts,
} from '../../db/schema';
import { SavingsDepositService } from './SavingsDepositService';
import { buildAuditRow, writeAuditLog, SettingsActor } from '../utils/audit';
import { getTodayBS } from '../../utils/nepaliCalendar';
import {
  DEFAULT_PASSBOOK_LAYOUT,
  DEFAULT_A4_STATEMENT_LAYOUT,
  sanitizeLayout,
  paginatePassbook,
  linesRemainingInBook,
  willFillBook,
  type PassbookLayoutConfig,
} from '../../utils/passbookLayout';

const MAX_CONFIG_BYTES = 4 * 1024 * 1024; // 4 MB, matching the cheque design cap.

/** Normalize a design's incoming configJson (object → string) with a size guard. */
function serializeConfig(configJson: unknown): string | null {
  if (configJson == null) return null;
  const asString = typeof configJson === 'string' ? configJson : JSON.stringify(configJson);
  if (Buffer.byteLength(asString, 'utf8') > MAX_CONFIG_BYTES) {
    throw new Error('Passbook layout configuration is too large (4 MB limit).');
  }
  return asString;
}

/** Parse a stored configJson string back to an object for the client. */
function parseConfig(configJson: string | null): any {
  if (!configJson) return null;
  try {
    return JSON.parse(configJson);
  } catch {
    return null;
  }
}

type Mode = 'booklet' | 'a4' | 'thermal';

export class PassbookService {
  private savings = new SavingsDepositService();

  // ─────────────────────────────────────────────────────────────
  // Print layouts (design studio) — mirrors ChequeRegistry design CRUD
  // ─────────────────────────────────────────────────────────────

  async listDesigns(organizationId: string, includeInactive = false) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const conditions = [eq(passbookDesigns.organizationId, organizationId)];
    if (!includeInactive) conditions.push(eq(passbookDesigns.isActive, true));
    const rows = await db.select()
      .from(passbookDesigns)
      .where(and(...conditions))
      .orderBy(desc(passbookDesigns.isDefault), passbookDesigns.sortOrder, passbookDesigns.name);
    return rows.map((r) => ({ ...r, config: parseConfig(r.configJson) }));
  }

  async getDesign(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const [row] = await db.select()
      .from(passbookDesigns)
      .where(and(eq(passbookDesigns.id, id), eq(passbookDesigns.organizationId, organizationId)))
      .limit(1);
    if (!row) throw new Error('Passbook design not found.');
    return { ...row, config: parseConfig(row.configJson) };
  }

  async createDesign(organizationId: string, defaultBranchId: string | null, userId: string | null, val: any) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const code = String(val.code).trim().toUpperCase();

    const [dupe] = await db.select({ id: passbookDesigns.id })
      .from(passbookDesigns)
      .where(and(eq(passbookDesigns.organizationId, organizationId), eq(passbookDesigns.code, code)))
      .limit(1);
    if (dupe) throw Object.assign(new Error(`A design with code "${code}" already exists.`), { status: 409 });

    const created = await db.transaction(async (tx) => {
      if (val.isDefault) {
        await tx.update(passbookDesigns)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(passbookDesigns.organizationId, organizationId), eq(passbookDesigns.isDefault, true)));
      }
      const [row] = await tx.insert(passbookDesigns).values({
        organizationId,
        branchId: val.branchId ?? defaultBranchId ?? null,
        code,
        name: val.name,
        description: val.description ?? null,
        mode: (val.mode as Mode) ?? 'booklet',
        isActive: val.isActive ?? true,
        isDefault: val.isDefault ?? false,
        sortOrder: val.sortOrder ?? 0,
        widthMm: String(val.widthMm ?? 105),
        heightMm: String(val.heightMm ?? 165),
        configJson: serializeConfig(val.configJson),
        createdBy: userId,
        updatedBy: userId,
      }).returning();
      return row;
    });

    return { ...created, config: parseConfig(created.configJson) };
  }

  async updateDesign(id: string, organizationId: string, userId: string | null, val: any) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const [existing] = await db.select()
      .from(passbookDesigns)
      .where(and(eq(passbookDesigns.id, id), eq(passbookDesigns.organizationId, organizationId)))
      .limit(1);
    if (!existing) throw new Error('Passbook design not found.');

    let code = existing.code;
    if (val.code != null) {
      code = String(val.code).trim().toUpperCase();
      if (code !== existing.code) {
        const [dupe] = await db.select({ id: passbookDesigns.id })
          .from(passbookDesigns)
          .where(and(
            eq(passbookDesigns.organizationId, organizationId),
            eq(passbookDesigns.code, code),
            ne(passbookDesigns.id, id),
          ))
          .limit(1);
        if (dupe) throw Object.assign(new Error(`A design with code "${code}" already exists.`), { status: 409 });
      }
    }

    const patch: any = { updatedAt: new Date(), updatedBy: userId, code };
    if (val.name != null) patch.name = val.name;
    if (val.description !== undefined) patch.description = val.description ?? null;
    if (val.mode != null) patch.mode = val.mode;
    if (val.isActive != null) patch.isActive = val.isActive;
    if (val.sortOrder != null) patch.sortOrder = val.sortOrder;
    if (val.widthMm != null) patch.widthMm = String(val.widthMm);
    if (val.heightMm != null) patch.heightMm = String(val.heightMm);
    if (val.branchId !== undefined) patch.branchId = val.branchId ?? null;
    if (val.configJson !== undefined) patch.configJson = serializeConfig(val.configJson);
    if (val.isDefault != null) patch.isDefault = val.isDefault;

    const updated = await db.transaction(async (tx) => {
      if (val.isDefault === true) {
        await tx.update(passbookDesigns)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(
            eq(passbookDesigns.organizationId, organizationId),
            eq(passbookDesigns.isDefault, true),
            ne(passbookDesigns.id, id),
          ));
      }
      const [row] = await tx.update(passbookDesigns)
        .set(patch)
        .where(and(eq(passbookDesigns.id, id), eq(passbookDesigns.organizationId, organizationId)))
        .returning();
      return row;
    });

    return { ...updated, config: parseConfig(updated.configJson) };
  }

  async deleteDesign(id: string, organizationId: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const [existing] = await db.select({ id: passbookDesigns.id })
      .from(passbookDesigns)
      .where(and(eq(passbookDesigns.id, id), eq(passbookDesigns.organizationId, organizationId)))
      .limit(1);
    if (!existing) throw new Error('Passbook design not found.');
    await db.delete(passbookDesigns)
      .where(and(eq(passbookDesigns.id, id), eq(passbookDesigns.organizationId, organizationId)));
    return { success: true };
  }

  /** Resolve the layout to print with: explicit design → default design for mode → built-in. */
  private async resolveLayout(organizationId: string, mode: Mode, designId?: string | null): Promise<{ layout: PassbookLayoutConfig; designId: string | null }> {
    const db = getDb();
    const base = mode === 'a4' ? DEFAULT_A4_STATEMENT_LAYOUT : DEFAULT_PASSBOOK_LAYOUT;
    if (db) {
      if (designId) {
        const [row] = await db.select().from(passbookDesigns)
          .where(and(eq(passbookDesigns.id, designId), eq(passbookDesigns.organizationId, organizationId)))
          .limit(1);
        if (row) return { layout: sanitizeLayout(parseConfig(row.configJson), base), designId: row.id };
      }
      const [def] = await db.select().from(passbookDesigns)
        .where(and(
          eq(passbookDesigns.organizationId, organizationId),
          eq(passbookDesigns.mode, mode),
          eq(passbookDesigns.isActive, true),
          eq(passbookDesigns.isDefault, true),
        ))
        .limit(1);
      if (def) return { layout: sanitizeLayout(parseConfig(def.configJson), base), designId: def.id };
    }
    return { layout: base, designId: null };
  }

  // ─────────────────────────────────────────────────────────────
  // Booklets — issuance & renewal
  // ─────────────────────────────────────────────────────────────

  async listBooks(accountId: string, organizationId: string, branchIds?: string[]) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    // Scope guard: confirm the account is visible to the caller's branches.
    await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    return db.select().from(passbookBooks)
      .where(and(eq(passbookBooks.organizationId, organizationId), eq(passbookBooks.accountId, accountId)))
      .orderBy(desc(passbookBooks.createdAt));
  }

  async getActiveBook(accountId: string, organizationId: string) {
    const db = getDb();
    if (!db) return null;
    const [row] = await db.select().from(passbookBooks)
      .where(and(
        eq(passbookBooks.organizationId, organizationId),
        eq(passbookBooks.accountId, accountId),
        eq(passbookBooks.status, 'active'),
      ))
      .orderBy(desc(passbookBooks.createdAt))
      .limit(1);
    return row ?? null;
  }

  private async assertSerialFree(db: any, organizationId: string, serial: string) {
    const [dupe] = await db.select({ id: passbookBooks.id })
      .from(passbookBooks)
      .where(and(eq(passbookBooks.organizationId, organizationId), eq(passbookBooks.serial, serial)))
      .limit(1);
    if (dupe) throw Object.assign(new Error(`A passbook with serial "${serial}" already exists.`), { status: 409 });
  }

  /** Fetch just the account's branch (books/logs are branch-scoped like the account). */
  private async getAccountBranch(db: any, accountId: string, organizationId: string): Promise<string | null> {
    const [row] = await db.select({ branchId: savingsAccounts.branchId })
      .from(savingsAccounts)
      .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)))
      .limit(1);
    return row?.branchId ?? null;
  }

  /** Issue the first (or an additional 'new') booklet for an account. */
  async issueBook(accountId: string, organizationId: string, branchIds: string[] | undefined, actor: SettingsActor, val: any) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    // Enforces branch scope and gives us account number + current geometry.
    const summary = await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    const branchId = await this.getAccountBranch(db, accountId, organizationId);

    const serial = String(val.serial).trim();
    const linesPerPage = Number(val.linesPerPage ?? summary.linesPerPage ?? 30);
    const pageCount = Number(val.pageCount ?? 20);
    const capacity = linesPerPage * pageCount;

    const book = await db.transaction(async (tx) => {
      await this.assertSerialFree(tx, organizationId, serial);
      const [row] = await tx.insert(passbookBooks).values({
        organizationId,
        branchId,
        accountId,
        serial,
        status: 'active',
        linesPerPage,
        pageCount,
        capacity,
        linesUsed: 0,
        issuedDateBs: val.issuedDateBs ?? getTodayBS(),
        issuedDateAd: val.issuedDateAd ?? null,
        issuanceReason: val.reason ?? 'new',
        issuedBy: actor.userId ?? null,
        remarks: val.remarks ?? null,
      }).returning();
      // Point the account at this booklet's serial + page geometry.
      await tx.update(savingsAccounts)
        .set({ passbookSerial: serial, passbookLinesPerPage: linesPerPage, updatedAt: new Date() })
        .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)));
      return row;
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Passbook', 'Issue Passbook Book',
      `Issued passbook ${serial} (${pageCount} pages × ${linesPerPage} lines) for account ${summary.accountNumber}`,
    ));
    return book;
  }

  /**
   * Renew: close the current active booklet and issue a fresh one, linking the
   * chain. The continuation marker's LINE resets to 0 (new physical book starts
   * empty) but lastPrintedTxnId is preserved so already-printed transactions are
   * not reprinted into the new book.
   */
  async renewBook(accountId: string, organizationId: string, branchIds: string[] | undefined, actor: SettingsActor, val: any) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const summary = await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    const current = await this.getActiveBook(accountId, organizationId);
    const branchId = current?.branchId ?? await this.getAccountBranch(db, accountId, organizationId);

    const serial = String(val.serial).trim();
    const linesPerPage = Number(val.linesPerPage ?? current?.linesPerPage ?? summary.linesPerPage ?? 30);
    const pageCount = Number(val.pageCount ?? current?.pageCount ?? 20);
    const capacity = linesPerPage * pageCount;
    const reason: 'new' | 'renewal' | 'lost' | 'damaged' | 'full' = val.reason ?? 'renewal';
    const closedStatus = reason === 'lost' ? 'lost' : reason === 'damaged' ? 'replaced' : reason === 'full' ? 'full' : 'replaced';

    const book = await db.transaction(async (tx) => {
      await this.assertSerialFree(tx, organizationId, serial);
      const [row] = await tx.insert(passbookBooks).values({
        organizationId,
        branchId,
        accountId,
        serial,
        status: 'active',
        linesPerPage,
        pageCount,
        capacity,
        linesUsed: 0,
        issuedDateBs: val.issuedDateBs ?? getTodayBS(),
        issuedDateAd: val.issuedDateAd ?? null,
        issuanceReason: reason,
        previousBookId: current?.id ?? null,
        issuedBy: actor.userId ?? null,
        remarks: val.remarks ?? null,
      }).returning();

      if (current) {
        await tx.update(passbookBooks)
          .set({ status: closedStatus, replacedByBookId: row.id, closedDateBs: getTodayBS(), updatedAt: new Date() })
          .where(and(eq(passbookBooks.id, current.id), eq(passbookBooks.organizationId, organizationId)));
      }

      // Fresh book → reset line to 0, keep the printed-txn marker.
      await tx.update(savingsAccounts)
        .set({ passbookSerial: serial, passbookLinesPerPage: linesPerPage, lastPrintedLine: 0, updatedAt: new Date() })
        .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)));
      return row;
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Passbook', 'Renew Passbook Book',
      `Renewed passbook for account ${summary.accountNumber}: ${current?.serial ?? '—'} → ${serial} (${reason})`,
    ));
    return book;
  }

  // ─────────────────────────────────────────────────────────────
  // Print flow — build payload (no side effects) then confirm
  // ─────────────────────────────────────────────────────────────

  /**
   * Build everything the client print engine needs, WITHOUT touching any marker.
   * The client renders + prints, then calls confirmPrint with the geometry echoed
   * back here so the advance is atomic and only happens on a confirmed print.
   */
  async buildPrintPayload(accountId: string, organizationId: string, branchIds: string[] | undefined, opts: { mode: Mode; designId?: string | null; rangeMode: 'since_last' | 'custom'; fromDateBs?: string; toDateBs?: string }) {
    const summary = await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    const lines = await this.savings.getUnprintedTransactions(
      accountId, organizationId, branchIds,
      opts.rangeMode === 'custom' ? { from: opts.fromDateBs, to: opts.toDateBs } : {},
    );

    const { layout, designId } = await this.resolveLayout(organizationId, opts.mode, opts.designId);
    const book = opts.mode === 'booklet' ? await this.getActiveBook(accountId, organizationId) : null;

    // Booklet resumes on the physical line where the last print stopped; A4 and
    // thermal are self-contained sheets that always start at line 0.
    const startLine = opts.mode === 'booklet' ? summary.lastPrintedLine : 0;
    const linesPerPage = book?.linesPerPage ?? layout.linesPerPage;
    const pagination = paginatePassbook(lines.length, {
      startLine,
      linesPerPage,
      marginTopMm: layout.marginTopMm,
      lineHeightMm: layout.lineHeightMm,
    });

    const capacity = book?.capacity ?? 0;
    const linesUsed = book?.linesUsed ?? 0;
    const remaining = book ? linesRemainingInBook(capacity, linesUsed) : null;
    const willFill = book ? willFillBook(capacity, linesUsed, lines.length) : false;

    const first = lines[0];
    const last = lines[lines.length - 1];

    return {
      account: summary,
      mode: opts.mode,
      layout,
      designId,
      transactions: lines,
      pagination,
      startLine,
      book: book
        ? { id: book.id, serial: book.serial, status: book.status, capacity, linesUsed, remaining, willFill, linesPerPage: book.linesPerPage, pageCount: book.pageCount }
        : null,
      // Echo-back geometry the client returns verbatim on confirm.
      confirm: {
        mode: opts.mode,
        designId,
        bookId: book?.id ?? null,
        fromTxnId: first?.id ?? null,
        toTxnId: last?.id ?? null,
        txnCount: lines.length,
        startLine,
        endLine: pagination.finalLine,
        linesPrinted: pagination.linesConsumed,
        pageCount: pagination.pageCount,
        fromDateBs: first?.bsDate ?? null,
        toDateBs: last?.bsDate ?? null,
        advanceMarker: opts.mode === 'booklet',
      },
    };
  }

  /**
   * Record a confirmed print: write the print-log row and, for booklet prints,
   * atomically advance the account continuation marker and the book usage. A4 /
   * thermal are reprints of recorded history and never move the marker.
   */
  async confirmPrint(accountId: string, organizationId: string, branchIds: string[] | undefined, actor: SettingsActor, val: any) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    const summary = await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    const mode: Mode = val.mode ?? 'booklet';
    const advance = val.advanceMarker !== undefined ? !!val.advanceMarker : mode === 'booklet';

    const book = val.bookId
      ? (await db.select().from(passbookBooks).where(and(eq(passbookBooks.id, val.bookId), eq(passbookBooks.organizationId, organizationId))).limit(1))[0] ?? null
      : (mode === 'booklet' ? await this.getActiveBook(accountId, organizationId) : null);

    const logRow = await db.transaction(async (tx) => {
      const [row] = await tx.insert(passbookPrintLog).values({
        organizationId,
        branchId: (book as any)?.branchId ?? null,
        accountId,
        bookId: book?.id ?? null,
        designId: val.designId ?? null,
        mode,
        status: 'printed',
        fromTxnId: val.fromTxnId ?? null,
        toTxnId: val.toTxnId ?? null,
        txnCount: Number(val.txnCount ?? 0),
        startLine: Number(val.startLine ?? 0),
        endLine: Number(val.endLine ?? 0),
        linesPrinted: Number(val.linesPrinted ?? 0),
        pageCount: Number(val.pageCount ?? 0),
        fromDateBs: val.fromDateBs ?? null,
        toDateBs: val.toDateBs ?? null,
        printedBy: actor.userId ?? null,
        printedByName: actor.username ?? null,
        remarks: val.remarks ?? null,
      }).returning();

      if (advance) {
        const patch: any = { lastPrintedLine: Number(val.endLine ?? 0), lastPrintedDateBs: val.toDateBs ?? getTodayBS(), updatedAt: new Date() };
        if (val.toTxnId) patch.lastPrintedTxnId = val.toTxnId;
        await tx.update(savingsAccounts)
          .set(patch)
          .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.organizationId, organizationId)));

        if (book) {
          const newUsed = Number(book.linesUsed) + Number(val.linesPrinted ?? 0);
          const nextStatus = newUsed >= Number(book.capacity) ? 'full' : book.status;
          await tx.update(passbookBooks)
            .set({ linesUsed: newUsed, status: nextStatus, updatedAt: new Date() })
            .where(and(eq(passbookBooks.id, book.id), eq(passbookBooks.organizationId, organizationId)));
        }
      }
      return row;
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Passbook', 'Passbook Printed',
      `Printed ${Number(val.txnCount ?? 0)} line(s) [${mode}] for account ${summary.accountNumber}${advance ? '' : ' (no marker advance)'}`,
    ));

    const updated = await this.savings.getPassbookSummary(accountId, organizationId, branchIds);
    return { log: logRow, account: updated };
  }

  async listPrintLog(accountId: string, organizationId: string, branchIds?: string[]) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    await this.savings.getPassbookSummary(accountId, organizationId, branchIds); // scope guard
    return db.select().from(passbookPrintLog)
      .where(and(eq(passbookPrintLog.organizationId, organizationId), eq(passbookPrintLog.accountId, accountId)))
      .orderBy(desc(passbookPrintLog.createdAt));
  }

  /**
   * Void a print run. Only the most-recent PRINTED run for the account may be
   * voided; the continuation marker is rolled back to the run immediately before
   * it and the book usage is decremented, so the teller can re-print cleanly.
   */
  async voidPrintRun(id: string, organizationId: string, branchIds: string[] | undefined, actor: SettingsActor, reason?: string) {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');

    const [target] = await db.select().from(passbookPrintLog)
      .where(and(eq(passbookPrintLog.id, id), eq(passbookPrintLog.organizationId, organizationId)))
      .limit(1);
    if (!target) throw new Error('Print run not found.');
    if (target.status !== 'printed') throw Object.assign(new Error('This print run is already void.'), { status: 400 });

    await this.savings.getPassbookSummary(target.accountId, organizationId, branchIds); // scope guard

    // Latest printed run for this account?
    const [latest] = await db.select({ id: passbookPrintLog.id }).from(passbookPrintLog)
      .where(and(
        eq(passbookPrintLog.organizationId, organizationId),
        eq(passbookPrintLog.accountId, target.accountId),
        eq(passbookPrintLog.status, 'printed'),
      ))
      .orderBy(desc(passbookPrintLog.createdAt))
      .limit(1);
    if (!latest || latest.id !== target.id) {
      throw Object.assign(new Error('Only the most recent print run can be voided.'), { status: 400 });
    }

    // The run just before this one determines the restored marker.
    const priorRuns = await db.select().from(passbookPrintLog)
      .where(and(
        eq(passbookPrintLog.organizationId, organizationId),
        eq(passbookPrintLog.accountId, target.accountId),
        eq(passbookPrintLog.status, 'printed'),
      ))
      .orderBy(desc(passbookPrintLog.createdAt))
      .limit(2);
    const prior = priorRuns.find((r) => r.id !== target.id) ?? null;

    await db.transaction(async (tx) => {
      await tx.update(passbookPrintLog)
        .set({ status: 'void', remarks: reason ?? target.remarks ?? null })
        .where(and(eq(passbookPrintLog.id, id), eq(passbookPrintLog.organizationId, organizationId)));

      // Only booklet runs moved the marker; only roll back when this run advanced it.
      if (target.mode === 'booklet') {
        await tx.update(savingsAccounts)
          .set({
            lastPrintedTxnId: prior?.toTxnId ?? null,
            lastPrintedLine: prior?.endLine ?? 0,
            lastPrintedDateBs: prior?.toDateBs ?? null,
            updatedAt: new Date(),
          })
          .where(and(eq(savingsAccounts.id, target.accountId), eq(savingsAccounts.organizationId, organizationId)));

        if (target.bookId) {
          const [bk] = await tx.select().from(passbookBooks)
            .where(and(eq(passbookBooks.id, target.bookId), eq(passbookBooks.organizationId, organizationId)))
            .limit(1);
          if (bk) {
            const restored = Math.max(0, Number(bk.linesUsed) - Number(target.linesPrinted));
            const nextStatus = bk.status === 'full' && restored < Number(bk.capacity) ? 'active' : bk.status;
            await tx.update(passbookBooks)
              .set({ linesUsed: restored, status: nextStatus, updatedAt: new Date() })
              .where(and(eq(passbookBooks.id, bk.id), eq(passbookBooks.organizationId, organizationId)));
          }
        }
      }
    });

    await writeAuditLog(buildAuditRow(
      actor, 'Passbook', 'Void Passbook Print',
      `Voided print run ${id}${reason ? ` — ${reason}` : ''}`,
    ));

    const account = await this.savings.getPassbookSummary(target.accountId, organizationId, branchIds);
    return { success: true, account };
  }
}
