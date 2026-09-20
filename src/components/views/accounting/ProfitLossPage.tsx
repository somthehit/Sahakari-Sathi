import React from 'react';
import { AccountsView } from '../AccountsView';

export const ProfitLossPage: React.FC = () => (
  <AccountsView activeSubKey="accounts_income_stmt" standalone />
);
