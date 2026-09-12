import { test, expect } from '@playwright/test';

const isMetrics = url => /api.github.com|img.shields.io|gs_data\.json/.test(url);

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => { throw error; });
    // Keep tests deterministic and independent of font/CDN/API availability.
    await page.route('https://**/*', async route => {
        const url = route.request().url();
        if (url.includes('api.github.com')) return route.fulfill({ json: { stargazers_count: 1234 } });
        if (url.includes('gs_data.json')) return route.fulfill({ json: { publications: [] } });
        if (url.includes('img.shields.io')) return route.fulfill({ json: { value: '1.2k' } });
        return route.fulfill({ body: '', contentType: 'text/css' });
    });
});

test('home keeps five selected papers and supports sorting, expansion and group navigation', async ({ page }) => {
    await page.goto('/');
    const visible = page.locator('.paper-card:visible');
    const total = await page.locator('.paper-card').count();
    await expect(visible).toHaveCount(5);
    await page.locator('[data-sort-type="topic"]').click();
    await expect(visible).toHaveCount(5);
    const topics = await visible.evaluateAll(cards => [...new Set(cards.map(card => card.dataset.topic))]);
    await expect(page.locator('.topic-header:visible')).toHaveText(topics);
    await page.locator('#toggle-papers').click();
    await expect(visible).toHaveCount(total);
    await page.locator('#toggle-papers').click();
    await expect(visible).toHaveCount(5);
    await page.locator('.date-link[data-year="2024"]').click();
    await expect(visible).toHaveCount(total);
    await expect(page.locator('#year-2024')).toBeInViewport();
    await expect(page.locator('#toggle-papers')).toHaveAttribute('aria-expanded', 'true');
});

test('search survives each sort and clearing restores all publications', async ({ page }) => {
    await page.goto('/research.html');
    const total = await page.locator('.paper-card').count();
    const input = page.locator('#paper-search');
    await input.fill('EndoCoT');
    await expect(page.locator('.paper-card:visible')).toHaveCount(1);
    for (const sort of ['topic', 'venue', 'date']) {
        await page.locator(`[data-sort-type="${sort}"]`).click();
        await expect(page.locator('.paper-card:visible')).toHaveCount(1);
        await expect(page.locator('.year-header:visible, .topic-header:visible, .venue-header:visible')).toHaveCount(1);
    }
    await input.fill('no-such-paper-xyz');
    await expect(page.locator('.paper-card:visible')).toHaveCount(0);
    await expect(page.locator('.year-header:visible')).toHaveCount(0);
    await page.locator('#clear-search').click();
    await expect(page.locator('.paper-card:visible')).toHaveCount(total);
    await input.fill('EndoCoT');
    await input.press('Escape');
    await expect(page.locator('.paper-card:visible')).toHaveCount(total);
});

test('BibTeX works after reordering without duplicate buttons and downloads the displayed content', async ({ page }) => {
    await page.goto('/research.html');
    await page.locator('[data-sort-type="venue"]').click();
    const total = await page.locator('.paper-card').count();
    await expect(page.locator('.bibtex-btn')).toHaveCount(total);
    const button = page.locator('.bibtex-btn').first();
    const title = await page.locator('.paper-card').first().locator('papertitle').textContent();
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#bibtex-content')).toContainText(title.trim());
    const downloaded = page.waitForEvent('download');
    await page.locator('#bibtex-download').click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.bib$/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(button).toBeFocused();
});

test('theme and mobile menu work when browser storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
        for (const key of ['localStorage', 'sessionStorage']) {
            Object.defineProperty(window, key, { get() { throw new DOMException('Blocked', 'SecurityError'); } });
        }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const menu = page.locator('.mobile-menu-toggle');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('#nav-menu')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await expect(page.locator('.paper-card:visible')).toHaveCount(5);
});

