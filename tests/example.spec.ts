import { test, expect } from '@playwright/test';

// Simple smoke tests for your main flows

test('home page loads and shows hero', async ({ page }) => {
  await page.goto('/');

  // Check hero heading text from app/page.js translations
  // We just assert that some hero text is visible on the page
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('hjem page shows intro content', async ({ page }) => {
  await page.goto('/hjem');

  await expect(page.getByText('Friluftsliv starter her')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kom i gang' })).toBeVisible();
});

test('login page renders form fields', async ({ page }) => {
  await page.goto('/login');

  // Use input types so this works across languages/translations
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('unauthenticated profile redirects to login', async ({ page }) => {
  // Start with a clean context – Playwright gives a fresh browser context per test
  const response = await page.goto('/profile');

  // Either we get a direct redirect response or the login page ends up rendered
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/login/);
});

test('user can sign up, log in, and see profile', async ({ page }) => {
  const timestamp = Date.now();
  const email = `playwright+${timestamp}@example.com`;
  const password = 'Test1234!';
  const username = `PlaywrightUser${timestamp}`;

  // Sign up via the UI
  await page.goto('/signup');

  await page.locator('input[type="text"]').fill(username);
  await page.locator('input[type="email"]').fill(email);

  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(password);
  await passwordInputs.nth(1).fill(password);

  await page.locator('button[type="submit"]').click();

  // After successful signup the page should navigate back to home
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/?$/);

  // Log in with the same credentials (signup API does not create a session cookie)
  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/?$/);

  // Now visit profile – we should stay on /profile and see profile UI
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');

  // Confirm we are not redirected back to login
  await expect(page).not.toHaveURL(/login/);

  // Check for a known profile element (sidebar category Sosial)
  await expect(page.getByText('Sosial')).toBeVisible();
});
