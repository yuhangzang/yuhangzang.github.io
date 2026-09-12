const topics = [
    'Reinforcement Learning from Human Feedback', 'Multimodal Large Language Models',
    'Vision-Language Models', 'Image Understanding', 'AIGC'
];
const venues = ['ICML', 'NeurIPS', 'ICLR', 'ACL', 'EMNLP', 'IJCV', 'TIP', 'TMLR',
    'CVPR', 'ICCV', 'ECCV', 'AAAI', 'ACM MM', 'arXiv', 'Thesis'];
const groupId = (type, value) => `${type}-${value.replace(/\s+/g, '-').toLowerCase()}`;

export function initPaperList(container) {
    const section = container.closest('.papers-section');
    const papers = Array.from(container.querySelectorAll('.paper-card'));
    const limit = Number(container.dataset.limit) || Infinity;
    const toggle = section.querySelector('#toggle-papers');
    const more = section.querySelector('.show-more-container');
    const search = section.querySelector('#paper-search');
    const clear = section.querySelector('#clear-search');
    const result = section.querySelector('#search-results-count');
    let expanded = false;
    let ordered = papers;
    let query = '';

    // Index content once; exclude live counters and citation buttons from search.
    const searchText = new Map(papers.map(paper => [paper, [
        paper.querySelector('papertitle')?.textContent,
        paper.querySelector('.author-names')?.textContent,
        paper.querySelector('.paper-venue')?.textContent,
        paper.dataset.year, paper.dataset.topic
    ].join(' ').toLowerCase()]));

    function updateVisibility() {
        let matches = 0;
        for (const paper of ordered) {
            const match = searchText.get(paper).includes(query);
            if (match) matches++;
            paper.hidden = !match || (!query && !expanded && matches > limit);
        }
        let header = null;
        for (const child of container.children) {
            if (!child.classList.contains('paper-card')) {
                header = child;
                header.hidden = true;
            } else if (!child.hidden && header) {
                header.hidden = false;
            }
        }
        if (result) result.textContent = query ? `${matches} of ${papers.length}` : '';
        if (clear) clear.style.display = query ? 'block' : 'none';
        if (more) more.style.display = papers.length > limit && !query ? 'flex' : 'none';
        if (toggle) {
            toggle.textContent = expanded ? `Show Less (${papers.length})` : `Show More (${Math.max(0, papers.length - limit)})`;
            toggle.classList.toggle('showing-all', expanded);
            toggle.setAttribute('aria-expanded', String(expanded));
            toggle.setAttribute('aria-controls', container.id);
        }
    }
    function sort(type) {
        if (!['date', 'topic', 'venue'].includes(type)) return;
        const field = type === 'date' ? 'year' : type;
        const order = type === 'topic' ? topics : venues;
        const rank = value => order.includes(value) ? order.indexOf(value) : order.length;
        ordered = [...papers].sort((a, b) => {
            if (field !== 'year' && a.dataset[field] !== b.dataset[field]) {
                return rank(a.dataset[field]) - rank(b.dataset[field]) || a.dataset[field].localeCompare(b.dataset[field]);
            }
            return Number(b.dataset.year) - Number(a.dataset.year);
        });
        const fragment = document.createDocumentFragment();
        let current;
        for (const paper of ordered) {
            const value = paper.dataset[field];
            if (value !== current) {
                const header = document.createElement('div');
                header.className = `${field}-header`;
                header.id = groupId(field, value);
                header.textContent = value;
                fragment.append(header);
                current = value;
            }
            fragment.append(paper);
        }
        container.replaceChildren(fragment);
        section.querySelectorAll('.sort-btn').forEach(button => {
            const active = button.dataset.sortType === type;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        updateVisibility();
    }
    for (const [selector, field] of [['.date-link', 'year'], ['.topic-link', 'topic'], ['.venue-link', 'venue']]) {
        section.querySelectorAll(selector).forEach(link => {
            const value = link.dataset[field];
            const count = papers.filter(paper => paper.dataset[field] === value).length;
            link.textContent = `${value} (${count})`;
            link.addEventListener('click', event => {
                event.preventDefault();
                expanded = true;
                query = '';
                if (search) search.value = '';
                sort(field === 'year' ? 'date' : field);
                document.getElementById(groupId(field, value))?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                    block: 'start'
                });
            });
        });
    }
    section.querySelectorAll('.sort-btn').forEach(button => {
        button.addEventListener('click', () => sort(button.dataset.sortType));
    });
    toggle?.addEventListener('click', () => {
        expanded = !expanded;
        updateVisibility();
        if (!expanded) section.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'
        });
    });
    search?.addEventListener('input', () => {
        query = search.value.toLowerCase().trim();
        updateVisibility();
    });
    function clearSearch() {
        search.value = '';
        query = '';
        updateVisibility();
        search.focus();
    }
    clear?.addEventListener('click', clearSearch);
    search?.addEventListener('keydown', event => {
        if (event.key === 'Escape') clearSearch();
    });
    updateVisibility();
}