test('metrics stay idle above the publications, then load once and reuse cache', async ({ page }) => {
    const requests = [];
    page.on('request', request => { if (isMetrics(request.url())) requests.push(request.url()); });
    await page.goto('/');
    // The old idle fallback fired after at most two seconds, even for hidden cards.
    await page.waitForTimeout(2400);
    expect(requests).toHaveLength(0);
    const star = page.locator('.paper-card:visible .github-btn').first();
    await star.scrollIntoViewIfNeeded();
    await expect(star.locator('.star-count')).toHaveText('1.2k');
    expect(requests.filter(url => url.includes('gs_data.json'))).toHaveLength(1);
    const repo = await star.getAttribute('data-repo');
    const before = requests.filter(url => url.endsWith(repo)).length;
    await page.reload();
    await page.locator(`.github-btn[data-repo="${repo}"]`).first().scrollIntoViewIfNeeded();
    await expect(page.locator(`.github-btn[data-repo="${repo}"] .star-count`).first()).toHaveText('1.2k');
    expect(requests.filter(url => url.endsWith(repo))).toHaveLength(before);
});

test('data saver skips optional metrics while retaining interactions', async ({ page }) => {
    const requests = [];
    page.on('request', request => { if (isMetrics(request.url())) requests.push(request.url()); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
    await page.goto('/research.html');
    await page.locator('[data-sort-type="venue"]').click();
    await page.locator('.github-btn').first().scrollIntoViewIfNeeded();
    await expect(page.locator('.star-count').first()).toHaveText('--');
    expect(requests).toHaveLength(0);
});

test('API failures show unavailable counts and do not break search or BibTeX', async ({ page }) => {
    await page.route(/api.github.com|img.shields.io|gs_data\.json/, route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto('/research.html');
    const star = page.locator('.github-btn').first();
    await star.scrollIntoViewIfNeeded();
    await expect(star.locator('.star-count')).toHaveAttribute('title', 'Star count unavailable');
    await page.locator('#paper-search').fill('EndoCoT');
    await expect(page.locator('.paper-card:visible')).toHaveCount(1);
    await page.locator('.paper-card:visible .bibtex-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
});

test('without IntersectionObserver only visible metrics are loaded', async ({ page }) => {
    await page.addInitScript(() => { delete window.IntersectionObserver; });
    const requests = [];
    page.on('request', request => { if (isMetrics(request.url())) requests.push(request.url()); });
    await page.goto('/');
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(0);
    const star = page.locator('.paper-card:visible .github-btn').first();
    await star.scrollIntoViewIfNeeded();
    await expect(star.locator('.star-count')).toHaveText('1.2k');
});

test('static content and navigation remain readable without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.goto('http://127.0.0.1:8765/research.html');
    await expect(page.locator('papertitle').first()).toBeVisible();
    await expect(page.locator('.nav-link', { hasText: 'Home' })).toBeVisible();
    await context.close();
});

test('404 uses only the site UI and retains its navigation', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/404.html');
    await expect(page.locator('#nav-menu')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(requests.some(url => url.includes('publications.min.js'))).toBe(false);
});

test('rapidly exposing all metrics deduplicates repositories and limits concurrent requests', async ({ page }) => {
    await page.addInitScript(() => {
        window.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; }
            observe(target) { queueMicrotask(() => this.callback([{ target, isIntersecting: true }])); }
            unobserve() {}
        };
    });
    let active = 0;
    let peak = 0;
    const calls = [];
    await page.route(/api.github.com|gs_data\.json/, async route => {
        const url = route.request().url();
        calls.push(url);
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 50));
        await route.fulfill({ json: url.includes('gs_data') ? { publications: [] } : { stargazers_count: 1234 } });
        active--;
    });
    await page.goto('/research.html');
    await expect.poll(async () => page.locator('.star-count').allTextContents()).not.toContain('--');
    const uniqueRepos = await page.locator('.github-btn').evaluateAll(buttons => new Set(buttons.map(button => button.dataset.repo)).size);
    expect(calls.filter(url => url.includes('api.github.com'))).toHaveLength(uniqueRepos);
    expect(peak).toBeLessThanOrEqual(4);
});
