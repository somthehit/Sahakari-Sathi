import React, { useState, useEffect, useRef } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useLocalization } from '../../context/LocalizationContext';
import {
  Users,
  PiggyBank,
  Landmark,
  PieChart,
  BookOpen,
  Vault,
  Truck,
  Calculator,
  Building,
  UserCheck2,
  Inbox,
  FileSpreadsheet,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  FileCheck,
  CreditCard,
  History,
  TrendingUp,
  Receipt,
  Sparkles,
  Shield,
  Settings,
  Wrench,
  PackageCheck,
  Bell,
  Folder,
  HelpCircle,
  Database,
  Key,
  Share2,
  Calendar,
  Printer,
  Cpu,
  Lock,
  Upload,
  Sliders,
  Layers,
  ListTree,
  List,
  Globe,
  CreditCard as CreditCardIcon,
  BarChart2,
  Server,
  Mail,
  MessageSquare,
  Plug,
  Package,
  LifeBuoy,
  HardDrive,
  Rss,
  CalendarDays
} from 'lucide-react';

export interface SubSubMenuItem {
  key: string;
  title: string;
  icon?: string;
}

export interface SubMenuItem {
  category: string;
  subItems: SubSubMenuItem[];
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: any;
  categories: SubMenuItem[];
}

export const MegaMenu: React.FC = () => {
  const { openTab, menuViewMode, setMenuViewMode } = useCoop();
  const { t } = useLocalization();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  const navRef = useRef<HTMLDivElement>(null);
  const topNavRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringRef = useRef<boolean>(false);

  const clearCloseTimer = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const startCloseTimer = (delay = 250) => {
    clearCloseTimer();
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, delay);
  };

  // Helper to remove leading numbers like "1. ", "2. " from category strings
  const cleanTitle = (text: string): string => {
    if (!text) return '';
    return text.replace(/^\d+\.\s*/, '');
  };

  // Normalized flyout entries. Navigation UX rules:
  //  - Empty categories are dropped (never show an empty submenu).
  //  - A category with a single child is flattened into a direct page link.
  //  - Only categories with two or more children stay expandable.
  type MenuEntry =
    | { kind: 'page'; key: string; title: string; icon?: string }
    | { kind: 'category'; title: string; items: SubSubMenuItem[] };

  const buildEntries = (group: MenuGroup): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    for (const cat of group.categories || []) {
      const items = cat.subItems || [];
      if (items.length === 0) continue;
      if (items.length === 1) {
        entries.push({ kind: 'page', key: items[0].key, title: items[0].title, icon: items[0].icon });
      } else {
        entries.push({ kind: 'category', title: t(cleanTitle(cat.category)), items });
      }
    }
    return entries;
  };

  const firstCategoryIndex = (group: MenuGroup): number =>
    buildEntries(group).findIndex(e => e.kind === 'category');

  useEffect(() => {
    // Only close menu on scroll of the main page (window/document body),
    // NOT when scrolling inside the flyout or nav itself.
    const handleWindowScroll = () => {
      // If hovering the menu or flyout, never close
      if (isHoveringRef.current) return;
      setActiveMenu(null);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (e.target && e.target instanceof Node) {
        if (
          navRef.current &&
          !navRef.current.contains(e.target) &&
          flyoutRef.current &&
          !flyoutRef.current.contains(e.target)
        ) {
          setActiveMenu(null);
        }
      }
    };

    // Use bubble phase (no capture), and only on window — NOT document
    window.addEventListener('scroll', handleWindowScroll);
    window.addEventListener('resize', handleWindowScroll);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearCloseTimer();
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmenuClick = (moduleKey: string, title: string, iconName: string) => {
    clearCloseTimer();
    openTab(moduleKey, title, iconName);
    setActiveMenu(null);
  };

  const calculatePosition = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const panelWidth = menuViewMode === 'split' ? 520 : (menuViewMode === 'tree' ? 360 : 380);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - panelWidth - 12);
    setMenuPos({ top: rect.bottom + 2, left });
  };

  const handleMouseEnter = (group: MenuGroup, e: React.MouseEvent<HTMLDivElement>) => {
    clearCloseTimer();
    calculatePosition(e);
    setActiveMenu(group.id);
    const first = firstCategoryIndex(group);
    setActiveSubmenuIndex(first >= 0 ? first : null);
  };

  const handleButtonClick = (group: MenuGroup, e: React.MouseEvent<HTMLButtonElement>) => {
    clearCloseTimer();
    if (activeMenu === group.id) {
      setActiveMenu(null);
      return;
    }
    const target = e.currentTarget.parentElement || e.currentTarget;
    calculatePosition({ currentTarget: target } as any);
    setActiveMenu(group.id);
    const first = firstCategoryIndex(group);
    setActiveSubmenuIndex(first >= 0 ? first : null);
  };

  const toggleCategory = (catKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCats(prev => ({
      ...prev,
      [catKey]: !prev[catKey]
    }));
  };

  const expandAll = (e: React.MouseEvent, group: MenuGroup) => {
    e.stopPropagation();
    const nextState: Record<string, boolean> = { ...collapsedCats };
    buildEntries(group).forEach(entry => {
      if (entry.kind === 'category') nextState[`${group.id}::${entry.title}`] = false;
    });
    setCollapsedCats(nextState);
  };

  const collapseAll = (e: React.MouseEvent, group: MenuGroup) => {
    e.stopPropagation();
    const nextState: Record<string, boolean> = { ...collapsedCats };
    buildEntries(group).forEach(entry => {
      if (entry.kind === 'category') nextState[`${group.id}::${entry.title}`] = true;
    });
    setCollapsedCats(nextState);
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (topNavRef.current) {
      topNavRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth'
      });
    }
  };

  const handleWheelNav = (e: React.WheelEvent) => {
    if (topNavRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      topNavRef.current.scrollLeft += e.deltaY;
    }
  };

  const menuGroups: MenuGroup[] = [
    {
      id: 'admin',
      label: 'Admin',
      icon: Settings,
      categories: [
        {
          category: 'Roles',
          subItems: [
            { key: 'admin_roles', title: 'Roles' },
          ]
        },
        {
          category: 'Users',
          subItems: [
            { key: 'admin_users', title: 'Users' },
          ]
        },
        {
          category: 'Import',
          subItems: [
            { key: 'admin_import_members', title: 'Import Member from Excel' },
          ]
        },
        {
          category: 'Audit',
          subItems: [
            { key: 'admin_audit_trail', title: 'Audit Logs' },
          ]
        }
      ]
    },
    {
      id: 'setups',
      label: 'Setups',
      icon: Wrench,
      categories: [
        {
          category: 'Organization Settings',
          subItems: [
            { key: 'setup_coop_profile', title: 'Cooperative Profile' },
            { key: 'setup_branches', title: 'Branches' },
            { key: 'setup_fiscal_years', title: 'Fiscal Years' },
            { key: 'setup_working_date', title: 'Working Date' },
            { key: 'setup_working_days', title: 'Working Days & Hours' },
            { key: 'setup_currency', title: 'Currency' },
            { key: 'setup_language', title: 'Language & Localization' },
            { key: 'setup_timezone', title: 'Time Zone' },
          ]
        },
        {
          category: 'Workflow & Approvals',
          subItems: [
            { key: 'admin_approval_levels', title: 'Approval Levels' },
            { key: 'admin_approval_matrix', title: 'Approval Matrix' },
            { key: 'admin_pending_approvals', title: 'Pending Approvals' },
            { key: 'admin_approval_history', title: 'Approval History' },
          ]
        },
        {
          category: 'Member Settings',
          subItems: [
            { key: 'setup_member_types', title: 'Member Types' },
            { key: 'setup_member_categories', title: 'Member Categories' },
            { key: 'setup_education', title: 'Education' },
            { key: 'setup_occupations', title: 'Occupations' },
            { key: 'setup_nominee_types', title: 'Nominee Types' },
            { key: 'setup_relationships', title: 'Relationship Types' },
            { key: 'setup_groups', title: 'Groups' },
            { key: 'setup_member_status', title: 'Member Status' },
          ]
        },
        {
          category: 'Share Settings',
          subItems: [
            { key: 'setup_share_types', title: 'Share Types' },
            { key: 'setup_share_classes', title: 'Share Classes' },
            { key: 'setup_share_value', title: 'Share Value & Pricing' },
            { key: 'setup_dividend_settings', title: 'Dividend Rules' },
            { key: 'setup_share_cert_format', title: 'Share Certificate Format' },
            { key: 'setup_org_share_settings', title: 'Org Share Settings' },
          ]
        },
        {
          category: 'Savings A/C Settings',
          subItems: [
            { key: 'setup_savings_products', title: 'Saving Account Products' },
            { key: 'setup_savings_schemes', title: 'Saving Schemes' },
            { key: 'setup_savings_interest', title: 'Interest & Rate Rules' },
            { key: 'setup_savings_charges', title: 'Charges & Fees' },
            { key: 'setup_savings_rules', title: 'Account Rules' },
            { key: 'setup_savings_cheque', title: 'Cheque Settings' },
            { key: 'setup_savings_cheque_books', title: 'Cheque Book Settings' },
            { key: 'setup_savings_defaults', title: 'Account Product Defaults' },
          ]
        },
        {
          category: 'Loan Settings',
          subItems: [
            { key: 'setup_loan_products', title: 'Loan Products' },
            { key: 'setup_loan_categories', title: 'Loan Categories' },
            { key: 'setup_repay_freq', title: 'Repayment Frequencies' },
            { key: 'setup_security_types', title: 'Collateral / Security Types' },
            { key: 'setup_guarantor_types', title: 'Guarantor Types' },
          ]
        },
        {
          category: 'Accounting Settings',
          subItems: [
            { key: 'setup_accounting_dashboard', title: 'Dashboard' },
            { key: 'setup_coa', title: 'Chart of Accounts' },
            { key: 'setup_account_groups', title: 'Account Groups' },
            { key: 'setup_voucher_types', title: 'Voucher Types' },
            { key: 'setup_cost_centers', title: 'Cost Centers' },
            { key: 'setup_journal_templates', title: 'Journal Templates' },
            { key: 'setup_fin_periods', title: 'Financial Periods' },
            { key: 'setup_bank_list', title: 'Bank List' },
            { key: 'setup_bank_accounts', title: 'Bank Accounts' },
            { key: 'setup_cash_counters', title: 'Cash Counters' },
            { key: 'setup_payment_methods', title: 'Payment Methods' },
            { key: 'setup_system_mappings', title: 'System Account Mappings' },
          ]
        },
        {
          category: 'HR Settings',
          subItems: [
            { key: 'setup_departments', title: 'Departments' },
            { key: 'setup_hr_designations', title: 'Designations' },
            { key: 'setup_emp_types', title: 'Employment Types' },
            { key: 'setup_salary_heads', title: 'Salary Heads' },
            { key: 'setup_allowances', title: 'Allowances' },
            { key: 'setup_deductions', title: 'Deductions' },
            { key: 'setup_leave_types', title: 'Leave Types' },
          ]
        },
        {
          category: 'Billing Settings',
          subItems: [
            { key: 'setup_service_charges', title: 'Service Charges' },
            { key: 'setup_fee_types', title: 'Fee Types' },
            { key: 'setup_discounts', title: 'Discounts' },
            { key: 'setup_taxes', title: 'Taxes' },
          ]
        },
        {
          category: 'Inventory Settings',
          subItems: [
            { key: 'setup_product_categories', title: 'Categories' },
            { key: 'setup_units', title: 'Units' },
            { key: 'setup_warehouses', title: 'Warehouses' },
            { key: 'setup_suppliers', title: 'Suppliers' },
          ]
        },
        {
          category: 'Asset Settings',
          subItems: [
            { key: 'setup_asset_categories', title: 'Asset Categories' },
            { key: 'setup_depr_methods', title: 'Depreciation Methods' },
            { key: 'setup_asset_locations', title: 'Asset Locations' },
          ]
        },
        {
          category: 'Security Settings',
          subItems: [
            { key: 'admin_password_policy', title: 'Password Policy' },
            { key: 'admin_2fa', title: 'Two-Factor Authentication' },
            { key: 'admin_session_mgmt', title: 'Session Management' },
            { key: 'admin_device_mgmt', title: 'Device Policies' },
            { key: 'admin_ip_whitelist', title: 'Login Restrictions' },
          ]
        },
        {
          category: 'Scheduler & Jobs',
          subItems: [
            { key: 'admin_sched_interest', title: 'Interest Posting Jobs' },
            { key: 'admin_sched_dividend', title: 'Dividend Processing' },
            { key: 'admin_sched_emi', title: 'Loan Installment Generation' },
            { key: 'admin_scheduled_jobs', title: 'Scheduled Tasks' },
          ]
        },
        {
          category: 'Database Administration',
          subItems: [
            { key: 'admin_db_backup', title: 'Backup' },
            { key: 'admin_db_restore', title: 'Restore' },
            { key: 'admin_db_maintenance', title: 'Maintenance' },
            { key: 'admin_db_archive', title: 'Archive Data' },
          ]
        },
        {
          category: 'System Monitoring',
          subItems: [
            { key: 'admin_cache_mgmt', title: 'Cache Management' },
            { key: 'admin_system_health', title: 'System Health' },
            { key: 'admin_running_jobs', title: 'Running Jobs' },
          ]
        },
        {
          category: 'License & Updates',
          subItems: [
            { key: 'admin_license_info', title: 'Subscription & License' },
            { key: 'admin_prod_activation', title: 'Product Activation' },
            { key: 'admin_version_info', title: 'Version' },
            { key: 'admin_updates', title: 'Update History' },
          ]
        },
        {
          category: 'Other Imports & Data Export',
          subItems: [
            { key: 'admin_import_accounts', title: 'Import Accounts' },
            { key: 'admin_import_ob', title: 'Import Opening Balances' },
            { key: 'admin_export_data', title: 'Export System Data' },
          ]
        },
        {
          category: 'Notification Settings',
          subItems: [
            { key: 'setup_sms_gateway', title: 'SMS Gateway' },
            { key: 'setup_email_server', title: 'Email Server' },
            { key: 'setup_notif_templates', title: 'Notification Templates' },
            { key: 'setup_reminder_rules', title: 'Reminder Rules' },
          ]
        },
        {
          category: 'Report Settings',
          subItems: [
            { key: 'setup_report_templates', title: 'Report Templates' },
            { key: 'setup_receipt_templates', title: 'Receipt Templates' },
            { key: 'setup_voucher_templates', title: 'Voucher Templates' },
            { key: 'setup_cert_templates', title: 'Certificate Templates' },
          ]
        },
        {
          category: 'Document Settings',
          subItems: [
            { key: 'setup_doc_types', title: 'Document Types' },
            { key: 'setup_kyc_types', title: 'KYC Types' },
            { key: 'setup_upload_cats', title: 'Upload Categories' },
          ]
        },
        {
          category: 'System Settings',
          subItems: [
            { key: 'setup_number_series', title: 'Number Series' },
            { key: 'setup_auto_numbering', title: 'Auto Numbering' },
            { key: 'setup_payment_gateway', title: 'Payment Gateway' },
            { key: 'setup_api_settings', title: 'API Settings' },
            { key: 'setup_backup_loc', title: 'Backup Location' },
            { key: 'setup_sys_params', title: 'System Parameters' },
          ]
        }
      ]
    },
    {
      id: 'members',
      label: 'Members',
      icon: Users,
      categories: [
        {
          category: '1. Member Registration',
          subItems: [
            { key: 'member_directory', title: 'Members Directory' },
            { key: 'member_new_wizard', title: 'New Member Registration' },
            { key: 'member_kyc_queue', title: 'KYC Verification Queue' },
          ]
        },
        {
          category: '2. Member Management',
          subItems: [
            { key: 'member_nominees', title: 'Nominees & Guarantors' },
            { key: 'member_certs', title: 'Membership Certificates' },
            { key: 'member_termination', title: 'Membership Termination & Exit' },
          ]
        }
      ]
    },
    {
      id: 'shares',
      label: 'Shares',
      icon: PieChart,
      categories: [
        {
          category: '1. Share Capital & Issue',
          subItems: [
            { key: 'shares_accounts', title: 'Open Shares Account' },
            { key: 'shares_issue', title: 'Share Issue & Transfer' },
            { key: 'shares_ledger', title: 'Share Capital Ledger' },
            { key: 'shares_transfers', title: 'Share Transfer Registry' },
          ]
        },
        {
          category: '2. AGM & Certificates',
          subItems: [
            { key: 'shares_dividend', title: 'AGM Dividend Declaration & Payout' },
            { key: 'shares_certs', title: 'Share Certificates & Classes' },
          ]
        }
      ]
    },
    {
      id: 'savings',
      label: 'Savings & Deposits',
      icon: PiggyBank,
      categories: [
        {
          category: '1. Account Operations',
          subItems: [
            { key: 'savings_products', title: 'Savings Account Register' },
            { key: 'savings_open_account', title: 'Open Savings Account' },
            { key: 'savings_deposit', title: 'Teller Deposit Entry' },
            { key: 'savings_withdraw', title: 'Teller Withdrawal Entry' },
          ]
        },
        {
          category: '2. Services & Statements',
          subItems: [
            { key: 'savings_passbook', title: 'Passbook Printer' },
            { key: 'savings_cheque_management', title: 'Cheque Book Management' },
            { key: 'savings_interest', title: 'Quarterly Interest Posting Engine' },
            { key: 'savings_ledger', title: 'Account Ledger' },
            { key: 'savings_stmt', title: 'Account Statements' },
          ]
        }
      ]
    },
    {
      id: 'loans',
      label: 'Loans',
      icon: Landmark,
      categories: [
        {
          category: '1. Loan Origination',
          subItems: [
            { key: 'loan_appraisal', title: 'Credit Appraisal Wizard' },
            { key: 'loan_repayment', title: 'EMI Repayment Desk' },
            { key: 'loan_insurance', title: 'Credit Life Insurance Linkage' },
          ]
        },
        {
          category: '2. Portfolio & Risk',
          subItems: [
            { key: 'loan_portfolio', title: 'Active Loan Portfolio' },
            { key: 'loan_npl', title: 'NPL & Provisioning Matrix' },
            { key: 'loan_writeoff', title: 'Loan Loss Write-off Workflow' },
            { key: 'loan_amortization', title: 'EMI Amortization Simulator' },
          ]
        }
      ]
    },
    {
      id: 'cash_bank',
      label: 'Cash & Bank',
      icon: Vault,
      categories: [
        {
          category: '1. Vault & Cash',
          subItems: [
            { key: 'cash_vault', title: 'Daily Vault Cash Register' },
            { key: 'cash_denom', title: 'Teller Cash Reconciliation' },
          ]
        },
        {
          category: '2. Bank & Counters',
          subItems: [
            { key: 'cash_bank', title: 'Bank Cash Deposit & Withdrawal' },
            { key: 'bank_cheques', title: 'Bank Cheque Management' },
            { key: 'cash_counters', title: 'Cash Counters & Bank Accounts' },
          ]
        },
        {
          category: '3. Reconciliation',
          subItems: [
            { key: 'cash_reconcile', title: 'Daily Cash & Bank Reconciliation' },
            { key: 'cash_variance', title: 'Variance Analysis & Exception Handling' },
          ]
        }
      ]
    },
    {
      id: 'accounts',
      label: 'Accounting',
      icon: BookOpen,
      categories: [
        {
          category: '1. Vouchers & Ledgers',
          subItems: [
            { key: 'accounts_vouchers', title: 'Voucher Register' },
            { key: 'accounts_gl', title: 'New Journal Voucher' },
            { key: 'accounts_transactions', title: 'Transactions & Quick Links' },
            { key: 'accounts_ledger', title: '4 Ledger Sheets' },
            { key: 'accounts_subsidiary', title: 'Subsidiary Books (सहायक खाता)' },
          ]
        },
        {
          category: '2. Financial Statements',
          subItems: [
            { key: 'accounts_trial', title: 'Trial Balance' },
            { key: 'accounts_income_stmt', title: 'Profit & Loss (P&L)' },
            { key: 'accounts_balance_sheet', title: 'Balance Sheet' },
            { key: 'accounts_cashflow', title: 'Cash Flow Statement' },
            { key: 'accounts_financial_ratios', title: 'Financial Ratios (PEARLS)' },
          ]
        },
        {
          category: '3. Audit & Compliance',
          subItems: [
            { key: 'reports_audit_engine', title: 'Audit Engine (लेखापरीक्षण इन्जिन)' },
          ]
        }
      ]
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: PackageCheck,
      categories: [
        {
          category: '1. Item Master',
          subItems: [
            { key: 'inventory_items', title: 'Product Categories & Master List' },
            { key: 'inventory_sales', title: 'Stock Entry & Adjustment' },
          ]
        },
        {
          category: '2. Purchase & Warehouse',
          subItems: [
            { key: 'inventory_purchase', title: 'Purchase & Suppliers' },
            { key: 'inventory_warehouse', title: 'Warehouse Management' },
          ]
        }
      ]
    },
    {
      id: 'assets_tax',
      label: 'Assets',
      icon: Building,
      categories: [
        {
          category: '1. Fixed Assets',
          subItems: [
            { key: 'fixed_assets_register', title: 'Fixed Asset Register' },
            { key: 'fixed_assets_depreciation', title: 'Depreciation Engine Run (WDV)' },
          ]
        },
        {
          category: '2. Asset Locations & Tax',
          subItems: [
            { key: 'assets_locations', title: 'Asset Locations & Status' },
            { key: 'tax_filing', title: 'TDS / VAT & Tax Filing Summary' },
          ]
        }
      ]
    },
    {
      id: 'hr_payroll',
      label: 'HR & Payroll',
      icon: UserCheck2,
      categories: [
        {
          category: '1. Staff',
          subItems: [
            { key: 'hr_staff', title: 'Staff Directory' },
            { key: 'hr_staff_form', title: 'Add / Edit Staff' },
          ]
        },
        {
          category: '2. Attendance & Leave',
          subItems: [
            { key: 'hr_attendance', title: 'Attendance Register' },
            { key: 'hr_leave', title: 'Leave Management' },
          ]
        },
        {
          category: '3. Payroll & Performance',
          subItems: [
            { key: 'hr_payroll', title: 'Monthly Payroll Run & Payslips' },
            { key: 'hr_performance', title: 'Performance Appraisals' },
          ]
        }
      ]
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: Receipt,
      categories: [
        {
          category: '1. Fees & Fines',
          subItems: [
            { key: 'billing_fees', title: 'Fee & Service Charges Entry' },
            { key: 'billing_fines', title: 'Fine & Penalty Collection' },
          ]
        },
        {
          category: '2. Invoices & Tax',
          subItems: [
            { key: 'billing_discounts', title: 'Discount & Tax Management' },
            { key: 'billing_invoices', title: 'Receipt & Invoice Printing' },
          ]
        }
      ]
    },
    {
      id: 'agm_management',
      label: 'AGM Management',
      icon: CalendarDays,
      categories: [
        {
          category: 'साधारण सभा व्यवस्थापन',
          subItems: [
            { key: 'agm_manage', title: 'Meeting & Resolution Manager' },
          ]
        },
      ]
    },
    {
      id: 'reports_audit',
      label: 'Reports',
      icon: FileSpreadsheet,
      categories: [
        {
          category: '1. Regulatory Returns',
          subItems: [
            { key: 'reports_doc_annual', title: 'DoC Annual Return (वार्षिक कारोबार विवरण)' },
            { key: 'reports_doc_statistical', title: 'DoC Statistical Return (साधारण संख्या फा.)' },
            { key: 'reports_ird_tax', title: 'IRD Tax Return Summary (आयकर विवरण)' },
            { key: 'reports_tds', title: 'TDS Deduction Report (करकट्टी विवरण)' },
          ]
        },
        {
          category: '2. AGM & Governance',
          subItems: [
            { key: 'reports_agm_pack', title: 'AGM Presentation Report Pack (साधारण सभा प्रस्तुतीकरण)' },
            { key: 'reports_agm_minutes', title: 'AGM Resolution & Minutes Summary' },
            { key: 'reports_board_meeting', title: 'Board/Committee Meeting Reports (सञ्चालक समिति बैठक)' },
            { key: 'reports_agm_attendance', title: 'AGM Member Attendance & Quorum Report' },
          ]
        },
        {
          category: '3. Financial Statements',
          subItems: [
            { key: 'reports_balance_sheet', title: 'Balance Sheet (आर्थिक अवस्था विवरण)' },
            { key: 'reports_income_statement', title: 'Income & Expenditure Statement (नाफा नोक्सान विवरण)' },
            { key: 'reports_trial_balance', title: 'Trial Balance' },
            { key: 'reports_cash_flow', title: 'Cash Flow Statement' },
            { key: 'reports_ledger', title: 'General Ledger & Subsidiary Ledgers' },
            { key: 'reports_ratio_analysis', title: 'Financial Ratio Analysis (CAMEL/PEARLS)' },
          ]
        },
        {
          category: '4. Audit & Compliance',
          subItems: [
            { key: 'reports_audit_log', title: 'System Immutable Audit Trail' },
            { key: 'reports_deletion_log', title: 'Deletion Audit Logs (Hard Delete Trail)' },
            { key: 'reports_internal_audit', title: 'Internal Audit Report (आन्तरिक लेखापरीक्षण)' },
            { key: 'reports_external_audit', title: 'External/Statutory Auditor Report Pack' },
            { key: 'reports_reserve_fund', title: 'Reserve & Statutory Fund Utilization Report' },
            { key: 'reports_loan_classification', title: 'Loan Classification & Provisioning (कर्जा वर्गीकरण)' },
          ]
        },
        {
          category: '5. Member & Transaction Reports',
          subItems: [
            { key: 'reports_member_list', title: 'Member List (Group/Ethnicity/Age/Status)' },
            { key: 'reports_top_ten_members', title: 'Top Ten Members (Savers & Repayers)' },
            { key: 'reports_dormant_accounts', title: 'Dormant/Inactive Account Report' },
            { key: 'reports_overdue_loans', title: 'Overdue & NPA Loan Report' },
          ]
        },
        {
          category: '6. Shares Reports',
          subItems: [
            { key: 'share_register', title: 'Share Register' },
            { key: 'share_issue', title: 'Share Issue' },
            { key: 'share_return', title: 'Share Return'},
            { key: 'share_transfer', title: 'Share Transfer' },
            { key: 'share_ledger', title: 'Share Ledger' },
            { key: 'share_dividend', title: 'Share Dividend' },
          ]
        },
        {
          category: 'Saving Accounts Reports',
          subItems: [
            { key: 'saving_accounts_summary', title: 'Saving Accounts Summary' },
            { key: 'saving_accounts_register', title: 'Saving Accounts Register' },
            { key: 'saving_accounts_deposit', title: 'Saving Accounts Deposit' },
            { key: 'saving_accounts_withdrawal', title: 'Saving Accounts Withdrawal' },
            { key: 'saving_accounts_interest', title: 'Saving Accounts Interest' },
            { key: 'saving_accounts_dividend', title: 'Dividend Distribution Report (लाभांश विवरण)' },
            { key: 'saving_accounts_ledger', title: 'Saving Accounts Ledger' },
            { key: 'saving_accounts_statement', title: 'Saving Accounts Statement' },
          ]
        },
        {
          category: 'Loan Accounts Reports',
          subItems: [
            { key: 'loan_accounts_summary', title: 'Loan Accounts Summary' }, //Heath of Loans (bad, doubtful, loss, Due, Over Due)
            { key: 'loan_accounts_register', title: 'Loan Accounts Register' },
            { key: 'loan_accounts_deposit', title: 'Loan Accounts Deposit' },
            { key: 'loan_accounts_withdrawal', title: 'Loan Accounts Withdrawal' },
            { key: 'loan_accounts_ledger', title: 'Loan Accounts Ledger' },
            { key: 'loan_accounts_statement', title: 'Loan Accounts Statement' },
          ]
        },
        {
          category: '7. Custom & Export',
          subItems: [
            { key: 'reports_custom', title: 'Customized Financial Reports' },
            { key: 'reports_export', title: 'Export to Excel/PDF (Nepali Date Support)' },
          ]
        }
      ]
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      categories: [
        {
          category: '1. Messaging Services',
          subItems: [
            { key: 'notifications_sms', title: 'SMS Broadcast & Queue' },
            { key: 'notifications_email', title: 'Email Notifications' },
          ]
        },
        {
          category: '2. System Alerts',
          subItems: [
            { key: 'notifications_alerts', title: 'System Alert Logs' },
          ]
        }
      ]
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: Folder,
      categories: [
        {
          category: '1. Legal Document Studio',
          subItems: [
            { key: 'legal_studio', title: 'Legal Document Generator Studio' },
          ]
        },
        {
          category: '2. Member Repository',
          subItems: [
            { key: 'documents_kyc', title: 'Member KYC Document Repository' },
            { key: 'documents_vouchers', title: 'Voucher & Agreement Attachments' },
          ]
        },
        {
          category: '3. Document Templates',
          subItems: [
            { key: 'documents_templates', title: 'Certificate & Letter Templates' },
          ]
        }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      categories: [
        {
          category: '1. AI Copilot & Assistance',
          subItems: [
            { key: 'ai_copilot', title: 'Gemini AI Assistant & Copilot', icon: 'Bot' },
          ]
        },
        {
          category: '2. Knowledge Base',
          subItems: [
            { key: 'help_manual', title: 'User Manual & Knowledge Base' },
            { key: 'help_tickets', title: 'Member Service Tickets' },
          ]
        },
        {
          category: '3. System Diagnostics',
          subItems: [
            { key: 'help_diagnostics', title: 'System Health & Diagnostics' },
          ]
        }
      ]
    },
  ];

  return (
    <nav ref={navRef} className="bg-emerald-800 text-white border-b border-emerald-900/80 relative z-30 select-none shadow-md">
      <div className="max-w-[1920px] mx-auto px-1 flex items-center relative">
        {/* Scroll Left Button */}
        <button
          onClick={() => scrollNav('left')}
          title="Scroll Left"
          className="p-1 text-white/80 hover:text-white hover:bg-emerald-900 rounded shrink-0 transition hidden sm:flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Top Navigation Scroll Container */}
        <div
          ref={topNavRef}
          onWheel={handleWheelNav}
          className="flex-1 flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5 px-1 whitespace-nowrap scroll-smooth"
        >
          {menuGroups.map((group) => {
            const Icon = group.icon;
            const isOpen = activeMenu === group.id;
            const entries = buildEntries(group);
            const activeEntry = activeSubmenuIndex != null ? entries[activeSubmenuIndex] : undefined;
            const activeCat = activeEntry && activeEntry.kind === 'category' ? activeEntry : null;
            const activeIsPage = Boolean(activeEntry && activeEntry.kind === 'page');

            return (
              <div
                key={group.id}
                className="relative shrink-0"
                onMouseEnter={(e) => { isHoveringRef.current = true; handleMouseEnter(group, e); }}
                onMouseLeave={() => { isHoveringRef.current = false; startCloseTimer(250); }}
              >
                {/* Level 1: Top Menu Button */}
                <button
                  onClick={(e) => handleButtonClick(group, e)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${isOpen ? 'bg-emerald-900 text-white font-bold shadow-inner' : 'text-white/90 hover:text-white hover:bg-emerald-900'}`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-800/80" />
                  <span>{t(group.label)}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-800/70 transition-transform ${isOpen ? 'rotate-180 text-slate-800' : ''}`} />
                </button>

                {/* Flyout Submenu Panel (Levels 2 & 3) */}
                {isOpen && menuPos && (
                  <div
                    ref={flyoutRef}
                    style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                    onMouseEnter={() => { isHoveringRef.current = true; clearCloseTimer(); }}
                    onMouseLeave={() => { isHoveringRef.current = false; startCloseTimer(250); }}
                    onScroll={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    className={`fixed ${menuViewMode === 'split' ? 'w-[520px]' : (menuViewMode === 'tree' ? 'w-[360px]' : 'w-[380px]')} bg-white border border-slate-200 rounded-xl shadow-2xl z-[1000] p-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150 whitespace-normal text-slate-800 flex flex-col max-h-[calc(100vh-110px)]`}
                  >
                    {/* Top Bar Header inside Flyout */}
                    <div className="shrink-0 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 border-b border-slate-100 mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#006130] font-bold">{t(group.label)}</span>
                        <ChevronRight className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-700 normal-case font-semibold">
                          {menuViewMode === 'split'
                            ? (activeCat ? activeCat.title : t('Pages'))
                            : (menuViewMode === 'tree' ? t('Tree View') : t('Simple List'))
                          }
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* View Switcher Toggle: Simple List vs. 2-Pane Split vs. Tree View */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
                          <button
                            onClick={() => setMenuViewMode('list')}
                            title="Simple List View (Clean List)"
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 cursor-pointer ${menuViewMode === 'list' ? 'bg-white text-[#006130] font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <List className="w-2.5 h-2.5" />
                            <span>{t('List')}</span>
                          </button>
                          <button
                            onClick={() => setMenuViewMode('split')}
                            title="2-Pane Split View"
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 cursor-pointer ${menuViewMode === 'split' ? 'bg-white text-[#006130] font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <Layers className="w-2.5 h-2.5" />
                            <span>{t('Split')}</span>
                          </button>
                          <button
                            onClick={() => setMenuViewMode('tree')}
                            title="Expandable Tree View"
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 cursor-pointer ${menuViewMode === 'tree' ? 'bg-white text-[#006130] font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            <ListTree className="w-2.5 h-2.5" />
                            <span>{t('Tree')}</span>
                          </button>
                        </div>

                        {menuViewMode === 'tree' && (
                          <div className="flex items-center gap-1 text-[9px] font-mono normal-case">
                            <button
                              onClick={(e) => expandAll(e, group)}
                              className="text-[#006130] font-bold hover:underline cursor-pointer"
                            >
                              {t('Expand')}
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={(e) => collapseAll(e, group)}
                              className="text-slate-500 hover:underline cursor-pointer"
                            >
                              {t('Collapse')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mode 1: Simple List View (Clean List, No Cards, No Submenu Numbers) */}
                    {menuViewMode === 'list' && (
                      <div className="space-y-2.5 max-h-[min(500px,calc(100vh-140px))] overflow-y-auto overscroll-contain custom-scrollbar px-1 py-1">
                        {entries.map((entry, idx) => {
                          if (entry.kind === 'page') {
                            return (
                              <button
                                key={entry.key}
                                onClick={() => handleSubmenuClick(entry.key, entry.title, entry.icon || 'Settings')}
                                className="w-full text-left px-2 py-1 rounded-md hover:bg-slate-100 hover:text-[#006130] transition text-slate-700 font-medium flex items-center gap-2 cursor-pointer text-xs group"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-white transition shrink-0" />
                                <span className="truncate">{t(entry.title)}</span>
                              </button>
                            );
                          }
                          return (
                            <div key={idx} className="space-y-1">
                              {/* Submenu Category Header */}
                              <div className="text-[11px] font-bold text-[#006130] uppercase tracking-wider pb-0.5 border-b border-slate-100">
                                <span className="truncate">{t(entry.title)}</span>
                              </div>

                              {/* Simple Vertical Sub-items List */}
                              <div className="space-y-0.5 pl-1">
                                {entry.items.map((item) => (
                                  <button
                                    key={item.key}
                                    onClick={() => handleSubmenuClick(item.key, item.title, item.icon || 'Settings')}
                                    className="w-full text-left px-2 py-1 rounded-md hover:bg-slate-100 hover:text-[#006130] transition text-slate-700 font-medium flex items-center gap-2 cursor-pointer text-xs group"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-white transition shrink-0" />
                                    <span className="truncate">{t(item.title)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Mode 2: 2-Pane Split View Mode (No Submenu Numbers) */}
                    {menuViewMode === 'split' && (
                      <div className="flex gap-2 max-h-[min(480px,calc(100vh-140px))] h-[380px] min-h-[220px] overflow-hidden">
                        {/* Level 2 Submenus Column (direct pages + expandable categories) */}
                        <div className="w-[230px] shrink-0 border-r border-slate-100 pr-1.5 overflow-y-auto overscroll-contain custom-scrollbar space-y-0.5 max-h-full">
                          <div className="text-[9px] font-mono text-slate-500 uppercase px-1 mb-1 font-semibold">
                            {t('Pages & Categories')}
                          </div>
                          {entries.map((entry, idx) => {
                            const isSelected = activeSubmenuIndex === idx;
                            if (entry.kind === 'page') {
                              return (
                                <button
                                  key={entry.key}
                                  onMouseEnter={() => setActiveSubmenuIndex(idx)}
                                  onClick={() => handleSubmenuClick(entry.key, entry.title, entry.icon || 'Settings')}
                                  className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition flex items-center justify-between cursor-pointer group ${isSelected ? 'bg-emerald-50 text-[#006130] border border-emerald-200 font-bold' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
                                >
                                  <span className="truncate">{t(entry.title)}</span>
                                  <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${isSelected ? 'translate-x-0.5 text-[#006130]' : ''}`} />
                                </button>
                              );
                            }
                            return (
                              <button
                                key={`${entry.title}-${idx}`}
                                onMouseEnter={() => setActiveSubmenuIndex(idx)}
                                onClick={() => setActiveSubmenuIndex(idx)}
                                className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition flex items-center justify-between cursor-pointer group ${isSelected ? 'bg-emerald-50 text-[#006130] border border-emerald-200 font-bold' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`}
                              >
                                <span className="truncate">{t(entry.title)}</span>
                                <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${isSelected ? 'translate-x-0.5 text-[#006130]' : ''}`} />
                              </button>
                            );
                          })}
                        </div>

                        {/* Level 3 Sub-submenus Column */}
                        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar pl-1.5 space-y-1 max-h-full">
                          {activeCat ? (
                            <>
                              <div className="text-[9px] font-mono text-[#006130] uppercase font-bold px-1 mb-1 flex items-center justify-between">
                                <span>{activeCat.title}</span>
                                <span className="text-slate-500 text-[8px] font-sans font-normal">{t('Click to open')}</span>
                              </div>

                              {activeCat.items.map((item) => (
                                <button
                                  key={item.key}
                                  onClick={() => handleSubmenuClick(item.key, item.title, item.icon || 'Settings')}
                                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-emerald-50 hover:text-[#006130] transition text-slate-800 font-medium flex items-center gap-2 cursor-pointer group border border-transparent hover:border-emerald-200"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-white transition shrink-0" />
                                  <span className="text-xs truncate">{t(item.title)}</span>
                                </button>
                              ))}
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                              {activeIsPage ? t('No submenu — click to open.') : t('Select a category to view its pages.')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mode 3: Expandable Tree View Mode (No Submenu Numbers) */}
                    {menuViewMode === 'tree' && (
                      <div className="space-y-2 max-h-[min(500px,calc(100vh-140px))] overflow-y-auto overscroll-contain custom-scrollbar pr-1 divide-y divide-slate-100">
                        {entries.map((entry, idx) => {
                          if (entry.kind === 'page') {
                            return (
                              <button
                                key={entry.key}
                                onClick={() => handleSubmenuClick(entry.key, entry.title, entry.icon || 'Settings')}
                                className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 hover:text-[#006130] transition text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer text-xs group"
                              >
                                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-white transition shrink-0" />
                                <span className="truncate">{t(entry.title)}</span>
                              </button>
                            );
                          }
                          const catKey = `${group.id}::${entry.title}`;
                          const isCollapsed = Boolean(collapsedCats[catKey]);
                          return (
                            <div key={idx} className={idx > 0 ? "pt-2" : ""}>
                              {/* Level 2 Submenu Heading */}
                              <button
                                onClick={(e) => toggleCategory(catKey, e)}
                                className="w-full text-left text-[11px] font-bold text-[#006130] px-1 py-1 flex items-center justify-between hover:bg-slate-50 rounded transition cursor-pointer group"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <ChevronRight className={`w-3 h-3 text-slate-500 group-hover:text-[#006130] transition-transform ${!isCollapsed ? 'rotate-90 text-[#006130]' : ''}`} />
                                  <span className="truncate">{t(entry.title)}</span>
                                </div>
                              </button>

                              {/* Level 3 Sub-submenus Indented Tree Branch */}
                              {!isCollapsed && (
                                <div className="space-y-0.5 mt-0.5 pl-2 animate-in fade-in duration-100">
                                  {entry.items.map((item) => (
                                    <button
                                      key={item.key}
                                      onClick={() => handleSubmenuClick(item.key, item.title, item.icon || 'Settings')}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 hover:text-[#006130] transition text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer text-xs group"
                                    >
                                      <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-white transition shrink-0" />
                                      <span className="truncate">{t(item.title)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scrollNav('right')}
          title="Scroll Right"
          className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded shrink-0 transition hidden sm:flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};
