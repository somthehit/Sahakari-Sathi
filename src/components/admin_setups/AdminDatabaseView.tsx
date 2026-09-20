import React from 'react';
import { Database, HardDrive, Wrench, Archive } from 'lucide-react';
import { NotConfiguredPanel } from '../common/NotConfiguredPanel';

interface Props {
  activeSubKey?: string;
}

/**
 * Database backup & maintenance.
 *
 * This screen used to list three invented backup files with plausible sizes and
 * BS timestamps, and its "Trigger Instant Backup" button resolved a 1.5s timer
 * into a success notification naming a file that was never written. There is no
 * backup, restore or maintenance endpoint on the server, so nothing here can be
 * made to work from the browser; the screen now says so instead of reassuring
 * an administrator that the co-operative's data is being protected.
 */
export const AdminDatabaseView: React.FC<Props> = ({ activeSubKey = 'admin_db_backup' }) => {
  const subTab = activeSubKey;

  return (
    <div className="space-y-6">

      {/* 1. BACKUP */}
      {subTab === 'admin_db_backup' && (
        <NotConfiguredPanel title="Database backups are not managed from this screen" icon={Database}>
          <p>
            No backup service is connected to the application, so there is nothing here to list
            and no snapshot can be triggered from the browser. Any backups that exist are the ones
            configured on the database itself.
          </p>
          <p>
            Confirm your retention schedule with whoever administers the database before relying on
            it — a co-operative ledger should have a tested restore, not an assumed one.
          </p>
        </NotConfiguredPanel>
      )}

      {/* 2. MAINTENANCE */}
      {subTab === 'admin_db_maintenance' && (
        <NotConfiguredPanel title="Maintenance tasks must be run on the database host" icon={Wrench}>
          <p>
            <span className="font-mono font-bold text-slate-800">VACUUM</span>,{' '}
            <span className="font-mono font-bold text-slate-800">REINDEX</span> and audit-log
            trimming need database-owner privileges and can lock tables while they run. Exposing
            them to a web request would let a mistimed click stall live teller transactions, so the
            application does not offer them.
          </p>
          <p>
            Run them from a maintenance window on the database host instead, outside counter hours.
          </p>
        </NotConfiguredPanel>
      )}

      {/* 3. RESTORE */}
      {subTab === 'admin_db_restore' && (
        <NotConfiguredPanel title="Restore is deliberately not available in the application" icon={HardDrive}>
          <p>
            A restore overwrites every member, savings, loan and ledger record in the organization.
            It is not something that should be reachable from a browser session, and no endpoint
            exists for it.
          </p>
          <p>
            Restores must be performed directly against the database by an administrator who can
            verify the snapshot first.
          </p>
        </NotConfiguredPanel>
      )}
      {/* 4. ARCHIVE */}
      {subTab === 'admin_db_archive' && (
        <NotConfiguredPanel title="Data archiving is not implemented" icon={Archive}>
          <p>
            Nothing moves closed fiscal years into cold storage, so no archive exists to browse or
            restore from. All historical records remain in the live database and stay queryable
            from the reporting modules.
          </p>
          <p>
            Note that co-operative records carry statutory retention periods — do not purge old
            fiscal years to save space without confirming what you are required to keep.
          </p>
        </NotConfiguredPanel>
      )}
    </div>
  );
};
