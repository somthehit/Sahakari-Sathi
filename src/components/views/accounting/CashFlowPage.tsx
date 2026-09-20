import React from 'react';
import { AccountsView } from '../AccountsView';

export const CashFlowPage: React.FC = () => (
  <AccountsView activeSubKey="accounts_cashflow" standalone />
);
