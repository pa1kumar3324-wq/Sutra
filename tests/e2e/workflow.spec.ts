// Playwright end-to-end tests. They need a running app + a seeded DEVELOPMENT Supabase project:
//   E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD, E2E_TEACHER_EMAIL/E2E_TEACHER_PASSWORD (see docs/TESTING.md)
import { expect, test, type Page } from '@playwright/test';

const e = process.env;
const creds = e.E2E_ADMIN_EMAIL && e.E2E_ADMIN_PASSWORD && e.E2E_TEACHER_EMAIL && e.E2E_TEACHER_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('anonymous users are sent to login', async ({ page }) => {
  await page.goto('/teacher/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/admin/students');
  await expect(page).toHaveURL(/\/login/);
});

test.describe('teacher workflow', () => {
  test.skip(!creds, 'needs E2E credentials');

  test('assess a class: understood / needs revision / did not understand, persisted after reload', async ({ page }) => {
    await login(page, e.E2E_TEACHER_EMAIL!, e.E2E_TEACHER_PASSWORD!);
    await page.getByRole('link', { name: /Grade/ }).first().click();
    await page.getByRole('link', { name: 'Start a session' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Start session' }).click();

    // Attendance. "Mark all present" only asks for confirmation when a choice has already been made
    // (it would replace it), so make one choice first: mark the first student Absent.
    const attendanceRows = page.getByRole('group', { name: /^Attendance for / });
    await expect(attendanceRows.first()).toBeVisible();   // wait for the page: count() does not auto-wait
    const studentCount = await attendanceRows.count();
    expect(studentCount, 'the seeded class needs at least 3 students').toBeGreaterThanOrEqual(3);
    await attendanceRows.first().getByRole('button', { name: 'Absent', exact: true }).click();
    await page.getByRole('button', { name: 'Mark all present' }).click();
    const confirm = page.getByRole('dialog', { name: 'Set everyone to Present?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Set all to Present', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole('button', { name: 'Present', exact: true, pressed: true })).toHaveCount(studentCount);
    await expect(page.getByRole('button', { name: 'Absent', exact: true, pressed: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save attendance' }).click();
    await expect(page.getByText(new RegExp(`Saved ${studentCount} students?\\.`))).toBeVisible();
    await page.getByRole('link', { name: /assess understanding/ }).click();

    // Assessment. The page also contains <details> elements (the "Add a short note" disclosure and the
    // "To finish" list), which have the ARIA role "group" too, so select only the outcome groups:
    // the ones that contain the "Understood" button.
    const groups = page.getByRole('group').filter({ has: page.getByRole('button', { name: 'Understood', exact: true }) });
    await expect(groups.first()).toBeVisible();           // wait for the page: count() does not auto-wait
    expect(await groups.count()).toBeGreaterThanOrEqual(3);
    await groups.nth(0).getByRole('button', { name: 'Understood', exact: true }).click();
    await groups.nth(1).getByRole('button', { name: 'Needs Revision', exact: true }).click();
    await groups.nth(2).getByRole('button', { name: "Didn't Understand", exact: true }).click();
    await page.getByRole('button', { name: 'Save now' }).click();
    await expect(page.getByText(/Saved at/)).toBeVisible();
    await page.reload();
    await expect(groups.nth(0).getByRole('button', { name: 'Understood', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(groups.nth(1).getByRole('button', { name: 'Needs Revision', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(groups.nth(2).getByRole('button', { name: "Didn't Understand", exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('teacher cannot open admin pages', async ({ page }) => {
    await login(page, e.E2E_TEACHER_EMAIL!, e.E2E_TEACHER_PASSWORD!);
    await page.goto('/admin/students');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});
