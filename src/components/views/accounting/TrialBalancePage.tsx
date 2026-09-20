import React from 'react';
import { AccountsView } from '../AccountsView';

export const TrialBalancePage: React.FC = () => (
  <AccountsView activeSubKey="accounts_trial" standalone />
);
