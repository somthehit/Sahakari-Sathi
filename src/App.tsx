import React from 'react';
import { Loader2 } from 'lucide-react';
import { CoopProvider, useCoop } from './context/CoopContext';
import { LocalizationProvider, useLocalization } from './context/LocalizationContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoginPage } from './components/auth/LoginPage';
import { SuperAdminLoginPage } from './components/auth/SuperAdminLoginPage';
import { AppBootstrapScreen } from './components/auth/AppBootstrapScreen';
import { SuperAdminWorkspace } from './components/super_admin/SuperAdminWorkspace';
import { ForcePasswordChangeView } from './components/auth/ForcePasswordChangeView';
import { SecuritySetupWizardView } from './components/auth/SecuritySetupWizardView';
import { completeSecuritySetup, fetchSessionPolicy } from './api/security';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useAuthStore, type AuthUser } from './stores/authStore';
import { useSuperAdminAuth, isSuperAdminTokenExpired } from './stores/superAdminAuthStore';
import { apiClient } from './lib/apiClient';
import { initSuperAdminApi } from './lib/superAdminApi';
import { TopHeader } from './components/layout/TopHeader';
import { MegaMenu } from './components/layout/MegaMenu';
import { TabBar } from './components/layout/TabBar';

import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { MemberDetailModal } from './components/modals/MemberDetailModal';
import { VoucherDetailModal } from './components/modals/VoucherDetailModal';
import { UnsavedChangesModal } from './components/modals/UnsavedChangesModal';
import { PassbookPrintModal } from './components/modals/PassbookPrintModal';
import { BranchFormModal } from './components/modals/BranchFormModal';
import { StaffFormModal } from './components/modals/StaffFormModal';
import { AddFiscalYearModal } from './components/modals/AddFiscalYearModal';
import { FiscalYearFirstRunGate } from './components/setup/FiscalYearFirstRunGate';
import { GlobalShortcutManager } from './components/common/GlobalShortcutManager';
import { ContextualActionButton } from './components/common/ContextualActionButton';

import { HomeDashboardView } from './components/views/HomeDashboardView';
import { MembersView } from './components/views/MembersView';
import { SavingsView } from './components/views/SavingsView';
import { AccountStatementsView } from './components/views/AccountStatementsView';
import { SavingsAccountRegisterView } from './components/views/SavingsAccountRegisterView';
import { OpenAccountView } from './components/views/OpenAccountView';
import { TellerDepositEntryView } from './components/views/TellerDepositEntryView';
import { TellerWithdrawalEntryView } from './components/views/TellerWithdrawalEntryView';
import { ChequeBookManageView } from './components/views/ChequeBookManageView';
import { AccountLedgerView } from './components/views/AccountLedgerView';
import { PassbookPrinterView } from './components/views/PassbookPrinterView';
import { LoansView } from './components/views/LoansView';
import { EmiRepaymentDeskView } from './components/views/loans/EmiRepaymentDeskView';
import { CreditAppraisalWizardView } from './components/views/loans/CreditAppraisalWizardView';
import { ActiveLoanPortfolioView } from './components/views/loans/ActiveLoanPortfolioView';
import { NplProvisioningMatrixView } from './components/views/loans/NplProvisioningMatrixView';
import { EmiAmortizationSimulatorView } from './components/views/loans/EmiAmortizationSimulatorView';
import { LoanInsuranceView } from './components/views/LoanInsuranceView';
import { LoanDetailView } from './components/views/loans/LoanDetailView';
import { LegalDocumentStudioView } from './components/views/legal/LegalDocumentStudioView';
import { SharesView } from './components/views/SharesView';
import { AccountsView } from './components/views/AccountsView';
import { VoucherRegisterPage } from './components/views/accounting/VoucherRegisterPage';
import { ManualJournalPage } from './components/views/accounting/ManualJournalPage';
import { TransactionsPage } from './components/views/accounting/TransactionsPage';
import { LedgerSheetsPage } from './components/views/accounting/LedgerSheetsPage';
import { SubsidiaryBooksPage } from './components/views/accounting/SubsidiaryBooksPage';
import { CashFlowPage } from './components/views/accounting/CashFlowPage';
import { TrialBalancePage } from './components/views/accounting/TrialBalancePage';
import { ProfitLossPage } from './components/views/accounting/ProfitLossPage';
import { BalanceSheetPage } from './components/views/accounting/BalanceSheetPage';
import { FinancialRatiosPage } from './components/views/accounting/FinancialRatiosPage';
import { DocAnnualReturnPage } from './components/views/reports/DocAnnualReturnPage';
import { DocStatisticalReturnPage } from './components/views/reports/DocStatisticalReturnPage';
import { IrdTaxReturnPage } from './components/views/reports/IrdTaxReturnPage';
import { TdsDeductionPage } from './components/views/reports/TdsDeductionPage';
import { AgmPackPage } from './components/views/reports/AgmPackPage';
import { AgmMinutesPage } from './components/views/reports/AgmMinutesPage';
import { BoardMeetingPage } from './components/views/reports/BoardMeetingPage';
import { AgmAttendancePage } from './components/views/reports/AgmAttendancePage';
import { MemberListReport } from './components/views/reports/MemberListReport';
import { TopTenMembersReport } from './components/views/reports/TopTenMembersReport';
import { DormantInactiveReport } from './components/views/reports/DormantInactiveReport';
import { OverdueNpaLoanReport } from './components/views/reports/OverdueNpaLoanReport';
import { DividendDistributionReport } from './components/views/reports/DividendDistributionReport';
import { ShareRegisterReport } from './components/views/reports/ShareRegisterReport';
import { ShareIssueReport } from './components/views/reports/ShareIssueReport';
import { ShareReturnReport } from './components/views/reports/ShareReturnReport';
import { ShareTransferReport } from './components/views/reports/ShareTransferReport';
import { ShareLedgerReport } from './components/views/reports/ShareLedgerReport';
import { ShareDividendReport } from './components/views/reports/ShareDividendReport';
import { SavingAccountsSummary } from './components/views/reports/SavingAccountsSummary';
import { SavingAccountsRegister } from './components/views/reports/SavingAccountsRegister';
import { SavingAccountsDeposit } from './components/views/reports/SavingAccountsDeposit';
import { SavingAccountsWithdrawal } from './components/views/reports/SavingAccountsWithdrawal';
import { SavingAccountsInterest } from './components/views/reports/SavingAccountsInterest';
import { SavingAccountsLedger } from './components/views/reports/SavingAccountsLedger';
import { SavingAccountsStatement } from './components/views/reports/SavingAccountsStatement';
import { AgmManagementView } from './components/views/AgmManagementView';
import { CashBankView } from './components/views/CashBankView';
import { BankCashDepositWithdrawalView } from './components/views/BankCashDepositWithdrawalView';
import { BankChequeManagementView } from './components/views/BankChequeManagementView';
import { BankChequeBookDetailView } from './components/views/BankChequeBookDetailView';
import { CashCountersBankAccountsView } from './components/views/CashCountersBankAccountsView';
import { CashReconciliationView } from './components/views/CashReconciliationView';
import { CashVarianceView } from './components/views/CashVarianceView';
import { CollectionMgmtView } from './components/views/CollectionMgmtView';
import { BudgetExpenseView } from './components/views/BudgetExpenseView';
import { FixedAssetsTaxView } from './components/views/FixedAssetsTaxView';
import { HrPayrollView } from './components/views/HrPayrollView';
import { StaffDirectoryView } from './components/views/StaffDirectoryView';
import { DepartmentProfileView } from './components/views/DepartmentProfileView';
import { InventoryView } from './components/views/InventoryView';
import { WorkflowApprovalView } from './components/views/WorkflowApprovalView';
import { ReportsAuditView } from './components/views/ReportsAuditView';
import { DeletionAuditLogsView } from './components/views/DeletionAuditLogsView';
import { AuditEngineView } from './components/views/audit/AuditEngineView';
import { SecurityAdminView } from './components/views/SecurityAdminView';
import { GeminiAiAssistantView } from './components/views/GeminiAiAssistantView';

