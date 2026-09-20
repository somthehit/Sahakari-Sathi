import React from 'react';
import { AccountsView } from '../AccountsView';

export const LedgerSheetsPage: React.FC = () => (
  <AccountsView activeSubKey="accounts_ledger" standalone />
);
