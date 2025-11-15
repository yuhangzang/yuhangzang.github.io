// Shared JavaScript for yuhangzang.github.io
// Common functionality across all pages

// Constants - only define if not already defined by inline scripts
if (typeof colorSchemeQuery === 'undefined') {
    var colorSchemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}
if (typeof motionPreferenceQuery === 'undefined') {
    var motionPreferenceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
}
if (typeof prefersReducedData === 'undefined') {
    var prefersReducedData = typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData;
}
if (typeof CACHE_DEFAULT_MAX_AGE === 'undefined') {
    var CACHE_DEFAULT_MAX_AGE = 6 * 60 * 60 * 1000; // 6 hours
}

// Session cache implementation - only define if not already defined
if (typeof sessionCache === 'undefined') {
    var sessionCache = (() => {
        try {
            const storage = window.sessionStorage;
            const testKey = '__cache_test__';
            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return {
                get(key, maxAgeMs = CACHE_DEFAULT_MAX_AGE) {
                    try {
                        const raw = storage.getItem(key);
                        if (!raw) {
                            return null;
                        }
                        const parsed = JSON.parse(raw);
                        if (!parsed || typeof parsed.timestamp !== 'number') {
                            storage.removeItem(key);
                            return null;
                        }
                        if (Date.now() - parsed.timestamp > maxAgeMs) {
                            storage.removeItem(key);
                            return null;
                        }
                        return parsed.value;
                    } catch (storageError) {
                        storage.removeItem(key);
                        return null;
                    }
                },
                set(key, value) {
                    try {
                        storage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
                    } catch (setError) {
                        // Ignore storage quota or serialization errors
                    }
                }
            };
        } catch (error) {
            return {
                get() { return null; },
                set() {}
            };
        }
    })();
}

// Utility functions - only define if not already defined
if (typeof shouldReduceMotion === 'undefined') {
    var shouldReduceMotion = function() {
        return motionPreferenceQuery ? motionPreferenceQuery.matches : false;
    };
}

// Lazy-assemble email links to reduce harvesting
function openEmail(event) {
    const link = event.currentTarget;
    if (!link) {
        return;
    }

    const user = link.getAttribute('data-user');
    const domain = link.getAttribute('data-domain');
    if (!user || !domain) {
        return;
    }

    const address = `${user}@${domain}`;
    const mailto = `mailto:${address}`;
    link.setAttribute('href', mailto);
    link.removeAttribute('onclick');
    link.removeAttribute('data-user');
    link.removeAttribute('data-domain');
    window.location.href = mailto;
}

// Dark mode functionality
function toggleTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    if (!themeToggle || !themeIcon) return;

    if (html.getAttribute('data-theme') === 'dark') {
        html.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        localStorage.setItem('theme', 'light');
        themeToggle.setAttribute('aria-pressed', 'false');
    } else {
        html.setAttribute('data-theme', 'dark');
        themeIcon.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
        themeToggle.setAttribute('aria-pressed', 'true');
    }
}

// Auto detect system preference and apply saved theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = colorSchemeQuery ? colorSchemeQuery.matches : false;
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle?.querySelector('.theme-icon');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', 'true');
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', 'false');
    }
}

// Listen for system theme changes
function handleSystemThemeChange(e) {
    if (localStorage.getItem('theme')) {
        return;
    }

    const themeIcon = document.querySelector('.theme-icon');
    const themeToggle = document.getElementById('theme-toggle');
    if (e.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', 'true');
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeToggle) themeToggle.setAttribute('aria-pressed', 'false');
    }
}

// Mobile menu toggle functionality
function toggleMobileMenu(targetButton) {
    const navMenu = document.getElementById('nav-menu');
    const mobileToggle = targetButton || document.querySelector('.mobile-menu-toggle');
    if (!navMenu || !mobileToggle) {
        return;
    }

    const isOpen = navMenu.classList.toggle('active');
    mobileToggle.classList.toggle('active', isOpen);
    mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    navMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

// Back to Top Button functionality
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: shouldReduceMotion() ? 'auto' : 'smooth'
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();

    // Set up theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Cache DOM elements used multiple times
    const navMenu = document.getElementById('nav-menu');
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');

    // Set up mobile menu toggle button
    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            toggleMobileMenu(this);
        });
    }

    // Set up back to top button
    const backToTopBtn = document.querySelector('.back-to-top-btn');
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', scrollToTop);
    }

    // Set up email links
    const emailLinks = document.querySelectorAll('.social-link.email[data-user][data-domain]');
    emailLinks.forEach(link => {
        link.addEventListener('click', openEmail);
    });

    // Set up theme change listener
    if (colorSchemeQuery) {
        if (typeof colorSchemeQuery.addEventListener === 'function') {
            colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
        } else if (typeof colorSchemeQuery.addListener === 'function') {
            colorSchemeQuery.addListener(handleSystemThemeChange);
        }
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!navMenu || !mobileToggle || !mainNav) {
            return;
        }

        if (!mainNav.contains(event.target) && navMenu.classList.contains('active')) {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
            mobileToggle.setAttribute('aria-expanded', 'false');
            navMenu.setAttribute('aria-hidden', 'true');
        }
    });

    // Close mobile menu when clicking on nav links
    const navLinks = document.querySelectorAll('.nav-link');
    if (navMenu && mobileToggle) {
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                mobileToggle.classList.remove('active');
                mobileToggle.setAttribute('aria-expanded', 'false');
                navMenu.setAttribute('aria-hidden', 'true');
            });
        });
    }

    // Show/hide back to top button based on scroll position
    window.addEventListener('scroll', function() {
        const backToTopBtn = document.querySelector('.back-to-top-btn');
        if (backToTopBtn) {
            if (window.pageYOffset > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        }
    });
});