import { AdminUsersView } from './components/admin_setups/AdminUsersView';
import { AdminRolesPermissionsView } from './components/admin_setups/AdminRolesPermissionsView';
import { AdminWorkflowView } from './components/admin_setups/AdminWorkflowView';
import { AdminAuditLogsView } from './components/admin_setups/AdminAuditLogsView';
import { AdminDatabaseView } from './components/admin_setups/AdminDatabaseView';
import { AdminImportExportView } from './components/admin_setups/AdminImportExportView';
import { AdminSecurityView } from './components/admin_setups/AdminSecurityView';
import { AdminSchedulerView } from './components/admin_setups/AdminSchedulerView';
import { AdminLicenseMonitoringView } from './components/admin_setups/AdminLicenseMonitoringView';

import { SetupOrganizationView } from './components/admin_setups/SetupOrganizationView';
import { SetupShareSettingsView } from './components/admin_setups/SetupShareSettingsView';
import { SetupSavingsSettingsView } from './components/admin_setups/SetupSavingsSettingsView';
import { SetupShareCertificateFormatView } from './components/admin_setups/SetupShareCertificateFormatView';
import { SetupMemberSettingsView } from './components/admin_setups/SetupMemberSettingsView';
import { GroupsView } from './components/admin_setups/GroupsView';
import { SetupDepositLoanView } from './components/admin_setups/SetupDepositLoanView';
import { SetupLoanSettingsView } from './components/admin_setups/SetupLoanSettingsView';
import { SetupAccountingSettingsView } from './components/admin_setups/SetupAccountingSettingsView';
import { SetupHrBillingView } from './components/admin_setups/SetupHrBillingView';
import { SetupInventoryAssetView } from './components/admin_setups/SetupInventoryAssetView';
import { SetupNotificationReportView } from './components/admin_setups/SetupNotificationReportView';
import { TemplateStudioView } from './components/views/templateStudio/TemplateStudioView';
import { SetupSystemView } from './components/admin_setups/SetupSystemView';
import { SetupWorkingDaysView } from './components/admin_setups/SetupWorkingDaysView';

const WorkspaceTabSkeleton: React.FC = () => (
  <div className="p-3 space-y-4 max-w-[1800px] mx-auto animate-pulse">
    {/* Top Summary Cards Skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-slate-100/80 h-20 rounded-xl border border-slate-200/60 p-3 space-y-2">
          <div className="h-3 bg-slate-200/80 rounded-md w-1/2"></div>
          <div className="h-5 bg-slate-200/80 rounded-md w-3/4"></div>
        </div>
      ))}
    </div>

    {/* Main Table/Panel Skeleton */}
    <div className="bg-slate-100/70 h-72 rounded-2xl border border-slate-200/60 p-4 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
        <div className="h-4 bg-slate-200/80 rounded-md w-1/3"></div>
        <div className="flex gap-2">
          <div className="h-7 bg-slate-200/80 rounded-lg w-20"></div>
          <div className="h-7 bg-slate-200/80 rounded-lg w-20"></div>
        </div>
      </div>
      <div className="space-y-2.5 pt-1">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-7 bg-slate-200/70 rounded-lg w-full"></div>
        ))}
      </div>
    </div>
  </div>
);

