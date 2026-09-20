import React from 'react';
import { AccountsView } from '../AccountsView';

export const BalanceSheetPage: React.FC = () => (
  <AccountsView activeSubKey="accounts_balance_sheet" standalone />
);
