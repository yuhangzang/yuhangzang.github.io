import { initCopyButtons } from './js/clipboard.js';

function initSiteUI() {
    const themeButton = document.getElementById('theme-toggle');
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    let savedTheme = null;
    try { savedTheme = localStorage.getItem('theme'); } catch { /* Storage is optional. */ }

    function applyTheme(dark) {
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        themeButton?.setAttribute('aria-pressed', String(dark));
        const icon = themeButton?.querySelector('.theme-icon');
        if (icon) icon.textContent = dark ? '☀️' : '🌙';
    }
    applyTheme(savedTheme ? savedTheme === 'dark' : colorScheme.matches);
    themeButton?.addEventListener('click', () => {
        savedTheme = document.documentElement.hasAttribute('data-theme') ? 'light' : 'dark';
        applyTheme(savedTheme === 'dark');
        try { localStorage.setItem('theme', savedTheme); } catch { /* Keep the in-memory choice. */ }
    });
    colorScheme.addEventListener('change', event => {
        if (!savedTheme) applyTheme(event.matches);
    });

    const nav = document.querySelector('.main-nav');
    const menu = document.getElementById('nav-menu');
    const menuButton = document.querySelector('.mobile-menu-toggle');
    const mobile = window.matchMedia('(max-width: 768px)');
    function setMenu(open) {
        menu?.classList.toggle('active', open);
        menuButton?.classList.toggle('active', open);
        menuButton?.setAttribute('aria-expanded', String(open));
        menu?.setAttribute('aria-hidden', String(mobile.matches && !open));
    }
    setMenu(false);
    mobile.addEventListener('change', () => setMenu(false));
    menuButton?.addEventListener('click', () => setMenu(!menu.classList.contains('active')));
    document.addEventListener('click', event => {
        if (!nav?.contains(event.target) || event.target.closest('.nav-link')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menu?.classList.contains('active')) {
            setMenu(false);
            menuButton.focus();
        }
    });

    const backToTop = document.querySelector('.back-to-top-btn');
    if (backToTop) {
        const updateScroll = () => backToTop.classList.toggle('show', window.scrollY > 300);
        updateScroll();
        window.addEventListener('scroll', updateScroll, { passive: true });
        backToTop.addEventListener('click', () => window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        }));
    }
    document.querySelectorAll('.social-link.email[data-user][data-domain]').forEach(link => {
        link.addEventListener('click', () => {
            link.href = `mailto:${link.dataset.user}@${link.dataset.domain}`;
            delete link.dataset.user;
            delete link.dataset.domain;
        }, { once: true });
    });
}

initSiteUI();
initCopyButtons();
