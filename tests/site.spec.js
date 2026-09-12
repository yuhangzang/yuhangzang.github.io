import { test, expect } from '@playwright/test';

const isMetrics = url => /api.github.com|img.shields.io|gs_data\.json/.test(url);

for (const javaScriptEnabled of [true, false]) {
    test.describe(`local files with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, () => {
        test.use({ javaScriptEnabled });
        test('publication links, styles and return navigation stay inside the project', async ({ page }) => {
            const local = path => new URL(`../${path}`, import.meta.url).href;
            for (const entry of ['index.html', 'research.html']) {
                await page.goto(local(entry));
                await page.locator('[data-paper-id="arxiv:2603.12252"] .paper-title-link').click();
                await expect(page).toHaveURL(local('papers/arxiv-2603.12252.html'));
                await expect(page.locator('h1')).toContainText('EndoCoT');
                await expect.poll(() => page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/main.min.css')))).toBe(true);
                if (javaScriptEnabled) {
                    const toggle = page.getByRole('button', { name: 'Toggle dark mode' });
                    const wasPressed = await toggle.getAttribute('aria-pressed');
                    await toggle.click();
                    await expect(toggle).toHaveAttribute('aria-pressed', wasPressed === 'true' ? 'false' : 'true');
                }
                await page.getByRole('link', { name: 'Yuhang Zang', exact: true }).click();
                await expect(page).toHaveURL(local('index.html'));
            }
            await page.goto(local('papers/arxiv-2503.01785.html'));
            const download = page.getByRole('link', { name: 'Download BibTeX' });
            expect(await download.evaluate(link => link.href)).toBe(local('papers/arxiv-2503.01785.bib'));
            await expect(page.locator('.paper-bibtex')).toContainText('Liu_2025_ICCV');
            await page.getByRole('link', { name: '← All publications' }).click();
            await expect(page).toHaveURL(local('research.html'));
        });
    });
}

test.describe('individual publication pages', () => {
    test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    test('paper pages are reachable and readable on mobile without JavaScript', async ({ page }) => {
        await page.goto('/research.html');
        await page.locator('[data-paper-id="arxiv:2503.01785"] .paper-title-link').click();
        await expect(page).toHaveURL(/\/papers\/arxiv-2503\.01785\.html$/);
        await expect(page.locator('h1')).toContainText('Visual-RFT');
        await expect(page.locator('.paper-corresponding')).toHaveCount(2);
        await expect(page.locator('meta[name="citation_author"]')).toHaveCount(8);
        await expect(page.locator('#abstract-heading')).toBeVisible();
        await expect(page.locator('.paper-takeaway')).toContainText('GRPO');
        await expect(page.getByRole('heading', { name: 'Findings to cite' })).toHaveCount(0);
        await expect(page.locator('.paper-methods tbody tr')).toHaveCount(3);
        await expect(page.locator('.paper-related-card')).toHaveCount(2);
        await expect(page.locator('[data-direction="cited"] h3')).toHaveText('Cited by Visual-RFT');
        await expect(page.locator('[data-direction="citing"] h3')).toHaveText('Citations and discussion');
        await expect(page.locator('[data-direction="citing"] time')).toHaveText(['2025-03-10', '2025-05-18', '2025-05-20']);
        await expect(page.locator('[data-direction="citing"] blockquote')).toHaveCount(2);
        await expect(page.locator('[data-direction="citing"] li').first()).toContainText('Personal commentary');
        const cards = page.locator('.paper-related-card');
        await expect.poll(() => cards.evaluateAll(nodes => {
            const [left, right] = nodes.map(node => node.getBoundingClientRect());
            return right.top >= left.bottom;
        })).toBe(true);
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect.poll(() => cards.evaluateAll(nodes => {
            const [left, right] = nodes.map(node => node.getBoundingClientRect());
            return Math.abs(left.top - right.top) < 1 && right.left > left.left;
        })).toBe(true);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('.paper-results tbody tr')).toHaveCount(3);
        await expect(page.locator('.paper-results tbody tr').nth(1)).toContainText('40.6');
        await expect(page.locator('.paper-bibtex')).toContainText('2034--2044');
        await expect(page.locator('.paper-copy-button')).toBeHidden();
        const downloadEvent = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Download BibTeX' }).click();
        expect((await downloadEvent).suggestedFilename()).toBe('arxiv-2503.01785.bib');
        await expect(page.getByRole('link', { name: 'arXiv:2503.01785', exact: true })).toHaveAttribute('href', 'https://arxiv.org/abs/2503.01785');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.getByRole('link', { name: '← All publications' }).click();
        await expect(page).toHaveURL(/\/research\.html$/);
    });
    test('new benchmark, toolkit and thesis pages have complete content without JavaScript', async ({ page }) => {
        for (const [id, title] of [
            ['arxiv-2606.19338', 'Beyond the Current Observation'],
            ['arxiv-2407.11691', 'VLMEvalKit'],
            ['scholar-hW23VKIAAAAJ-eQOLeE2rZwMC', 'Real-World Object Detection']
        ]) {
            await page.goto(`/papers/${id}.html`);
            await expect(page.locator('h1')).toContainText(title);
            for (const name of ['Key takeaway', 'Abstract', 'Research problem and approach', 'Main contributions', 'Method comparison', 'Selected results', 'Cite this paper']) {
                await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            }
            await expect(page.getByRole('heading', { name: 'Related work and discussion' })).toHaveCount(0);
            await expect(page.locator('.paper-methods tbody tr')).toHaveCount(2);
            expect(await page.locator('.paper-methods').evaluate(table => table.scrollWidth <= table.parentElement.clientWidth)).toBe(true);
            await expect(page.locator('.paper-copy-button')).toBeHidden();
            const response = await page.request.get(`/papers/${id}.bib`);
            expect(response.ok()).toBe(true);
            await expect(page.locator('.paper-bibtex code')).toHaveText(await response.text());
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
        await expect(page.locator('.paper-bibtex')).toContainText('@phdthesis');
        await expect(page.locator('.paper-bibtex')).toContainText('Nanyang Technological University');
    });
});

test('paper pages reuse the theme control without fetching metrics', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto('/papers/arxiv-2603.12252.html');
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(requests.filter(isMetrics)).toEqual([]);
});

for (const arxiv of ['2503.01785', '2603.12252', '2505.03318']) {
test(`verified BibTeX ${arxiv} displays and copies identically across all three pages`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:8765' });
    const response = await page.request.get(`/papers/arxiv-${arxiv}.bib`);
    expect(response.ok()).toBe(true);
    const bibtex = await response.text();
    for (const path of ['/', '/research.html']) {
        await page.goto(path);
        await page.locator(`[data-paper-id="arxiv:${arxiv}"] .bibtex-btn`).click();
        await expect(page.locator('#bibtex-content')).toHaveText(bibtex);
        await page.locator('#bibtex-copy').click();
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(bibtex);
    }
    await page.goto(`/papers/arxiv-${arxiv}.html`);
    await expect(page.locator('.paper-bibtex code')).toHaveText(bibtex);
    await page.getByRole('button', { name: 'Copy to clipboard' }).click();
    await expect(page.getByRole('status')).toHaveText('BibTeX copied to clipboard.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(bibtex);
    await expect(page.getByRole('heading', { name: 'Scope of the evidence' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sources and versions' })).toHaveCount(0);
});
}

test('clipboard failure is reported and static citation remains available', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Blocked'); } } });
        document.execCommand = () => false;
    });
    await page.goto('/papers/arxiv-2503.01785.html');
    const button = page.getByRole('button', { name: 'Copy to clipboard' });
    await button.click();
    await expect(page.getByRole('status')).toContainText('Copy failed.');
    await expect(button).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Download BibTeX' })).toBeVisible();
    await expect(page.locator('.paper-bibtex')).toContainText('Liu_2025_ICCV');
});

test('publication search finds the same research keywords shown on the paper page', async ({ page }) => {
    await page.goto('/research.html');
    await page.getByRole('textbox', { name: 'Search publications' }).fill('Group Relative Policy Optimization');
    await expect(page.locator('.paper-card:visible')).toHaveCount(2);
    await expect(page.locator('[data-paper-id="arxiv:2603.12648"]')).toBeVisible();
    await page.locator('[data-paper-id="arxiv:2503.01785"] .paper-title-link').click();
    await expect(page.locator('.paper-keywords')).toContainText('Group Relative Policy Optimization (GRPO)');
    await page.goto('/research.html');
    await page.getByRole('textbox', { name: 'Search publications' }).fill('Storage efficiency');
    await expect(page.locator('.paper-card:visible')).toHaveCount(1);
    await page.locator('.paper-card:visible .paper-title-link').click();
    await expect(page.locator('.paper-keywords')).toContainText('Storage efficiency');
    await expect(page.locator('.paper-takeaway')).toContainText('11.8%');
});

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
