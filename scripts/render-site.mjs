// The home page, publication list and paper pages share the same navigation.
export function renderSiteNavigation(prefix = './', active = 'publications', current = 'page') {
    const link = (key, path, label) => `<a href="${prefix}${path}" class="nav-link${active === key ? ' active' : ''}"${active === key ? ` aria-current="${current}"` : ''}>${label}</a>`;
    return `<nav class="main-nav" aria-label="Main navigation">
    <div class="nav-container">
      <div class="nav-brand">
        <a href="${prefix}index.html" class="brand-link">Yuhang Zang</a>
      </div>
      <button class="mobile-menu-toggle" type="button" aria-label="Toggle navigation menu" aria-controls="nav-menu" aria-expanded="false">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
      <div class="nav-menu" id="nav-menu" aria-hidden="true">
        ${link('home', 'index.html', 'Home')}
        ${link('publications', 'research.html', 'Publications')}
        ${link('services', 'index.html#services', 'Services')}
        <button id="theme-toggle" class="theme-toggle" type="button" title="Toggle dark mode" aria-label="Toggle dark mode" aria-pressed="false">
          <span class="theme-icon">🌙</span>
        </button>
      </div>
    </div>
  </nav>`;
}
