import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const session = {
  state: {
    token: 'mock-token',
    user: {
      organizationId: 'org_1', organizationCode: 'SSCL', userId: 'u1', username: 'admin',
      role: 'org_admin', fullName: 'Test Admin', requiresPasswordChange: false,
      isTemporaryPassword: false, emailVerified: true, securityScore: 100,
      passwordChanged: true, securitySetupCompleted: true, mobileVerified: true,
      mobileNumber: '9800000000', securityQuestionsCompleted: true,
      firstLoginCompleted: true, mustChangePassword: false, mustCompleteSecuritySetup: false,
    },
    expiresAt: '2099-01-01T00:00:00.000Z',
    isAuthenticated: true,
  },
  version: 0,
};

async function clickTab(page: any, name: string) {
  const btn = page.getByRole('button', { name, exact: true });
  const count = await btn.count();
  if (count > 0) { await btn.first().click(); await page.waitForTimeout(800); return true; }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors: string[] = [];
  const consoleErrs: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrs.push(msg.text()); });

  await page.addInitScript((sess) => { localStorage.setItem('sahakari-auth-session', JSON.stringify(sess)); }, session);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // Open Shares module
  await page.getByRole('button', { name: 'Shares', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Share Capital Ledger', exact: true }).first().click();
  await page.waitForTimeout(2500);

  const h1 = await page.locator('h1', { hasText: 'Share Capital' }).count();
  console.log('=== SHARES VIEW RENDERED:', h1 > 0, '===');

  // OVERVIEW TAB
  await clickTab(page, 'Overview');
  await page.waitForTimeout(1000);
  const ov = await page.evaluate(() => document.body.innerText);
  console.log('Overview: heading present:', ov.includes('Share Capital & AGM Dividend Management'));
  console.log('Overview: shows paid-up capital (10,500.00):', ov.includes('10,500.00'));
  console.log('Overview: shows proposed dividend (1,260.00):', ov.includes('1,260.00'));
  console.log('Overview: recent txn lists members:', ['Ram Bahadur Thapa', 'Sita Kumari Sharma'].every(n => ov.includes(n)));

  // REGISTER TAB
  await clickTab(page, 'Share Register');
  const reg = await page.evaluate(() => document.body.innerText);
  console.log('Register: MBR numbers:', reg.includes('MBR-2083-0001') && reg.includes('MBR-2083-0005'));
  console.log('Register: share counts:', reg.includes('20') && reg.includes('35'));
  console.log('Register: status Active:', reg.includes('Active'));

  // ISSUE / TRANSFER TAB
  await clickTab(page, 'Issue / Transfer');
  const iss = await page.evaluate(() => document.body.innerText);
  console.log('Issue: real member in dropdown:', iss.includes('Ram Bahadur Thapa (MBR-2083-0001)'));
  console.log('Issue: share class in dropdown:', iss.includes('Ordinary Shares'));
  console.log('Issue: issue form present:', iss.includes('Issue New Shares') && iss.includes('Transfer Shares'));

  // CERTIFICATES TAB
  await clickTab(page, 'Certificates');
  const cert = await page.evaluate(() => document.body.innerText);
  console.log('Certificates: SC-00001..SC-00007:', cert.includes('SC-00001') && cert.includes('SC-00007'));
  console.log('Certificates: count header:', cert.includes('Share Certificates'));

  // TRANSACTIONS (LEDGER) TAB
  await clickTab(page, 'Transactions');
  const ledger = await page.evaluate(() => document.body.innerText);
  console.log('Ledger: Transfer In/Out rows:', ledger.includes('Transfer In') || ledger.includes('Transfer_Out'));
  console.log('Ledger: voucher nos:', ledger.includes('STX-00007'));

  // SHARE TYPES TAB
  await clickTab(page, 'Share Types');
  const types = await page.evaluate(() => document.body.innerText);
  console.log('Types: ORD present:', types.includes('ORD'));
  console.log('Types: Ordinary Shares present:', types.includes('Ordinary Shares'));
  console.log('Types: dividend 12%:', types.includes('12%'));

  await page.screenshot({ path: 'C:\\Users\\somth\\AppData\\Local\\Temp\\opencode\\shares-screen.png', fullPage: true });

  console.log('PAGE ERRORS:', pageErrors.length ? JSON.stringify(pageErrors) : 'none');
  console.log('CONSOLE ERRORS:', consoleErrs.length ? JSON.stringify(consoleErrs.slice(0, 10)) : 'none');
  await browser.close();
})();