const MainAppContent: React.FC = () => {
  const { activeTabId, tabs, vouchers, chartOfAccounts, activeBranch, openTab, closeTab } = useCoop();
  const { t, formatCurrency } = useLocalization();
  const { user } = useAuthStore();
  const [isTabLoading, setIsTabLoading] = React.useState(false);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const moduleKey = activeTab ? activeTab.moduleKey : 'home_dashboard';

  React.useEffect(() => {
    setIsTabLoading(true);
    const timer = setTimeout(() => {
      setIsTabLoading(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [activeTabId, moduleKey]);

  // Live financial snapshot for the footer status bar
  const footerFinance = React.useMemo(() => {
    const posted = (vouchers || []).filter(v => v.status !== 'Cancelled');
    const lastVoucher = posted[0] || null;

    let totalDebit = 0;
    let totalCredit = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    (chartOfAccounts || []).forEach(c => {
      const t = (c.type || '').toLowerCase();
      const bal = c.balance || 0;
      if (t === 'asset' || t === 'expense') totalDebit += bal;
      if (t === 'liability' || t === 'equity' || t === 'income') totalCredit += bal;
      if (t === 'income') totalIncome += bal;
      if (t === 'expense') totalExpense += bal;
    });

    return {
      lastVoucherNo: lastVoucher?.voucherNo || '—',
      totalDebit,
      totalCredit,
      tbDifference: totalDebit - totalCredit,
      netProfit: totalIncome - totalExpense,
    };
  }, [vouchers, chartOfAccounts]);

  const cashInHand = activeBranch?.currentVaultCash ?? 0;

  const renderActiveView = () => {
    switch (moduleKey) {
      case 'home_dashboard':
        return <HomeDashboardView />;
      case 'ai_copilot':
      case 'ai_chat':
        return <GeminiAiAssistantView />;
      case 'member_directory':
      case 'member_new_wizard':
      case 'member_kyc_queue':
      case 'members':
        return <MembersView activeSubKey={moduleKey} />;
      case 'savings_deposit':
        return <TellerDepositEntryView />;
      case 'savings_withdraw':
        return <TellerWithdrawalEntryView />;
      case 'savings_products':
        return <SavingsAccountRegisterView />;
      case 'savings_open_account':
        return <OpenAccountView />;
      case 'savings_cheque_management':
        return <ChequeBookManageView />;
      case 'savings_ledger':
        return <AccountLedgerView />;
      case 'savings_passbook':
        return <PassbookPrinterView />;
      case 'savings_interest':
      case 'savings_accounts':
        return <SavingsView activeSubKey={moduleKey} />;
      case 'savings_stmt':
        return <AccountStatementsView />;
      case 'loan_repayment':
        return <EmiRepaymentDeskView />;
      case 'loan_appraisal':
        return <CreditAppraisalWizardView />;
      case 'loan_portfolio':
        return <ActiveLoanPortfolioView />;
      case 'loan_npl':
        return <NplProvisioningMatrixView />;
      case 'loan_amortization':
        return <EmiAmortizationSimulatorView />;
      case 'loans':
        return <LoansView activeSubKey={moduleKey} />;
      case 'loan_writeoff':
        return <WorkflowApprovalView />;
      case 'loan_insurance':
        return <LoanInsuranceView />;
      case 'loan_detail':
        return <LoanDetailView loanId={activeTab?.recordId || ''} onBack={() => closeTab(activeTab?.id || '')} />;
      case 'legal_studio':
        return <LegalDocumentStudioView />;
      case 'shares_accounts':
      case 'shares_issue':
      case 'shares_ledger':
      case 'shares_dividend':
      case 'shares_transfers':
      case 'shares_certs':
      case 'shares':
        return <SharesView activeSubKey={moduleKey} />;
      case 'accounts_vouchers':
        return <VoucherRegisterPage />;
      case 'accounts_gl':
        return <ManualJournalPage />;
      case 'accounts_transactions':
        return <TransactionsPage />;
      case 'accounts_ledger':
        return <LedgerSheetsPage />;
      case 'accounts_subsidiary':
        return <SubsidiaryBooksPage />;
      case 'accounts_cashflow':
        return <CashFlowPage />;
      case 'accounts_trial':
        return <TrialBalancePage />;
      case 'accounts_income_stmt':
      case 'profit_loss':
        return <ProfitLossPage />;
      case 'accounts_balance_sheet':
        return <BalanceSheetPage />;
      case 'accounts_financial_ratios':
        return <FinancialRatiosPage />;
      case 'cash_vault':
      case 'cash_denom':
        return <CashBankView />;
      case 'cash_bank':
        return <BankCashDepositWithdrawalView />;
      case 'bank_cheques':
        return <BankChequeManagementView />;
      case 'bank_cheque_book_detail':
        return <BankChequeBookDetailView bookId={activeTab?.recordId || ''} bankAccountId={activeTab?.data?.bankAccountId || ''} onBack={() => closeTab(activeTab?.id || '')} />;
      case 'cash_counters':
        return <CashCountersBankAccountsView />;
      case 'cash_reconcile':
        return <CashReconciliationView activeSubKey={moduleKey} />;
      case 'cash_variance':
        return <CashVarianceView activeSubKey={moduleKey} />;
      case 'collection_agents':
      case 'collection_sheet':
      case 'collection_reconciliation':
      case 'collection':
        return <CollectionMgmtView />;
      case 'budget_variance':
      case 'budget_claims':
        return <BudgetExpenseView />;
      case 'fixed_assets_register':
      case 'fixed_assets_depreciation':
        return <FixedAssetsTaxView />;
      case 'hr_staff':
      case 'hr_staff_form':
        return <StaffDirectoryView activeSubKey={moduleKey} />;
      case 'hr_payroll':
      case 'hr_departments':
      case 'hr_attendance':
      case 'hr_leave':
      case 'hr_performance':
        return <HrPayrollView />;
      case 'inventory_items':
      case 'inventory_sales':
        return <InventoryView />;
      case 'workflow_inbox':
      case 'workflow_approvals':
        return <WorkflowApprovalView />;
      case 'reports_pearls':
      case 'reports_agm':
      case 'reports_audit_log':
        return <ReportsAuditView />;
      case 'reports_doc_annual':
        return <DocAnnualReturnPage />;
      case 'reports_doc_statistical':
        return <DocStatisticalReturnPage />;
      case 'reports_ird_tax':
        return <IrdTaxReturnPage />;
      case 'reports_tds':
        return <TdsDeductionPage />;
      case 'reports_agm_pack':
        return <AgmPackPage />;
      case 'reports_agm_minutes':
        return <AgmMinutesPage />;
      case 'reports_board_meeting':
        return <BoardMeetingPage />;
      case 'reports_agm_attendance':
        return <AgmAttendancePage />;
      // MEMBER & TRANSACTION REPORTS
      case 'reports_member_list':
        return <MemberListReport />;
      case 'reports_top_ten_members':
        return <TopTenMembersReport />;
      case 'reports_dormant_accounts':
        return <DormantInactiveReport />;
      case 'reports_overdue_loans':
        return <OverdueNpaLoanReport />;
      // SAVING ACCOUNTS REPORTS
      case 'saving_accounts_summary':
        return <SavingAccountsSummary />;
      case 'saving_accounts_register':
        return <SavingAccountsRegister />;
      case 'saving_accounts_deposit':
        return <SavingAccountsDeposit />;
      case 'saving_accounts_withdrawal':
        return <SavingAccountsWithdrawal />;
      case 'saving_accounts_interest':
        return <SavingAccountsInterest />;
      case 'saving_accounts_dividend':
        return <DividendDistributionReport />;
      case 'saving_accounts_ledger':
        return <SavingAccountsLedger />;
      case 'saving_accounts_statement':
        return <SavingAccountsStatement />;
      // SHARE REPORTS
      case 'share_register':
        return <ShareRegisterReport />;
      case 'share_issue':
        return <ShareIssueReport />;
      case 'share_return':
        return <ShareReturnReport />;
      case 'share_transfer':
        return <ShareTransferReport />;
      case 'share_ledger':
        return <ShareLedgerReport />;
      case 'share_dividend':
        return <ShareDividendReport />;
      case 'agm_manage':
        return <AgmManagementView />;
      case 'reports_deletion_log':
        return <DeletionAuditLogsView />;
      // REPORTS > FINANCIAL STATEMENTS (mirror Accounting module)
      case 'reports_balance_sheet':
        return <BalanceSheetPage />;
      case 'reports_income_statement':
        return <ProfitLossPage />;
      case 'reports_trial_balance':
        return <TrialBalancePage />;
      case 'reports_cash_flow':
        return <CashFlowPage />;
      case 'reports_ledger':
        return <LedgerSheetsPage />;
      case 'reports_ratio_analysis':
        return <FinancialRatiosPage />;
      case 'reports_audit_engine':
        return <AuditEngineView />;
      // ADMIN MENUS
      case 'admin_users':
      case 'admin_user_groups':
      case 'admin_login_history':
      case 'admin_password_reset':
      case 'admin_user_sessions':
        return <AdminUsersView activeSubKey={moduleKey} />;

      case 'admin_roles':
      case 'admin_permissions':
      case 'admin_menu_permissions':
      case 'admin_data_permissions':
      case 'admin_action_permissions':
        return <AdminRolesPermissionsView activeSubKey={moduleKey} />;

      case 'admin_approval_levels':
      case 'admin_approval_matrix':
      case 'admin_pending_approvals':
      case 'admin_approval_history':
        return <AdminWorkflowView activeSubKey={moduleKey} />;

      case 'admin_audit_trail':
      case 'admin_activity_log':
      case 'admin_transaction_logs':
      case 'admin_error_logs':
      case 'admin_security_logs':
        return <AdminAuditLogsView activeSubKey={moduleKey} />;

      case 'admin_db_backup':
      case 'admin_db_restore':
      case 'admin_db_maintenance':
      case 'admin_db_archive':
        return <AdminDatabaseView activeSubKey={moduleKey} />;

      case 'admin_import_members':
      case 'admin_import_accounts':
      case 'admin_import_ob':
      case 'admin_export_data':
        return <AdminImportExportView activeSubKey={moduleKey} />;

      case 'admin_password_policy':
      case 'admin_2fa':
      case 'admin_session_mgmt':
      case 'admin_device_mgmt':
      case 'admin_ip_whitelist':
        return <AdminSecurityView activeSubKey={moduleKey} />;

      case 'admin_sched_interest':
      case 'admin_sched_dividend':
      case 'admin_sched_emi':
      case 'admin_scheduled_jobs':
        return <AdminSchedulerView activeSubKey={moduleKey} />;

      case 'admin_license_info':
      case 'admin_prod_activation':
      case 'admin_version_info':
      case 'admin_updates':
      case 'admin_cache_mgmt':
      case 'admin_system_health':
      case 'admin_running_jobs':
        return <AdminLicenseMonitoringView activeSubKey={moduleKey} />;

      // SETUPS MENUS
      case 'setup_working_days':
        return <SetupWorkingDaysView activeSubKey={moduleKey} />;

      case 'setup_coop_profile':
      case 'setup_branches':
      case 'setup_fiscal_years':
      case 'setup_working_date':
      case 'setup_currency':
      case 'setup_language':
      case 'setup_timezone':
        return <SetupOrganizationView activeSubKey={moduleKey} />;

      // DEPARTMENT PROFILE (opened from department cards with recordId)
      case 'setup_department_profile':
        return <DepartmentProfileView departmentId={activeTab?.recordId} activeSubKey={moduleKey} />;

      case 'setup_member_types':
        return <SetupMemberSettingsView entityType="member-types" />;
      case 'setup_member_categories':
        return <SetupMemberSettingsView entityType="member-categories" />;
      case 'setup_occupations':
        return <SetupMemberSettingsView entityType="occupations" />;
      case 'setup_education':
        return <SetupMemberSettingsView entityType="education-levels" />;
      case 'setup_nominee_types':
        return <SetupMemberSettingsView entityType="nominee-types" />;
      case 'setup_relationships':
        return <SetupMemberSettingsView entityType="relationship-types" />;
      case 'setup_member_status':
        return <SetupMemberSettingsView entityType="member-statuses" />;
      case 'setup_groups':
        return <GroupsView />;
      case 'setup_share_types':
        return <SetupShareSettingsView entityType="share-types" />;
      case 'setup_share_classes':
        return <SetupShareSettingsView entityType="share-classes" />;
      case 'setup_share_value':
        return <SetupShareSettingsView entityType="share-schemes" />;
      case 'setup_dividend_settings':
        return <SetupShareSettingsView entityType="dividend-rules" />;
      case 'setup_share_cert_format':
        return <SetupShareCertificateFormatView />;
      case 'setup_org_share_settings':
        return <SetupShareSettingsView entityType="org-settings" />;

      case 'setup_savings_products':
      case 'setup_savings_schemes':
      case 'setup_savings_interest':
      case 'setup_savings_charges':
      case 'setup_savings_rules':
      case 'setup_savings_cheque':
      case 'setup_savings_cheque_books':
      case 'setup_savings_defaults':
        return <SetupSavingsSettingsView entityType="savings-products" activeSubKey={moduleKey} />;

      case 'setup_deposit_products':
      case 'setup_deposit_types':
      case 'setup_interest_rates':
      case 'setup_deposit_charges':
      case 'setup_penalty_rules':
      case 'setup_maturity_rules':
      case 'setup_loan_products':
      case 'setup_loan_categories':
      case 'setup_repay_freq':
      case 'setup_security_types':
      case 'setup_guarantor_types':
        return <SetupLoanSettingsView activeSubKey={moduleKey} />;

      case 'setup_accounting_dashboard':
      case 'setup_system_mappings':
      case 'setup_coa':
      case 'setup_account_groups':
      case 'setup_voucher_types':
      case 'setup_cost_centers':
      case 'setup_journal_templates':
      case 'setup_fin_periods':
      case 'setup_bank_list':
      case 'setup_bank_accounts':
      case 'setup_cash_counters':
      case 'setup_payment_methods':
        return <SetupAccountingSettingsView activeSubKey={moduleKey} />;

      case 'setup_departments':
      case 'setup_hr_designations':
      case 'setup_emp_types':
      case 'setup_salary_heads':
      case 'setup_allowances':
      case 'setup_deductions':
      case 'setup_leave_types':
      case 'setup_service_charges':
      case 'setup_fee_types':
      case 'setup_discounts':
      case 'setup_taxes':
        return <SetupHrBillingView activeSubKey={moduleKey} />;

      case 'setup_product_categories':
      case 'setup_units':
      case 'setup_warehouses':
      case 'setup_suppliers':
      case 'setup_asset_categories':
      case 'setup_depr_methods':
      case 'setup_asset_locations':
        return <SetupInventoryAssetView activeSubKey={moduleKey} />;

      case 'setup_sms_gateway':
      case 'setup_email_server':
      case 'setup_notif_templates':
      case 'setup_reminder_rules':
      case 'setup_doc_types':
      case 'setup_kyc_types':
      case 'setup_upload_cats':
        return <SetupNotificationReportView activeSubKey={moduleKey} />;

      case 'setup_report_templates':
      case 'setup_receipt_templates':
      case 'setup_voucher_templates':
      case 'setup_cert_templates':
        return <TemplateStudioView activeSubKey={moduleKey} />;

      case 'setup_number_series':
      case 'setup_auto_numbering':
      case 'setup_payment_gateway':
      case 'setup_api_settings':
      case 'setup_backup_loc':
      case 'setup_sys_params':
        return <SetupSystemView activeSubKey={moduleKey} />;

      // SUPER ADMIN pages are not part of the organization dashboard.
      // They are only reachable via the dedicated /super-admin portal.

      default:
        if (moduleKey.startsWith('admin_')) {
          return <AdminUsersView activeSubKey={moduleKey} />;
        }
        if (moduleKey.startsWith('setup_')) {
          return <SetupOrganizationView activeSubKey={moduleKey} />;
        }
        if (moduleKey.startsWith('billing_')) {
          return <BudgetExpenseView />;
        }
        if (moduleKey.startsWith('notifications_')) {
          return <WorkflowApprovalView />;
        }
        if (moduleKey.startsWith('documents_') || moduleKey.startsWith('help_')) {
          return <ReportsAuditView />;
        }
        return <HomeDashboardView />;
    }
  };

  return (
    <div className="h-screen bg-white text-slate-800 font-sans flex flex-col selection:bg-emerald-600 selection:text-white overflow-hidden">
      
      {/* Sticky Top Navigation Header Bar */}
      <header className="sticky top-0 z-50 bg-white shadow-xs border-b border-slate-200">
        <TopHeader />
        <MegaMenu />
        <TabBar />
        {/* Subtle Top Loading Progress Bar */}
        <div className="h-0.5 w-full bg-slate-100 overflow-hidden relative">
          {isTabLoading && (
            <div className="absolute inset-y-0 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 animate-top-progress h-full w-full rounded-full" />
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-1 sm:p-2 max-w-[1920px] w-full mx-auto relative">
        <ErrorBoundary>
          {isTabLoading ? <WorkspaceTabSkeleton /> : renderActiveView()}
        </ErrorBoundary>
      </main>

      {/* Floating Contextual Action Button (FAB) */}
      <ContextualActionButton variant="fab" />

      {/* Global Modals & Shortcut Listener */}
      <GlobalShortcutManager />
      <GlobalSearchModal />
      <KeyboardShortcutsModal />
      <MemberDetailModal />
      <VoucherDetailModal />
      <UnsavedChangesModal />
      <PassbookPrintModal />
      <BranchFormModal />
      <StaffFormModal />
      <AddFiscalYearModal />

      {/* Footer Status Bar */}
      <footer className="shrink-0 bg-white border-t border-slate-200 px-4 sm:px-6 py-1.5 flex flex-col md:flex-row items-center justify-between gap-1.5 text-[11px] text-slate-600 font-medium backdrop-blur-md shadow-sm">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>{user?.organizationName || t('Sahakari Sathi')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-500">{t('Last Txn:')}</span>
            <span className="font-mono font-bold text-slate-900">{footerFinance.lastVoucherNo}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-500">{t('Cash in Hand:')}</span>
            <span className="font-mono font-bold text-emerald-700">{formatCurrency(cashInHand)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-500">{t('Trial Balance:')}</span>
            <span className="font-mono font-bold text-slate-900">{t('Dr')} {formatCurrency(footerFinance.totalDebit)}</span>
            <span className="text-slate-500">/ {t('Cr')} {formatCurrency(footerFinance.totalCredit)}</span>
            <span className={footerFinance.tbDifference === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
              {footerFinance.tbDifference === 0 ? t('Balanced') : `${t('Diff')} ${formatCurrency(Math.abs(footerFinance.tbDifference))}`}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-slate-500">{t('P&L:')}</span>
            <span className={`font-mono font-bold ${footerFinance.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {footerFinance.netProfit >= 0 ? t('Profit') : t('Loss')} {formatCurrency(Math.abs(footerFinance.netProfit))}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => openTab('help_manual', 'User Manual & Knowledge Base', 'BookOpen')}
            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
          >
            {t('User Manual')}
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => openTab('admin_audit_trail', 'Audit Logs', 'FileText')}
            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer hover:underline"
          >
            {t('Audit Logs')}
          </button>
        </div>
      </footer>

    </div>
  );
};

interface TenantWorkspaceGateProps {
  bootstrapStage: 'idle' | 'initializing';
  sessionValidated: boolean;
  mustChangePassword: boolean;
  mustCompleteSecuritySetup: boolean;
  user: AuthUser;
  onBootstrapReady: () => void;
  onForcePasswordChangeSuccess: (freshSession?: { accessToken?: string; user?: any }) => void;
  onSecuritySetupComplete: (payload: { mobileNumber: string; answers: { questionId: string; answer: string }[] }) => Promise<void>;
  /** Called when the org's idle-timeout policy elapses. */
  onIdleTimeout: () => void;
}

/**
 * Renders the authenticated tenant UI. The CoopProvider stays mounted across
 * every sub-phase so the workspace bootstrap runs exactly once (no duplicate
 * master-data fetches): it only swaps the *child* between the post-login boot
 * screen and the actual workspace while the background initialization finishes.
 */
const TenantWorkspaceGate: React.FC<TenantWorkspaceGateProps> = ({
  bootstrapStage,
  sessionValidated,
  mustChangePassword,
  mustCompleteSecuritySetup,
  user,
  onBootstrapReady,
  onForcePasswordChangeSuccess,
  onSecuritySetupComplete,
  onIdleTimeout,
}) => {
  const { bootstrapReady } = useCoop();

  // Enforces the org's `sessionTimeoutMinutes` policy. Fetched here rather than
  // from the admin settings endpoint because that one is org_admin/manager only,
  // while the idle timeout applies to every role.
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = React.useState(0);
  React.useEffect(() => {
    if (!sessionValidated) return;
    let cancelled = false;
    void fetchSessionPolicy().then(({ sessionTimeoutMinutes }) => {
      if (!cancelled) setIdleTimeoutMinutes(sessionTimeoutMinutes);
    });
    return () => { cancelled = true; };
  }, [sessionValidated]);

  useIdleTimeout(idleTimeoutMinutes, onIdleTimeout, sessionValidated);

  // STATE 2 — post-login workspace preparation. Authentication has already
  // succeeded; this screen shows the background setup progress instead of the
  // login form / a generic spinner, so the user knows they signed in.
  if (bootstrapStage === 'initializing' && !bootstrapReady) {
    return <AppBootstrapScreen sessionValidated={sessionValidated} onReady={onBootstrapReady} />;
  }

  // Persisted-session refreshes (bootstrapStage === 'idle') run a quick
  // server-side JWT check but do not gate the workspace behind master data.
  if (!sessionValidated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#006130] animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Verifying your session…</p>
        </div>
      </div>
    );
  }

  // 1. Force Password Change Flow — triggered when backend says must change password
  if (mustChangePassword) {
    return (
      <ForcePasswordChangeView
        username={user.username}
        onSuccess={onForcePasswordChangeSuccess}
      />
    );
  }

  // 2. Security Setup Wizard Flow — driven entirely by the backend flag.
  if (mustCompleteSecuritySetup) {
    return <SecuritySetupWizardView onComplete={onSecuritySetupComplete} />;
  }

  return (
    <FiscalYearFirstRunGate>
      <MainAppContent />
    </FiscalYearFirstRunGate>
  );
};

export default function App() {
  const { isAuthenticated, isSessionExpired, setSession, clearSession, token, user, updateUserFlags } = useAuthStore();
  const superAdminAuth = useSuperAdminAuth();
  const { isAuthenticated: isSuperAdmin, accessToken: superAdminToken, logout: logoutSuperAdmin } = superAdminAuth;
  const [loginError, setLoginError] = React.useState('');
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  // Distinguishes the authentication phase (STATE 1, handled by LoginPage) from
  // the post-login workspace initialization (STATE 2, AppBootstrapScreen).
  const [bootstrapStage, setBootstrapStage] = React.useState<'idle' | 'initializing'>('idle');

  // Initialize the super admin API client with store accessors for auto-refresh
  React.useEffect(() => {
    initSuperAdminApi(
      () => useSuperAdminAuth.getState().accessToken,
      (accessToken, refreshToken) => useSuperAdminAuth.getState().refreshAccessToken(accessToken, refreshToken),
      () => useSuperAdminAuth.getState().logout(),
    );
  }, []);

  const isSuperAdminPath = window.location.pathname.startsWith('/super-admin');
  const superAdminSessionValid = isSuperAdmin && !isSuperAdminTokenExpired(superAdminToken);

  // Auto-logout super admin if the persisted access token has expired
  React.useEffect(() => {
    if (isSuperAdminPath && isSuperAdmin && !superAdminSessionValid) {
      logoutSuperAdmin();
    }
  }, [isSuperAdminPath, isSuperAdmin, superAdminToken, superAdminSessionValid, logoutSuperAdmin]);

  // Auto-logout if session expired (only relevant for tenant portal)
  React.useEffect(() => {
    if (!isSuperAdminPath && isAuthenticated && isSessionExpired()) {
      clearSession();
    }
  }, [isSuperAdminPath, isAuthenticated, isSessionExpired, clearSession]);

  // Server-side session validation on mount: the persisted JWT can be revoked
  // server-side (e.g. Supabase GoTrue invalidates sessions when a password changes),
  // leaving localStorage with a token that 401s on every call. Validate once
  // against /auth/me and clear the session so the user is routed back to login.
  // Includes a single retry on 401 to absorb transient network/Supabase blips.
  const [sessionValidated, setSessionValidated] = React.useState(false);
  React.useEffect(() => {
    if (isSuperAdminPath || !isAuthenticated || sessionValidated) return;
    if (!token) {
      clearSession();
      return;
    }

    let cancelled = false;

    const validate = (attempt: number) => {
      apiClient
        .get('/auth/me')
        .then(() => {
          if (!cancelled) setSessionValidated(true);
        })
        .catch((err) => {
          if (cancelled) return;
          const status = err?.response?.status;
          const store = useAuthStore.getState();
          console.warn(`[auth/me] attempt=${attempt + 1} status=${status}`,
            'tokenLen=', store.token?.length ?? 0,
            'expiresAt=', store.expiresAt,
            'expiresAtType=', typeof store.expiresAt,
            'now=', new Date().toISOString());

          if (status === 401 && attempt === 0) {
            // Retry once: Supabase Gateway may have briefly lost its signing key,
            // or a cold start caused a transient auth failure.
            setTimeout(() => { if (!cancelled) validate(1); }, 800);
          } else if (status === 401) {
            clearSession();
          } else {
            // Network/5xx — trust the persisted session.
            setSessionValidated(true);
          }
        });
    };

    validate(0);
    return () => { cancelled = true; };
  }, [isSuperAdminPath, isAuthenticated, sessionValidated, token, clearSession]);

  // Inject JWT into Axios for all API calls
  React.useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [token]);

  /**
   * Signs the user out when the org's idle timeout elapses. Uses the same
   * clearSession path as an expired JWT, so the user lands on the login screen
   * rather than in a half-authenticated state.
   */
  const handleIdleTimeout = React.useCallback(() => {
    clearSession();
  }, [clearSession]);

  // ─── Super Admin Portal (path-based isolation) ───────────────────
  if (isSuperAdminPath) {
    // If already logged in and on /super-admin/login, redirect to /super-admin
    if (superAdminSessionValid && window.location.pathname === '/super-admin/login') {
      window.location.replace('/super-admin');
      return null;
    }
    if (!superAdminSessionValid) {
      return (
        <ErrorBoundary>
          <SuperAdminLoginPage />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <ToastProvider>
          <CoopProvider dataEnabled={false}>
            <SuperAdminWorkspace />
          </CoopProvider>
        </ToastProvider>
      </ErrorBoundary>
    );
  }
  // ─────────────────────────────────────────────────────────────────

  const handleLogin = async ({ organizationCode, username, password }: { organizationCode: string; username: string; password: string }) => {
    setIsLoggingIn(true);
    setLoginError('');
    try {
      // 1. Backend verifies org+user+password via Supabase Auth
      //    and returns Supabase access/refresh tokens if valid.
      const response = await apiClient.post('/auth/login', { organizationCode, username, password });
      const { accessToken, user, mustChangePassword, mustCompleteSecuritySetup } = response.data;

      // Merge the security flow flags returned by the backend into the stored user
      // so navigation decisions always come from the server, never hardcoded.
      const userWithFlags = {
        ...user,
        mustChangePassword: mustChangePassword ?? user?.mustChangePassword ?? false,
        mustCompleteSecuritySetup: mustCompleteSecuritySetup ?? user?.mustCompleteSecuritySetup ?? (user?.securityScore === 0),
      };

      // 2. Attach the Supabase Access Token to all future API requests
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // 3. Store session in Zustand
      setSession(accessToken, userWithFlags, new Date(Date.now() + 55 * 60 * 1000));

      // Authentication is complete here. Flip to the workspace-preparation
      // phase so the UI shows a distinct "setting up" state (STATE 2) rather
      // than keeping the login form's loading indicator.
      setBootstrapStage('initializing');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Login failed. Please try again.';
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Show Login if not authenticated
  if (!isAuthenticated || isSessionExpired()) {
    return (
      <ErrorBoundary>
        <LoginPage
          onLogin={handleLogin}
          error={loginError}
          isLoading={isLoggingIn}
        />
      </ErrorBoundary>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticated tenant flow. The provider tree below stays mounted across
  // every sub-phase; only the inner gate swaps screens.
  const mustChangePassword = user?.mustChangePassword ?? user?.requiresPasswordChange ?? user?.isTemporaryPassword ?? false;
  const mustCompleteSecuritySetup = user?.mustCompleteSecuritySetup ?? (user?.securityScore === 0);

  const handleForcePasswordChangeSuccess = (freshSession?: { accessToken?: string; user?: any }) => {
    // GoTrue revokes the old session when the password changes, so the
    // backend re-issues a fresh session here; swap it in to stay signed in.
    if (freshSession?.accessToken && freshSession.user) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${freshSession.accessToken}`;
      setSession(
        freshSession.accessToken,
        {
          ...freshSession.user,
          mustChangePassword: false,
          mustCompleteSecuritySetup: freshSession.user.mustCompleteSecuritySetup ?? false,
        },
        new Date(Date.now() + 55 * 60 * 1000)
      );
    } else {
      updateUserFlags({ requiresPasswordChange: false, isTemporaryPassword: false, mustChangePassword: false });
    }
  };

  /**
   * Persists the security wizard. Deliberately re-throws: the wizard keeps the
   * user on the confirm step and shows the reason. It previously swallowed the
   * failure and unblocked the user anyway, claiming the flag would be "retried
   * on next login" — nothing retried it, so the answers were lost for good.
   */
  const handleSecuritySetupComplete = async (payload: {
    mobileNumber: string;
    answers: { questionId: string; answer: string }[];
  }) => {
    const res = await completeSecuritySetup(payload);
    const u = res.user;
    // Flags come from the row the server actually wrote — the score in
    // particular is earned per completed step, not assumed to be 100.
    updateUserFlags({
      securitySetupCompleted: true,
      mustCompleteSecuritySetup: false,
      securityScore: u?.securityScore ?? 100,
      mobileVerified: u?.mobileVerified ?? !!payload.mobileNumber,
      mobileNumber: u?.mobileNumber ?? payload.mobileNumber ?? null,
      securityQuestionsCompleted: res.securityQuestionsCompleted,
      firstLoginCompleted: true,
    });
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <CoopProvider>
          <LocalizationProvider>
            <TenantWorkspaceGate
              bootstrapStage={bootstrapStage}
              sessionValidated={sessionValidated}
              mustChangePassword={mustChangePassword}
              mustCompleteSecuritySetup={mustCompleteSecuritySetup}
              user={user}
              onBootstrapReady={() => setBootstrapStage('idle')}
              onForcePasswordChangeSuccess={handleForcePasswordChangeSuccess}
              onSecuritySetupComplete={handleSecuritySetupComplete}
              onIdleTimeout={handleIdleTimeout}
            />
          </LocalizationProvider>
        </CoopProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
