import React from 'react';
import { Clock } from 'lucide-react';
import { NotConfiguredPanel } from '../common/NotConfiguredPanel';

interface Props {
  activeSubKey?: string;
}

/**
 * Automated job scheduler.
 *
 * This screen used to display four invented cron jobs with fabricated
 * last-run/next-run dates and a green "Cron Engine Status: Active" badge, and
 * three of its four "Run Job Now" buttons resolved a timer into a success
 * notification without doing anything. (The fourth called the in-memory
 * `runInterestPosting`, which itself does not persist.) There is no scheduler
 * process, so advertising active automated jobs was actively misleading — an
 * admin could believe interest and EMI were posting themselves on a schedule
 * when nothing was running.
 */
export const AdminSchedulerView: React.FC<Props> = () => (
  <div className="space-y-6">
    <NotConfiguredPanel title="No automated job scheduler is running" icon={Clock}>
      <p>
        The application does not run a cron engine, so there are no scheduled jobs to list and
        nothing here posts interest, generates EMI installments or calculates dividends on a
        timer.
      </p>
      <p>
        Those are performed as deliberate actions from their own modules — quarterly interest from
        Savings, repayments from Loans — so that a person reviews the figures before they hit the
        ledger. Treat period-end postings as manual steps in your closing checklist, not as
        background automation.
      </p>
    </NotConfiguredPanel>
  </div>
);
