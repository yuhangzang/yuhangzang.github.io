import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests', testMatch: '**/*.spec.js',
    fullyParallel: false, workers: 1, timeout: 20000,
    use: {
        baseURL: 'http://127.0.0.1:8765',
        viewport: { width: 1280, height: 800 },
        reducedMotion: 'reduce',
        launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
            ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } : {},
        screenshot: 'only-on-failure', trace: 'retain-on-failure'
    },
    webServer: {
        command: 'python3 -m http.server 8765 --bind 127.0.0.1',
        url: 'http://127.0.0.1:8765', reuseExistingServer: !process.env.CI
    }
});
