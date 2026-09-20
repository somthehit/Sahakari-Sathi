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

  // 0. Language switcher in the top header — should be visible (नेपाली / EN)
  const neBtn = await page.locator('button', { hasText: /^नेपाली$/ }).count();
  const enBtn = await page.locator('button', { hasText: /^EN$/ }).count();
  console.log('Header language switcher buttons:', { neBtn, enBtn });

  // 1. Switch UI to English via the header toggle, confirm footer + chrome translate
  await page.locator('button', { hasText: /^EN$/ }).first().click();
  await page.waitForTimeout(800);
  const footerEn = await page.locator('footer, .footer', { hasText: /Last Txn|User Manual|Audit Logs/ }).count();
  console.log('Footer shows English chrome after switch:', footerEn > 0);

  // 2. Switch UI to Nepali via the header toggle
  await page.locator('button', { hasText: /^नेपाली$/ }).first().click();
  await page.waitForTimeout(800);

  await page.locator('button', { hasText: /^सेटअप$/ }).first().click();
  await page.waitForTimeout(800);
  await page.locator('button, div[role="button"]', { hasText: /^भाषा र स्थानीयकरण$/ }).first().click();
  await page.waitForTimeout(3000);

  // Verify the 3 cards render
  const card1 = await page.locator('h3', { hasText: 'Language & Interface Configuration' }).count();
  const card2 = await page.locator('h3', { hasText: 'Calendar & Date Formats' }).count();
  const card3 = await page.locator('h3', { hasText: 'Number & Currency Localization' }).count();
  console.log('Cards visible:', { card1, card2, card3 });

  // Nepali should be ACTIVE by default (loaded from server: ne)
  const neActive = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cardBtn = btns.find(b => (b.textContent || '').includes('नेपाली') && (b.className || '').includes('border-emerald-600'));
    return !!cardBtn;
  });
  console.log('Nepali active on load:', neActive);

  // 3. Transliteration live demo — type an English name, expect Devanagari
  await page.locator('input[placeholder="e.g. Ram Prasad Sharma"]').fill('Suresh Chandra Singh');
  await page.waitForTimeout(300);
  const translitPreview = await page.locator('text=सुरेश चन्द्र सिंह').count();
  console.log('Transliteration live preview renders Devanagari:', translitPreview > 0);

  // Click English
  await page.locator('button', { hasText: /English/ }).first().click();
  await page.waitForTimeout(300);

  // Select AD calendar
  await page.locator('button', { hasText: /Anno Domini/ }).first().click();
  await page.waitForTimeout(300);

  // Change date format
  await page.locator('select.w-full.sm\\:max-w-\\[280px\\]').selectOption('DD/MM/YYYY');
  await page.waitForTimeout(200);

  // Select US grouping
  await page.locator('button', { hasText: /Millions \/ Billions/ }).first().click();
  await page.waitForTimeout(200);

  // Currency symbol + suffix
  await page.locator('input[placeholder="रु."]').fill('Rs.');
  await page.locator('button', { hasText: '1,000 रु.' }).first().click();
  await page.waitForTimeout(300);

  // Live preview check
  const previewTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('span.font-mono.font-bold.text-emerald-800')).map(e => (e.textContent || '').trim()));
  console.log('Preview values:', JSON.stringify(previewTexts));

  // Save
  await page.locator('button', { hasText: 'Save Localization Settings' }).first().click();
  await page.waitForTimeout(3000);

  const toast = await page.locator('[aria-live="polite"]').innerText();
  console.log('Toast:', JSON.stringify(toast));

  // ── Immediate application check (no page reload) ──────────────────────
  // After saving English as default language, the header toggle must show EN
  // active and the footer must already show English chrome + Rs. suffix.
  const enActiveHeader = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some(b => (b.textContent || '').trim() === 'EN' && (b.className || '').includes('bg-emerald-600'));
  });
  console.log('Header EN toggle active immediately after save:', enActiveHeader);

  const footerText = await page.evaluate(() => {
    const f = document.querySelector('footer');
    return f ? (f.textContent || '') : '';
  });
  console.log('Footer shows English chrome immediately:', footerText.includes('Last Txn:'));
  console.log('Footer currency uses Rs. suffix immediately:', footerText.includes('Rs.') && !footerText.includes('रु.'));

  await page.screenshot({ path: 'C:\\Users\\somth\\AppData\\Local\\Temp\\opencode\\localization-screen.png', fullPage: true });

  console.log('PAGE ERRORS:', pageErrors.length ? JSON.stringify(pageErrors) : 'none');
  console.log('CONSOLE ERRORS:', consoleErrs.length ? JSON.stringify(consoleErrs) : 'none');
  await browser.close();
})();
