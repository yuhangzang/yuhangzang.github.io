import { sessionCache } from './cache.js';

const HOUR = 60 * 60 * 1000;
const SCHOLAR_URL = 'https://raw.githubusercontent.com/yuhangzang/asset/refs/heads/google-scholar/gs_data.json';
const requests = new Map();
const queue = [];
let active = 0;

// Bound optional requests, including fast scrolling through a long publication list.
function schedule(task) {
    return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drain();
    });
}
function drain() {
    while (active < 4 && queue.length) {
        const { task, resolve, reject } = queue.shift();
        active++;
        Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; drain(); });
    }
}
async function fetchJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally { clearTimeout(timer); }
}
function cachedRequest(key, age, task) {
    const cached = sessionCache.get(key, age);
    if (cached !== null) return Promise.resolve(cached);
    if (!requests.has(key)) {
        const request = schedule(task).then(value => {
            sessionCache.set(key, value);
            return value;
        });
        requests.set(key, request);
    }
    return requests.get(key);
}
function formatStarCount(count) {
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}
async function getStars(repo) {
    return cachedRequest(`cache:github-stars:${repo}`, 3 * HOUR, async () => {
        try {
            const data = await fetchJSON(`https://api.github.com/repos/${repo}`);
            if (!Number.isFinite(data.stargazers_count)) throw new Error('Invalid star count');
            return data.stargazers_count;
        } catch {
            const data = await fetchJSON(`https://img.shields.io/github/stars/${repo}.json`);
            const match = String(data.value).trim().match(/^([\d,.]+)\s*([km]?)$/i);
            if (!match) throw new Error('Invalid badge count');
            const multiplier = { k: 1000, m: 1000000 }[match[2].toLowerCase()] || 1;
            const count = Number(match[1].replaceAll(',', '')) * multiplier;
            if (!Number.isFinite(count)) throw new Error('Invalid badge count');
            return Math.round(count);
        }
    });
}

export function initMetrics(container) {
    const citations = [...container.querySelectorAll('.show_paper_citations')];
    const stars = [...container.querySelectorAll('.github-btn[data-repo]')];
    const reduceData = navigator.connection?.saveData;
    citations.forEach(element => { element.textContent = '--'; });
    stars.forEach(button => { button.querySelector('.star-count').textContent = '--'; });
    if (reduceData) return;

    let citationsStarted = false;
    function loadCitations() {
        if (citationsStarted) return;
        citationsStarted = true;
        cachedRequest('cache:gs-data:v1', 6 * HOUR, async () => {
            const data = await fetchJSON(SCHOLAR_URL);
            if (!Array.isArray(data.publications)) throw new Error('Invalid citation data');
            return data;
        }).then(data => {
            const counts = new Map(data.publications.map(publication => [publication.key, publication.citations]));
            citations.forEach(element => {
                const count = counts.get(element.getAttribute('data')) ?? 0;
                element.textContent = Number.isFinite(Number(count)) ? String(count) : '--';
            });
        }).catch(() => {
            citations.forEach(element => { element.title = 'Citation count unavailable'; });
        });
    }
    const loaded = new WeakSet();
    function loadStars(button) {
        if (loaded.has(button)) return;
        loaded.add(button);
        const label = button.querySelector('.star-count');
        getStars(button.dataset.repo).then(count => { label.textContent = formatStarCount(count); })
            .catch(() => { label.title = 'Star count unavailable'; });
    }
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                if (entry.target.matches('.github-btn')) loadStars(entry.target);
                else loadCitations();
            });
        }, { rootMargin: '200px 0px' });
        citations.forEach(element => observer.observe(element));
        stars.forEach(button => observer.observe(button));
    } else {
        // Preserve demand-based loading without IntersectionObserver.
        const pending = new Set([...citations, ...stars]);
        let frame = 0;
        function check() {
            frame = 0;
            pending.forEach(element => {
                if (!element.getClientRects().length) return;
                const rect = element.getBoundingClientRect();
                if (rect.top > innerHeight + 200 || rect.bottom < -200) return;
                pending.delete(element);
                if (element.matches('.github-btn')) loadStars(element);
                else loadCitations();
            });
        }
        const requestCheck = () => { if (!frame) frame = requestAnimationFrame(check); };
        window.addEventListener('scroll', requestCheck, { passive: true });
        window.addEventListener('resize', requestCheck);
        new MutationObserver(requestCheck).observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
        requestCheck();
    }
}
