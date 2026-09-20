import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'coop_db.json');

export function getEmptyCoopStore() {
    return {
        branches: [
            {
                id: 'b1',
                code: 'BR-01',
                name: 'Head Office - Kathmandu',
                address: 'New Road, Kathmandu',
                phone: '01-4235890',
                managerName: 'Branch Manager',
                vaultLimit: 5000000,
                currentVaultCash: 0,
            }
        ],
        fiscalYears: [], // Starts completely empty! User MUST setup fiscal year first.
        departments: [
            {
                id: 'dept-1',
                code: 'DEP-ACC',
                name: 'Finance & Accounts Department',
                headOfDepartment: 'Chief Accountant',
                branchId: 'b1',
                staffCount: 1,
                budgetAllocation: 1000000,
                usedBudget: 0,
                description: 'Cooperative core accounting, double-entry ledgers, vouchers, and audit trail.',
                costCenterCode: 'CC-ACC-101',
                status: 'Active',
                createdAtBS: '2082-01-01'
            }
        ],
        members: [],
        savingsAccounts: [],
        loanAccounts: [],
        chartOfAccounts: [
            { id: 'c01', code: '01', name: 'Equity', type: 'Liability', balance: 0, parentCode: '', isSystemAccount: true },
            { id: 'c01_10', code: '01-10', name: 'Share Capital', type: 'Liability', balance: 0, parentCode: '01', isSystemAccount: true },
            { id: 'c01_20', code: '01-20', name: 'Reserve Funds(काेष हिसाब)', type: 'Liability', balance: 0, parentCode: '01', isSystemAccount: true },
            { id: 'c01_20_001', code: '01-20-001', name: 'General Reserve Fund', type: 'Liability', balance: 0, parentCode: '01-20', isSystemAccount: true },
            { id: 'c01_20_005', code: '01-20-005', name: 'Loan Loss Reserve', type: 'Liability', balance: 0, parentCode: '01-20', isSystemAccount: true },
            { id: 'c02', code: '02', name: 'Expenses (खर्च खाता)', type: 'Expense', balance: 0, parentCode: '', isSystemAccount: true },
            { id: 'c02_150_001', code: '02-150-001', name: 'Operational Expenses', type: 'Expense', balance: 0, parentCode: '02', isSystemAccount: true },
            { id: 'c02_150_002', code: '02-150-002', name: 'Administrative Expenses', type: 'Expense', balance: 0, parentCode: '02', isSystemAccount: true },
            { id: 'c03', code: '03', name: 'Income & Gain (आम्दानी खाता)', type: 'Income', balance: 0, parentCode: '', isSystemAccount: true },
            { id: 'c03_160_01', code: '03-160-01', name: 'Direct Income', type: 'Income', balance: 0, parentCode: '03', isSystemAccount: true },
            { id: 'c03_160_02', code: '03-160-02', name: 'Indirect Income', type: 'Income', balance: 0, parentCode: '03', isSystemAccount: true },
            { id: 'c04', code: '04', name: 'Assets (सम्पत्ती खाता)', type: 'Asset', balance: 0, parentCode: '', isSystemAccount: true },
            { id: 'c04_80', code: '04-80', name: 'Cash (नगद हिसाब)', type: 'Asset', balance: 0, parentCode: '04', isSystemAccount: true },
            { id: 'c04_90', code: '04-90', name: 'Bank A/c (बैँक खाता)', type: 'Asset', balance: 0, parentCode: '04', isSystemAccount: true },
            { id: 'c04_110', code: '04-110', name: 'Loan A/c (कर्जा दिएकाे हिसाब)', type: 'Asset', balance: 0, parentCode: '04-110', isSystemAccount: true },
            { id: 'c05', code: '05', name: 'Liabilities (दायित्त्व खाता)', type: 'Liability', balance: 0, parentCode: '', isSystemAccount: true },
            { id: 'c05_30', code: '05-30', name: 'Member Deposit(बचत खाता)', type: 'Liability', balance: 0, parentCode: '05', isSystemAccount: true }
        ],
        vouchers: [],
        collectionAgents: [],
        collectionRoutes: [],
        budgetLines: [],
        fixedAssets: [],
        approvalRequests: [],
        auditLogs: [],
        customerTickets: []
    };
}

export function readCoopStore() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            const emptyStore = getEmptyCoopStore();
            fs.writeFileSync(DATA_FILE, JSON.stringify(emptyStore, null, 2), 'utf-8');
            return emptyStore;
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (err) {
        console.error("Error reading coop_db.json store, returning default empty store:", err);
        return getEmptyCoopStore();
    }
}

export function writeCoopStore(data: any) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error("Error writing coop_db.json store:", err);
        return false;
    }
}
