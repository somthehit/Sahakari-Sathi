# FEATURE IMPLEMENTATION — Advanced Savings A/C Settings + Account Products

**Project:** Sahakari Sathi — Cooperative Core Banking & Accounting System
**Module:** Setups → Savings A/C Settings (core concept: **Account Products**)

> This spec builds Account Products as the **core/source-of-truth** of Savings A/C Settings, while preserving the existing architecture: organization/branch isolation, accounting integration, auto-opening on member registration, cheque management, approvals, audit logging, and the existing light-theme Dashboard UI.

---

## Table of Contents

1. [Primary Objective](#1-primary-objective)
2. [Important — Inspect First](#2-important--inspect-first)
3. [Navigation](#3-navigation)
4. [Savings A/C Settings Landing Page](#4-savings-ac-settings-landing-page)
5. [Account Products — Core Module](#5-account-products--core-module)
6. [Account Product — General Information](#6-account-product--general-information)
7. [Product Type](#7-product-type)
8. [Eligibility](#8-eligibility)
9. [KYC Requirements](#9-kyc-requirements)
10. [Opening Rules](#10-opening-rules)
11. [Account Ownership](#11-account-ownership)
12. [Account Numbering](#12-account-numbering)
13. [Interest Configuration](#13-interest-configuration)
14. [Interest Rate History](#14-interest-rate-history)
15. [Tax / TDS](#15-tax--tds)
16. [Deposit Rules](#16-deposit-rules)
17. [Withdrawal Rules](#17-withdrawal-rules)
18. [Minimum Balance](#18-minimum-balance)
19. [Dormant / Inactive Rules](#19-dormant--inactive-rules)
20. [Account Closure Rules](#20-account-closure-rules)
21. [Charges & Fees](#21-charges--fees)
22. [Cheque Facility](#22-cheque-facility)
23. [Cheque Management](#23-cheque-management)
24. [Cheque Status Lifecycle](#24-cheque-status-lifecycle)
25. [Cheque Book](#25-cheque-book)
26. [Cheque Leaf Tracking](#26-cheque-leaf-tracking)
27. [Stop Payment](#27-stop-payment)
28. [Cheque Clearing](#28-cheque-clearing)
29. [Cheque Bounce / Return](#29-cheque-bounce--return)
30. [Post-Dated Cheque](#30-post-dated-cheque)
31. [Accounting Mapping](#31-accounting-mapping)
32. [Double-Entry Integration](#32-double-entry-integration)
33. [Member Registration Integration](#33-member-registration-integration)
34. [Auto-Opening Amount](#34-auto-opening-amount)
35. [Provisioning Failure](#35-provisioning-failure)
36. [Idempotency](#36-idempotency)
37. [Account Source](#37-account-source)
38. [Accounting Effective Date](#38-accounting-effective-date)
39. [Standing Instructions](#39-standing-instructions)
40. [Savings Statements](#40-savings-statements)
41. [Passbook](#41-passbook)
42. [Deposit Receipt](#42-deposit-receipt)
43. [Approval Integration](#43-approval-integration)
44. [RBAC](#44-rbac)
45. [Organization Isolation](#45-organization-isolation)
46. [Branch Isolation](#46-branch-isolation)
47. [Branch-Specific Data](#47-branch-specific-data)
48. [Audit](#48-audit)
49. [Setup Wizard](#49-setup-wizard)
50. [Default Saving Product](#50-default-saving-product)
51. [Data Validation](#51-data-validation)
52. [UI/UX](#52-uiux)
53. [Account Product UI](#53-account-product-ui)
54. [Product Detail View](#54-product-detail-view)
55. [Product Deactivation](#55-product-deactivation)
56. [Delete Safety](#56-delete-safety)
57. [Report Integration](#57-report-integration)
58. [Dashboard Integration](#58-dashboard-integration)
59. [API](#59-api)
60. [Rate Limit / Request Loop Safety](#60-rate-limit--request-loop-safety)
61. [Performance](#61-performance)
62. [Database](#62-database)
63. [If New Tables Are Required](#63-if-new-tables-are-required)
64. [Unique Constraints](#64-unique-constraints)
65. [Transaction Safety](#65-transaction-safety)
66. [No Duplicate Accounting Logic](#66-no-duplicate-accounting-logic)
67. [No Duplicate Account Opening Logic](#67-no-duplicate-account-opening-logic)
68. [Security](#68-security)
69. [Testing](#69-testing)
70. [Acceptance Checklist](#70-acceptance-checklist)
71. [Implementation Rule (Phased Plan)](#71-implementation-rule-phased-plan)
72. [Final Deliverable](#72-final-deliverable)
73. [Cross-Module Dependencies](#73-cross-module-dependencies)
74. [Glossary](#74-glossary)
75. [Non-Goals (Explicitly Out of Scope)](#75-non-goals-explicitly-out-of-scope)
76. [Recommended Final Architecture](#76-recommended-final-architecture)

---

### Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Express.js
- Drizzle ORM
- PostgreSQL
- Zod shared validation
- Nepali Bikram Sambat (BS) as primary business date
- Existing RBAC
- Existing Workflow & Approvals
- Existing Audit Logs
- Existing Accounting / Double-Entry Ledger
- Existing Branch Context
- Existing Member Management
- Existing Savings Account functionality where already implemented

---

## 1. Primary Objective

Build a complete, production-ready:

```
SAVINGS A/C SETTINGS
```

module inside the existing SETUPS section. Add it exactly between:

```
Share Settings
Savings A/C Settings
Loan Settings
```

The most important concept inside this module is:

```
ACCOUNT PRODUCTS
```

Account Products represent the actual savings products offered by the cooperative.

**Examples:**

- Regular Savings
- Daily Savings
- Monthly Savings
- Child Savings
- Senior Citizen Savings
- Recurring Savings
- Fixed Deposit
- Special Savings
- Institutional Savings

### Do NOT create duplicate concepts such as:

- Saving Scheme
- Saving Product
- Account Product
- Savings Plan

...unless the existing database architecture already has a genuine distinction between these concepts.

**First inspect the existing schema and code.**

If the existing "Saving Scheme" already functions as the savings product, reuse it and expose it in the UI as **Account Products**. Do NOT create a duplicate product table.

---

## 2. Important — Inspect First

Before writing code, search the entire project for:

```
saving
savings
savingScheme
saving_scheme
savingAccount
saving_accounts
accountProduct
account_product
deposit
interest
withdrawal
cheque
cheques
chequeBook
cheque_book
standingInstruction
accountNumber
account_number
```

Also inspect:

- Drizzle schemas
- migrations
- API routes
- services
- controllers
- repositories
- frontend views
- hooks
- setup wizard
- setup validation
- RBAC permissions
- accounting services
- ledger posting functions
- audit log functions
- approval functions
- notification system
- branch context
- organization context
- member registration
- existing manual savings account opening

**DO NOT assume anything exists. DO NOT create duplicate functionality.**

> 💡 **Tip:** Record findings from this inspection phase before writing any code — see [§73 Cross-Module Dependencies](#73-cross-module-dependencies) for a template of what to confirm.

---

## 3. Navigation

The existing Setup menu must become:

```
SETUPS
├── Organization Settings
├── Workflow & Approvals
├── Member Settings
├── Share Settings
├── Savings A/C Settings
├── Loan Settings
├── Accounting Settings
├── HR Settings
├── Billing Settings
├── Inventory Settings
├── Asset Settings
└── Security Settings
```

The new item must appear exactly between:

```
Share Settings
Loan Settings
```

---

## 4. Savings A/C Settings Landing Page

Follow the existing Setup landing-page architecture. Do not redesign the Setup navigation.

Display:

**SAVINGS A/C SETTINGS**

- Account Products
- Account Opening Rules
- Interest & Calculation Rules
- Deposit Rules
- Withdrawal Rules
- Minimum Balance Rules
- Dormant / Inactive Rules
- Charges & Fees
- Cheque Management
  - Cheque Book Settings
  - Standing Instructions
- Account Numbering
- Deposit Slips / Receipts
- Passbook Settings
- Saving Certificate / Statement
- Approval Rules
- Accounting Mapping

**Only display items that are actually implemented or already exist. Do not create fake/placeholder modules.**

---

## 5. Account Products — Core Module

Account Products is the **central configuration of Savings**. An Account Product defines how a savings account behaves.

| Code | Product |
|------|---------|
| REGULAR | Regular Savings |
| DAILY | Daily Savings |
| MONTHLY | Monthly Savings |
| CHILD | Child Savings |
| SENIOR | Senior Citizen Savings |
| RECURRING | Recurring Savings |
| FIXED | Fixed Deposit |
| SPECIAL | Special Savings |

The exact products must be configurable. **Do not hardcode product names.**

---

## 6. Account Product — General Information

Each product should support, where applicable:

- Product Code *(required)*
- Product Name *(required)*
- Product Name (Nepali)
- Product Type
- Description
- Status
- Sort Order

### Product Code rules

- uppercase
- unique within organization
- no duplicate codes
- max length according to existing schema conventions

Example:

```
REG    → Regular Savings
DAILY  → Daily Deposit
CHILD  → Child Savings
```

### Product Status

- **Active**
- **Inactive**

Inactive products:

- cannot be used for new account opening
- existing accounts remain accessible
- historical transactions remain untouched

---

## 7. Product Type

Support configurable product types where appropriate:

- Regular Savings
- Daily Savings
- Recurring Savings
- Fixed Deposit
- Special Savings
- Other

If the existing system already has a product-type enum/table, **reuse it.** Do not create duplicate enums.

---

## 8. Eligibility

Configure who can open the product. Possible rules:

- Allowed Member Types
- Allowed Member Categories
- Minimum Age
- Maximum Age
- Gender Restriction if already supported
- Individual Account
- Joint Account
- Minor Account
- Institutional Account

Only implement fields supported by the existing member architecture.

Example:

```
Eligible Member Types
[ Individual ]
[ Minor ]
[ Senior Citizen ]
```

The product must be validated during account opening.

---

## 9. KYC Requirements

Product may require:

- KYC Verified
- Photo Required
- Signature Required
- Nominee Required
- Citizenship Required
- Address Verification Required

Reuse existing Member/KYC data. **Do not create a second KYC system.**

---

## 10. Opening Rules

Each Account Product must support:

- Minimum Opening Amount
- Maximum Opening Amount
- Minimum Deposit Amount
- Maximum Deposit Amount
- Minimum Balance
- Maximum Balance

Example:

```
Regular Savings
Minimum Opening: NPR 100
Minimum Balance:  NPR 100
Maximum Balance:  Unlimited
```

Do not hardcode limits.

---

## 11. Account Ownership

Configure:

- Individual
- Joint
- Minor
- Institutional

If Joint Account exists, support the existing joint-member architecture. Do not create a second member relationship model.

---

## 12. Account Numbering

Each product may use:

- Product Prefix
- Branch Code
- Sequence
- Padding
- Fiscal Year

Example:

```
REG-HO-000001
REG-BR01-000001
```

### ⚠️ CRITICAL

If an existing account-number generator exists: **REUSE IT.** Do NOT create another account-number generator.

All generated account numbers must remain:

- organization scoped
- unique
- branch-aware where applicable
- collision safe

---

## 13. Interest Configuration

Each Account Product must support:

- Interest Enabled
- Interest Rate
- Calculation Method
- Posting Frequency
- Effective Date

**Calculation methods** may include:

- Daily Balance
- Minimum Balance
- Average Balance
- Monthly Balance
- Product Specific

**Posting frequency:**

- Monthly
- Quarterly
- Half-Yearly
- Yearly
- Maturity

Use existing accounting/interest services if present. **Do NOT implement duplicate interest calculation logic.**

---

## 14. Interest Rate History

Interest rate changes must preserve history.

Example:

```
5.00%   Effective: 2083-01-01
5.50%   Effective: 2083-06-01
6.00%   Effective: 2084-01-01
```

Historical transactions must not be recalculated using the new rate. Rate changes must support effective dates.

---

## 15. Tax / TDS

If tax/TDS infrastructure already exists, allow product configuration for:

- Tax Applicable
- TDS Applicable
- TDS Rate
- Tax Account

If tax functionality does not exist: **DO NOT invent a separate tax engine.** Mark it: *"Not present — not implemented."*

---

## 16. Deposit Rules

Configure:

- Minimum Deposit
- Maximum Deposit
- Daily Deposit Limit
- Monthly Deposit Limit
- Cash Deposit Allowed
- Bank Deposit Allowed
- Transfer Deposit Allowed
- Backdated Deposit Allowed
- Approval Required

All actual deposits must use the existing deposit transaction service. **Do not directly modify account balances.**

---

## 17. Withdrawal Rules

Configure:

- Minimum Withdrawal
- Maximum Withdrawal
- Daily Withdrawal Limit
- Monthly Withdrawal Limit
- Minimum Balance After Withdrawal
- Cash Withdrawal
- Cheque Withdrawal
- Transfer Withdrawal
- Approval Required
- Withdrawal Charge

Account withdrawal must validate:

- Account Active
- Account Not Frozen
- Account Not Dormant
- Account Not Closed
- Sufficient Balance
- Minimum Balance
- Withdrawal Limit
- Branch Access
- User Permission
- Approval Requirement

Reuse existing transaction validation.

---

## 18. Minimum Balance

Support:

- Minimum Balance
- Grace Period
- Penalty Applicable
- Penalty Amount
- Penalty Percentage
- Penalty Frequency
- Waiver Allowed

Do not create duplicate penalty systems if one already exists.

---

## 19. Dormant / Inactive Rules

Configure:

- Dormancy Enabled
- Inactive After
- Dormant After
- Reactivation Required
- Reactivation Approval
- Reactivation Fee
- Notification Before Dormancy

Example:

```
No transaction for 12 months → Inactive
No transaction for 24 months → Dormant
```

Use existing account-status architecture. Do not create another status system.

---

## 20. Account Closure Rules

Configure:

- Allow Closure
- Minimum Balance Required Before Closure
- Pending Transactions Check
- Pending Cheque Check
- Outstanding Charges Check
- Approval Required
- Closure Fee

An account must not close if:

- uncleared cheque exists
- pending transaction exists
- outstanding liability exists
- required approval is missing

...unless existing business rules explicitly allow it.

---

## 21. Charges & Fees

Account Products may define:

- Opening Fee
- Monthly Maintenance Fee
- Withdrawal Fee
- Cheque Fee
- Cheque Book Fee
- Stop Payment Fee
- Cheque Bounce Fee
- Statement Fee
- Passbook Fee
- Account Closure Fee
- Dormancy/Reactivation Fee
- Other Service Charge

Charges must integrate with the existing accounting engine.

```
Dr Member Savings Liability
Cr Service Charge Income
```

**Do not simply subtract charges from balances without ledger entries.**

---

## 22. Cheque Facility

Account Products must support:

- Cheque Facility Enabled
- Cheque Book Allowed
- Default Cheque Leaves
- Maximum Cheque Books
- Cheque Issue Charge
- Cheque Leaf Charge
- Stop Payment Charge
- Bounce Charge

Example:

```
Regular Savings   ✓ Cheque Facility
Child Savings     ✗ Cheque Facility
```

The system must enforce this during account operations.

---

## 23. Cheque Management

Create/extend **Cheque Management** with:

- Cheque Settings
- Cheque Book Series
- Cheque Book Issue
- Cheque Leaf Tracking
- Stop Payment
- Cheque Clearing
- Cheque Return / Bounce
- Post-Dated Cheques
- Lost / Cancelled Cheques
- Cheque Charges

Reuse existing cheque functionality if already present.

---

## 24. Cheque Status Lifecycle

Use controlled states:

```
Issued · Unused · Presented · Under Clearing · Cleared
Bounced · Stopped · Cancelled · Lost · Expired · Returned
```

Prevent invalid transitions. Valid paths, e.g.:

```
Unused → Presented → Under Clearing → Cleared

Presented → Under Clearing → Bounced

Unused → Stopped
```

---

## 25. Cheque Book

Cheque Book must support:

- Cheque Book Number
- Account
- Product
- Branch
- Start Number
- End Number
- Number of Leaves
- Issue Date
- Issued By
- Status

Example:

```
Book: CB-000001
Leaves: 100
000001 → 000100
```

Each cheque number must be traceable. No duplicate cheque numbers.

---

## 26. Cheque Leaf Tracking

Track each cheque:

- Cheque Number
- Account
- Member
- Cheque Book
- Amount
- Payee
- Issue Date
- Presented Date
- Clearing Date
- Status
- Reference
- Remarks

---

## 27. Stop Payment

Support:

- Stop Payment Request
- Cheque Number
- Account
- Reason
- Requested By
- Requested Date
- Approval
- Approved By
- Approved Date
- Status

A stopped cheque must not be cleared/paid. All actions must be audited.

---

## 28. Cheque Clearing

Support:

- Presented Date
- Clearing Date
- Bank
- Reference Number
- Cheque Amount
- Payee
- Status
- Remarks

When cleared: use the existing accounting posting engine. **Do NOT manually update balances.**

---

## 29. Cheque Bounce / Return

Support:

- Return Date
- Return Reason
- Bank
- Reference
- Bounce Charge
- Remarks

Bounce charges must use existing accounting posting.

---

## 30. Post-Dated Cheque

If supported by existing transaction architecture, allow:

```
Cheque Date > Working Date
```

Do not permit clearing before the cheque date. Use existing Working Date rules.

---

## 31. Accounting Mapping

**This is mandatory.**

Every Account Product must be mapped to the existing Chart of Accounts (see the Accounting Settings module, [§73](#73-cross-module-dependencies)).

Potential mappings:

- Savings Liability GL
- Interest Expense GL
- Cash GL
- Bank GL
- Service Charge Income GL
- Penalty Income GL
- Cheque Charge Income GL
- Withdrawal Clearing GL
- Interest Payable GL

**Do NOT hardcode GL IDs.** Admin must select accounts from the current organization's Chart of Accounts. Validate organization ownership.

---

## 32. Double-Entry Integration

All financial events must use the existing ledger posting engine.

```
Deposit
Dr Cash / Bank
Cr Savings Liability

Withdrawal
Dr Savings Liability
Cr Cash / Bank

Interest
Dr Interest Expense
Cr Savings Liability / Interest Payable

Service Charge
Dr Savings Liability / Cash
Cr Service Charge Income

Penalty
Dr Savings Liability / Cash
Cr Penalty Income
```

Do not write duplicate journal-posting code.

---

## 33. Member Registration Integration

Integrate with the previously defined automatic account-opening workflow.

Setup contains:

```
defaultSavingSchemeId
```

or, if the existing schema uses product terminology:

```
defaultSavingProductId
```

**Do NOT create both fields unless technically necessary.** Inspect existing implementation first.

When registering a new member:

```
1. Create Member
2. Commit Member
3. Read Organization Default Saving Product
4. Validate Product Active
5. Open Saving Account
6. Generate Account Number
7. Auto Deposit Minimum Opening Amount
8. Post Ledger Entries
9. Mark opened_via = "auto"
```

**Member creation must NOT rollback if provisioning fails.**

---

## 34. Auto-Opening Amount

The new Saving Account must not start at zero if the product requires an opening amount.

Example:

```
Product: Regular Savings
Minimum Opening Amount: NPR 100

Member Registration → Saving Account Created → Opening Deposit NPR 100

Accounting:
Dr Cash/Bank      100
Cr Savings Liability  100
```

Use the existing deposit-posting service. Do not duplicate it.

---

## 35. Provisioning Failure

If:

- default product missing
- product inactive
- account creation fails
- account-number generation fails
- ledger posting fails

Member registration must still succeed. Provisioning must be:

```
failed → queued → retry
```

Reuse the previously implemented `account_provisioning_queue` if it already exists. **Do not create a second queue.**

---

## 36. Idempotency

Before automatically opening an account, check:

- organization_id
- member_id
- product_id
- account_type
- active account

If the account already exists: **DO NOT create another account.** Retry must be safe.

---

## 37. Account Source

Automatically opened accounts must be distinguishable. Use existing field if present:

```
opened_via = "auto"     (automatic)
opened_via = "manual"   (manual)
```

Do not add another equivalent field if one already exists.

---

## 38. Accounting Effective Date

Financial transactions must use the **current organization working date**, not the browser's arbitrary date. Use BS date as the primary business date.

---

## 39. Standing Instructions

If the existing system supports recurring transactions, integrate with it. Possible settings:

- Enabled
- Frequency
- Minimum Amount
- Maximum Amount
- Start Date
- End Date
- Failure Handling
- Approval

Do not build another scheduler if one already exists.

---

## 40. Savings Statements

Support configuration for:

- Statement Format
- Member Information
- Account Number
- Product
- Opening Balance
- Deposits
- Withdrawals
- Interest
- Charges
- Closing Balance
- Running Balance
- BS Date
- AD Date
- Branch
- Authorized Signature

Reuse existing PDF/print infrastructure.

---

## 41. Passbook

Support:

- Passbook Format
- Member Information
- Account Number
- Product
- Transaction Date
- Particulars
- Deposit
- Withdrawal
- Balance
- Interest
- Branch
- Signature

Reuse existing passbook components if available.

---

## 42. Deposit Receipt

Support:

- Receipt Number
- Member
- Account
- Product
- Transaction Number
- Amount
- Amount in Words
- Date
- Branch
- Teller
- Payment Method
- Signature
- Footer

Reuse existing receipt/print system.

---

## 43. Approval Integration

**Do NOT create a new approval system.** Use existing:

- Approval Levels
- Approval Matrix
- Pending Approvals
- Approval History

Potential Savings operations requiring approval:

- Large Withdrawal
- Cheque Book Issue
- Stop Payment
- Cheque Clearing
- Interest Rate Change
- Account Closure
- Manual Interest Adjustment
- Manual Charge Waiver

Only activate approval where the existing Workflow/Approval system supports it.

---

## 44. RBAC

Use the existing permission architecture.

```
savings.settings.view
savings.settings.create
savings.settings.update
savings.settings.delete

savings.products.view
savings.products.create
savings.products.update
savings.products.delete

savings.cheque.view
savings.cheque.issue
savings.cheque.stop
savings.cheque.clear
savings.cheque.return
savings.cheque.approve
```

Do not hardcode roles. Do not bypass permission middleware.

---

## 45. Organization Isolation

**This is mandatory.** Every Savings-related query must enforce `organization_id`.

Never allow:

```
Org A → Org B Account Products
Org A → Org B Accounts
Org A → Org B Cheques
Org A → Org B GL mappings
```

Frontend `organization_id` must **NEVER** be trusted as the authority. Derive organization context from the authenticated user/session.

---

## 46. Branch Isolation

- **Branch user:** Branch A → only Branch A operational data
- **Admin:** All branches, and can switch branch from navbar

When branch is switched:

- update branch context
- reload branch-scoped data
- preserve organization context
- invalidate/reload affected queries
- never leak previous branch data

Use the existing branch-switch implementation.

---

## 47. Branch-Specific Data

Where appropriate, these must respect branch scope:

- Cheque Books
- Cheque Leaves
- Transactions
- Cash
- Bank
- Teller operations
- Account operations

Organization-level product configuration should not unnecessarily duplicate per branch.

---

## 48. Audit

Reuse existing Audit Logs. Audit:

- Product Created
- Product Updated
- Product Deactivated
- Interest Rate Changed
- Accounting Mapping Changed
- Cheque Book Issued
- Cheque Stopped
- Cheque Presented
- Cheque Cleared
- Cheque Bounced
- Cheque Cancelled
- Account Opened
- Account Closed
- Charge Changed
- Rules Changed

**Record:** User, Organization, Branch, Action, Entity, Entity ID, Old Value, New Value, Working Date, Timestamp.

Do not build a second audit framework.

---

## 49. Setup Wizard

Integrate Savings A/C Settings into the existing First-Time Admin Setup Wizard:

```
1. Cooperative Profile
2. Branches
3. Fiscal Years
4. Working Date
5. Working Days & Hours
6. Currency
7. Language & Localization
8. Time Zone
9. Share Settings
10. Savings A/C Settings
11. Loan Settings
12. Accounting Settings
13. HR Settings
14. Setup Complete
```

Savings setup validation must include at minimum:

```
defaultSavingProductId
```

or existing:

```
defaultSavingSchemeId
```

plus required configuration that actually exists. Do not invent unnecessary mandatory settings.

---

## 50. Default Saving Product

Admin must select a **Default Saving Product** from active Account Products. Only active products belonging to the current organization may be selected.

If the default product is deactivated later, member registration must:

- skip auto-provisioning
- log reason
- alert admin
- queue provisioning if appropriate

Do not automatically select another product.

---

## 51. Data Validation

Use Zod. Validate:

- Product Code
- Product Name
- Amounts
- Interest Rate
- Dates
- Limits
- GL Accounts
- Cheque configuration

Examples:

```
minimumAmount >= 0
maximumAmount >= minimumAmount
interestRate >= 0
minimumBalance >= 0
```

Prevent invalid configurations.

---

## 52. UI/UX

The entire module must follow the Dashboard/Home design.

**Use:**

```
white · slate-50 · slate-100 · slate-200 · slate-600 · slate-700
emerald (primary)
blue    (informational/semantic actions only)
amber   (warning)
rose    (danger)
```

**Do NOT use:**

```
bg-slate-900 · bg-slate-950 · bg-[#0b1220] · bg-[#0f172a]
dark navy panels · dark modal backgrounds
```

Do not introduce a dark-theme UI.

---

## 53. Account Product UI

The Account Product form should be organized into clear sections:

```
┌─────────────────────────────────────────────┐
│ Account Product                              │
├─────────────────────────────────────────────┤
│ Basic Information                            │
│  Product Code       Product Name             │
│  Nepali Name        Product Type             │
│  Description                                 │
├─────────────────────────────────────────────┤
│ Eligibility                                  │
│  Member Types                                │
│  Age Rules                                   │
│  Ownership Type                              │
│  KYC Requirements                            │
├─────────────────────────────────────────────┤
│ Opening & Balance Rules                      │
│  Opening Amount                              │
│  Minimum Balance                             │
│  Maximum Balance                             │
│  Deposit Limits                              │
│  Withdrawal Limits                           │
├─────────────────────────────────────────────┤
│ Interest                                     │
│  Rate                                        │
│  Calculation Method                          │
│  Posting Frequency                           │
│  Effective Date                              │
├─────────────────────────────────────────────┤
│ Cheque                                       │
│  Enable Cheque Facility                      │
│  Default Leaves                              │
│  Charges                                     │
├─────────────────────────────────────────────┤
│ Charges                                      │
│  Opening Fee                                 │
│  Maintenance Fee                             │
│  Withdrawal Fee                              │
│  Closure Fee                                 │
├─────────────────────────────────────────────┤
│ Accounting Mapping                           │
│  Savings Liability GL                        │
│  Interest Expense GL                         │
│  Service Charge Income GL                    │
│  Penalty Income GL                           │
├─────────────────────────────────────────────┤
│ Status                                       │
│  Active                                      │
└─────────────────────────────────────────────┘
```

Do not make the form unnecessarily complicated. Use tabs/sections/accordion only if the existing UI architecture supports them.

---

## 54. Product Detail View

Product details should show:

- Product
- Status
- Interest
- Opening Rules
- Balance Rules
- Deposit Rules
- Withdrawal Rules
- Cheque Facility
- Charges
- Accounting Mapping
- Usage Statistics
- Audit History

Useful statistics:

- Active Accounts
- Total Balance
- Monthly Deposits
- Monthly Withdrawals
- Total Interest

**Use real database data. No mock values.**

---

## 55. Product Deactivation

Deactivation must be safe. When an Account Product is already used by accounts, do **NOT** delete historical product data. Instead:

```
Active → Inactive
```

Existing accounts continue to work according to applicable rules. New accounts cannot be opened under inactive products.

---

## 56. Delete Safety

Do not hard-delete products if they are referenced by:

- Savings accounts
- Transactions
- Cheques
- Ledger entries
- Statements
- Reports

Use deactivation/archive if appropriate.

---

## 57. Report Integration

Account Products should be available as filters in existing reports where applicable:

- Savings Balance
- Deposit Report
- Withdrawal Report
- Interest Report
- Account Register
- Cheque Report
- Member Savings Report
- Branch Savings Report
- Product-wise Savings Report

Do not create duplicate report engines.

---

## 58. Dashboard Integration

If the dashboard already supports savings metrics, use Account Product data:

- Total Savings
- Active Savings Accounts
- Product-wise Savings
- Today's Deposits
- Today's Withdrawals
- Cheque Pending
- Cheque Clearing
- Dormant Accounts

Only modify existing dashboard metrics where integration is appropriate.

---

## 59. API

Follow existing API conventions.

Potential endpoints, **only if equivalent endpoints don't already exist:**

```
GET    /api/v1/savings/account-products
POST   /api/v1/savings/account-products
GET    /api/v1/savings/account-products/:id
PUT    /api/v1/savings/account-products/:id
DELETE /api/v1/savings/account-products/:id

GET    /api/v1/savings/settings
PUT    /api/v1/savings/settings

GET    /api/v1/savings/cheque-books
POST   /api/v1/savings/cheque-books

GET    /api/v1/savings/cheques
GET    /api/v1/savings/cheques/:id

POST   /api/v1/savings/cheques/:id/stop
POST   /api/v1/savings/cheques/:id/present
POST   /api/v1/savings/cheques/:id/clear
POST   /api/v1/savings/cheques/:id/return
POST   /api/v1/savings/cheques/:id/cancel
```

Reuse existing routes whenever possible.

---

## 60. Rate Limit / Request Loop Safety

Avoid the previous problem where the frontend generated repeated API calls, resulting in:

```
429 Too Many Requests
```

Check:

- useEffect dependencies
- query invalidation
- route remounting
- unstable callbacks
- polling
- retry loops
- failed request retry behavior

Do not continuously retry a 429. Use controlled retry/backoff where necessary.

---

## 61. Performance

Avoid N+1 API calls. For example, the Account Product page should not call the same endpoint separately for every row.

Use:

- batched queries
- appropriate joins
- existing query hooks
- caching
- controlled invalidation

Do not over-fetch.

---

## 62. Database

Before creating migrations, inspect:

```
organizations
organization_settings
saving_schemes
saving_accounts
saving_transactions
accounts
members
branches
chart_of_accounts
audit_logs
approval_*
cheque_*
```

If an existing table already represents Account Products: **REUSE IT.**

Do not create `account_products` if `saving_schemes` already serves exactly that purpose. Only create a new table if there is a genuine architectural need.

---

## 63. If New Tables Are Required

Any new table must include appropriate:

```
id
organization_id
branch_id (only when required)
created_by
updated_by
created_at
updated_at
```

plus appropriate foreign keys and indexes. All foreign keys must be organization-safe.

---

## 64. Unique Constraints

Examples:

- `organization_id + product_code` must be unique
- Cheque numbers must be unique within their applicable scope
- Account numbers must remain globally unique within organization according to the existing architecture

---

## 65. Transaction Safety

Financial operations must be atomic at the transaction level.

**Example — Saving Deposit:**

```
Create transaction
+
Create ledger entries
+
Update account balance
```

must either fully succeed or fully rollback.

**BUT:** Member Registration and Automatic Saving Account Provisioning must remain separate as previously specified. Member creation must never rollback because automatic savings provisioning failed.

---

## 66. No Duplicate Accounting Logic

Search and reuse existing:

```
depositPostingService
withdrawalPostingService
ledgerService
journalService
voucherService
accountingService
```

or whatever equivalent exists. Do not implement a new custom `debitCredit()` if an existing service already performs this.

---

## 67. No Duplicate Account Opening Logic

Search the existing manual **New Savings Account** flow. The automatic member-registration flow must call the same underlying account-opening service. Do not duplicate:

- account-number generation
- balance initialization
- ledger posting
- account validation
- GL mapping

---

## 68. Security

All Savings API endpoints must verify:

- Authentication
- Organization
- Branch
- Permission
- Record ownership/scope

Never rely only on frontend hiding.

---

## 69. Testing

Implement or update tests for:

**Product**
- Create / Read / Update / Deactivate
- Duplicate code rejection
- Organization isolation

**Account Opening**
- Active product / Inactive product
- Minimum opening amount
- Eligibility
- KYC requirement
- Account number generation

**Deposit**
- Minimum amount / Maximum amount
- Balance update
- Ledger entries

**Withdrawal**
- Balance validation
- Minimum balance
- Limits
- Ledger entries

**Interest**
- Calculation
- Effective date
- Rate history
- Posting

**Cheque**
- Issue / Present / Clear / Bounce / Stop / Cancel / Lost
- Invalid transitions

**Member Registration**
- Member Created + Auto Saving Account Created + Opening Deposit Posted
- Failure: Member Created + Saving Provisioning Failed + Queue Created + Retry Successful + No Duplicate Account

**Branch**
- Branch A user cannot access Branch B operational savings data

**Organization**
- Organization A cannot access Organization B savings data

---

## 70. Acceptance Checklist

### Navigation
- [ ] Savings A/C Settings appears between Share Settings and Loan Settings
- [ ] Setup navigation works
- [ ] Existing visual design is preserved

### Account Products
- [ ] Account Products exists
- [ ] Product CRUD works
- [ ] Product code is unique per organization
- [ ] Product can be activated/deactivated
- [ ] Existing products/schemes are reused where appropriate
- [ ] No duplicate Saving Scheme/Product table was created unnecessarily

### Rules
- [ ] Opening rules work
- [ ] Deposit rules work
- [ ] Withdrawal rules work
- [ ] Minimum balance works
- [ ] Dormant rules work
- [ ] Charges work
- [ ] Interest configuration works

### Cheque
- [ ] Cheque facility can be enabled per product
- [ ] Cheque books can be issued
- [ ] Cheque leaves are tracked
- [ ] Stop payment works
- [ ] Clearing works
- [ ] Bounce/return works
- [ ] Status transitions are validated
- [ ] Cheque operations are audited

### Accounting
- [ ] Product GL mapping works
- [ ] Deposits create correct double-entry
- [ ] Withdrawals create correct double-entry
- [ ] Interest creates correct double-entry
- [ ] Charges create correct double-entry
- [ ] Existing accounting engine is reused
- [ ] No duplicate posting engine exists

### Member Registration
- [ ] Default Saving Product can be configured
- [ ] New member automatically receives Saving Account
- [ ] Minimum opening amount is deposited
- [ ] Account is marked `opened_via = auto`
- [ ] Member creation succeeds even if provisioning fails
- [ ] Failed provisioning is queued
- [ ] Retry is idempotent
- [ ] Retry does not create duplicate accounts

### Security
- [ ] Organization isolation works
- [ ] Branch isolation works
- [ ] Admin can access authorized branches
- [ ] RBAC is enforced
- [ ] Frontend cannot bypass scope

### UI
- [ ] Dashboard-style light UI
- [ ] No dark navy backgrounds
- [ ] No slate-900/slate-950 panels
- [ ] No fake/mock data
- [ ] Forms are responsive
- [ ] Tables are readable
- [ ] Loading states work
- [ ] Error states work
- [ ] Empty states work

### Performance
- [ ] No repeated API request loop
- [ ] No unnecessary polling
- [ ] No N+1 requests
- [ ] No 429 request storm
- [ ] Query invalidation is controlled

---

## 71. Implementation Rule (Phased Plan)

Do **NOT** implement everything blindly in one pass.

| Phase | Focus |
|-------|-------|
| **1** | Inspect existing architecture |
| **2** | Implement Savings A/C Settings + Account Products |
| **3** | Integrate Account Opening, Deposit, Withdrawal, Interest, Accounting |
| **4** | Implement/integrate Cheque Management, Cheque Books, Cheque Lifecycle |
| **5** | Integrate Setup Wizard, Default Saving Product, Member Registration Auto-Provisioning |
| **6** | Integrate RBAC, Branch Isolation, Organization Isolation, Audit, Approvals |
| **7** | Run TypeScript, ESLint, Drizzle checks, API tests, Integration tests, Build |
| **8** | Full codebase search for duplicate logic (see below) |

**Phase 8 search targets:**

```
saving scheme
saving product
account product
account opening
account number generation
deposit posting
withdrawal posting
cheque
```

Remove/reuse duplicate implementations where appropriate.

---

## 72. Final Deliverable

After implementation, provide:

### 1. Files Changed

Group by:

```
Navigation
Setup Views
Account Products
Savings Accounts
Interest
Deposits
Withdrawals
Cheque
Accounting
API
Database / Drizzle
Validation
Setup Wizard
RBAC
Branch Context
Audit
Approvals
Tests
```

### 2. Existing Code Reused

Explicitly list, where applicable:

- Existing Account Number Generator
- Existing Account Opening Service
- Existing Deposit Posting Service
- Existing Withdrawal Posting Service
- Existing Ledger Service
- Existing Chart of Accounts
- Existing Audit System
- Existing Approval System
- Existing Branch Context
- Existing Organization Context
- Existing Notification System

### 3. Database Changes

List: new tables, modified tables, new columns, indexes, constraints, migrations.

If no migration is necessary, explicitly say: **"No database migration required."**

### 4. Acceptance Checklist Report

Report one of the following for every acceptance item:

```
PASS
FAIL
NOT PRESENT
REUSED EXISTING
```

### 5. Important

Do not claim a feature is implemented simply because the UI exists. Verify the full chain:

```
UI → API → Validation → Database → Business Logic → Accounting → Audit → RBAC → Organization Scope → Branch Scope
```

The final implementation must be a real integrated **Core Banking feature**, not a collection of disconnected setup forms.

---

## 73. Cross-Module Dependencies

Savings A/C Settings does not stand alone — confirm these integration points against the previously implemented **Accounting Settings** module before/while building:

| Dependency | What to confirm |
|---|---|
| Chart of Accounts | Account picker in Accounting Mapping (§31) must pull live, organization-scoped, posting-enabled accounts |
| Voucher Types | Deposit/Withdrawal/Interest/Charge postings should map to existing voucher types (Deposit, Withdrawal, Journal) rather than inventing new ones |
| System Account Mapping | If a global System Account Mapping screen already exists (Cash, Bank, Suspense, etc.), Savings Liability/Interest/Charge GLs should be selectable from the same Chart of Accounts, not a parallel mapping table |
| Financial Periods | Deposit/withdrawal/interest posting must be rejected if the transaction date falls in a closed/locked period |
| Cost Centers | Only wire in if withdrawal/deposit vouchers already support cost center tagging |
| Audit Log Service | Reuse the same service and field shape (`organization`, `branch`, `user`, `action`, `entity`, `entity_id`, `old_value`, `new_value`, `timestamp`, `reason`) used by Accounting Settings |
| RBAC Permission Naming | Follow the same dotted convention already used (e.g. `accounting.*`) when naming `savings.*` permissions |

> Record answers to these before Phase 2 of the [Implementation Plan](#71-implementation-rule-phased-plan) so Account Product accounting mapping doesn't get built against assumptions that don't match the real schema.

---

## 74. Glossary

| Term | Meaning |
|---|---|
| **Account Product** | The configurable definition of a savings offering (rules, interest, charges, cheque facility, GL mapping). Not itself a posting account. |
| **Saving Scheme** | Legacy/alternate name that may already exist in the codebase for the same concept — reuse, don't duplicate. |
| **opened_via** | Field marking whether an account was opened `"auto"` (via member registration) or `"manual"` (via staff action). |
| **Provisioning Queue** | Retry mechanism for failed automatic account opening during member registration. |
| **GL Mapping** | The link from a business concept (e.g. Savings Liability) to an actual Chart of Accounts entry. |
| **Working Date** | The organization's current business date (BS), used for all accounting effective dates — not the browser's local date. |

---

## 75. Non-Goals (Explicitly Out of Scope)

To keep this implementation focused, the following are **not** part of this spec unless the existing codebase already implements them — in which case, integrate, don't extend beyond parity:

- Building a new tax/TDS engine from scratch
- Building a new scheduler/cron system for Standing Instructions
- Building a new bank reconciliation module
- Building a second approval or audit framework
- Redesigning the overall Setup navigation or Dashboard visual system
- Multi-currency savings accounts (unless already supported)

---

## 76. Recommended Final Architecture

The key relationship should ultimately be:

```
                    SAVINGS A/C SETTINGS
                           │
                           ▼
                    ACCOUNT PRODUCTS
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                 ▼
     Account Rules      Interest          Charges
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
                    SAVINGS ACCOUNT
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Deposit       Withdrawal      Cheque
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                   ACCOUNTING ENGINE
                           │
                           ▼
                  CHART OF ACCOUNTS
                           │
                           ▼
                     GL / LEDGER
```

यसरी Account Product नै Savings module को source of truth हुन्छ। त्यसबाट account opening, interest, deposit, withdrawal, cheque facility, charges र accounting behavior निर्धारण हुन्छ — पछि Member Registration को `defaultSavingProductId` ले त्यही product प्रयोग गरेर automatic account खोल्छ।