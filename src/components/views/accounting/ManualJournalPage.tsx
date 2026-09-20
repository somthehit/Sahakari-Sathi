import React from 'react';
import { AccountsView } from '../AccountsView';

export const ManualJournalPage: React.FC = () => (
  <AccountsView activeSubKey="accounts_gl" standalone />
);
