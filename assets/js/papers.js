const topics = [
    'Reinforcement Learning from Human Feedback', 'Multimodal Large Language Models',
    'Vision-Language Models', 'Image Understanding', 'AIGC'
];
const venues = ['ICML', 'NeurIPS', 'ICLR', 'ACL', 'EMNLP', 'IJCV', 'TIP', 'TMLR',
    'CVPR', 'ICCV', 'ECCV', 'AAAI', 'ACM MM', 'arXiv', 'Thesis'];

export function initPaperList(container) {
    const section = container.closest('.papers-section');
    const papers = Array.from(container.querySelectorAll('.paper-card'));
    const scopeButtons = Array.from(section.querySelectorAll('.scope-btn'));
    let ordered = papers;
    // "selected" keeps first- or last-author papers (data-selected); pages without the control show everything.
    let scope = scopeButtons.find(button => button.classList.contains('active'))?.dataset.scope || 'full';
    const inScope = paper => scope === 'full' || paper.dataset.selected === 'true';
    const scopeCount = value => papers.filter(paper => value === 'full' || paper.dataset.selected === 'true').length;
    scopeButtons.forEach(button => {
        button.textContent = `${button.textContent.trim()} (${scopeCount(button.dataset.scope)})`;
    });

    function updateVisibility() {
        for (const paper of ordered) paper.hidden = !inScope(paper);
        let header = null;
        for (const child of container.children) {
            if (!child.classList.contains('paper-card')) {
                header = child;
                header.hidden = true;
            } else if (!child.hidden && header) {
                header.hidden = false;
            }
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
                header.textContent = value;
                fragment.append(header);
                current = value;
            }
            fragment.append(paper);
        }
        container.replaceChildren(fragment);
        section.querySelectorAll('.sort-btn[data-sort-type]').forEach(button => {
            const active = button.dataset.sortType === type;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        updateVisibility();
    }
    function setScope(value) {
        if (!['selected', 'full'].includes(value)) return;
        scope = value;
        scopeButtons.forEach(button => {
            const active = button.dataset.scope === value;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        updateVisibility();
    }
    section.querySelectorAll('.sort-btn[data-sort-type]').forEach(button => {
        button.addEventListener('click', () => sort(button.dataset.sortType));
    });
    scopeButtons.forEach(button => {
        button.addEventListener('click', () => setScope(button.dataset.scope));
    });
    // Group the list on load using the sort button marked active in the markup (date on the publications page).
    const initialSort = section.querySelector('.sort-btn[data-sort-type].active')?.dataset.sortType;
    if (initialSort) sort(initialSort);
    else updateVisibility();
}
