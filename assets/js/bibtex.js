// Shared citation export. Paper sorting preserves the existing card nodes.
export function initBibTeX(container) {
    const venueMap = {
        'NeurIPS': { booktitle: 'NeurIPS', type: 'inproceedings' },
        'ICML': { booktitle: 'ICML', type: 'inproceedings' },
        'ICLR': { booktitle: 'ICLR', type: 'inproceedings' },
        'CVPR': { booktitle: 'CVPR', type: 'inproceedings' },
        'ICCV': { booktitle: 'ICCV', type: 'inproceedings' },
        'ECCV': { booktitle: 'ECCV', type: 'inproceedings' },
        'ACL': { booktitle: 'ACL', type: 'inproceedings' },
        'EMNLP': { booktitle: 'EMNLP', type: 'inproceedings' },
        'AAAI': { booktitle: 'AAAI', type: 'inproceedings' },
        'ACM MM': { booktitle: 'ACM MM', type: 'inproceedings' },
        'IJCV': { journal: 'IJCV', type: 'article' },
        'TIP': { journal: 'IEEE Trans. Image Processing', type: 'article' },
        'TMLR': { journal: 'Transactions on Machine Learning Research', type: 'article' },
        'arXiv': { journal: 'arXiv preprint', type: 'article' },
        'Thesis': { type: 'phdthesis' }
    };

    function generateCiteKey(title, year, authors) {
        const firstAuthor = authors.split(' and ')[0].trim().split(' ').pop().toLowerCase();
        const firstWord = title.split(/[\s:]+/)[0].toLowerCase().replace(/[^a-z]/g, '');
        return `${firstAuthor}${year}${firstWord}`;
    }

    function cleanAuthors(authorsHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = authorsHtml;
        let text = temp.textContent || temp.innerText;
        // Clean up annotations and extra spaces
        text = text.replace(/\s+/g, ' ').trim();
        // Convert to BibTeX format: "First Last and First Last and ..."
        const authorList = text.split(',').map(a => a.trim()).filter(a => a);
        return authorList.join(' and ');
    }

    function generateBibTeX(paperCard) {
        const title = paperCard.querySelector('papertitle')?.textContent?.trim() || '';
        const authorsEl = paperCard.querySelector('.author-names');
        const authors = authorsEl ? cleanAuthors(authorsEl.innerHTML) : '';
        const year = paperCard.getAttribute('data-year') || '';
        const venue = paperCard.getAttribute('data-venue') || '';
        const arxivBtn = paperCard.querySelector('.arxiv-btn');
        const arxivId = arxivBtn ? arxivBtn.textContent.replace('arXiv:', '').trim() : '';

        const venueInfo = venueMap[venue] || { booktitle: venue, type: 'inproceedings' };
        const citeKey = generateCiteKey(title, year, authors);

        let bibtex = `@${venueInfo.type}{${citeKey},\n`;
        bibtex += `  title     = {${title}},\n`;
        bibtex += `  author    = {${authors}},\n`;
        bibtex += `  year      = {${year}},\n`;

        if (venueInfo.type === 'article') {
            bibtex += `  journal   = {${venueInfo.journal}},\n`;
            if (arxivId) {
                bibtex += `  eprint    = {${arxivId}},\n`;
                bibtex += `  archivePrefix = {arXiv},\n`;
            }
        } else if (venueInfo.type === 'phdthesis') {
            bibtex += `  school    = {Nanyang Technological University},\n`;
        } else {
            bibtex += `  booktitle = {${venueInfo.booktitle}},\n`;
        }

        bibtex = bibtex.slice(0, -2) + '\n}';
        return { bibtex, citeKey };
    }

    // Add BibTeX buttons to all paper cards
    function addBibTeXButtons() {
        const paperCards = container.querySelectorAll('.paper-card');
        paperCards.forEach(card => {
            const badgesDiv = card.querySelector('.paper-badges');
            if (badgesDiv && !badgesDiv.querySelector('.bibtex-btn')) {
                const btn = document.createElement('button');
                btn.className = 'bibtex-btn';
                btn.type = 'button';
                btn.innerHTML = '<i class="fa fa-quote-right"></i> BibTeX';
                badgesDiv.appendChild(btn);
            }
        });
    }

    // Modal functionality
    const modal = document.getElementById('bibtex-modal');
    if (!modal) return;
    const modalContent = document.getElementById('bibtex-content');
    const copyBtn = document.getElementById('bibtex-copy');
    const downloadBtn = document.getElementById('bibtex-download');
    const closeBtn = modal.querySelector('.bibtex-modal-close');
    let currentBibTeX = '';
    let currentCiteKey = '';
    let returnFocus = null;

    function showBibTeXModal(paperCard) {
        const { bibtex, citeKey } = generateBibTeX(paperCard);
        returnFocus = document.activeElement;
        currentBibTeX = bibtex;
        currentCiteKey = citeKey;
        modalContent.textContent = bibtex;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copy to Clipboard';
        copyBtn.classList.remove('copied');
        closeBtn.focus();
    }

    function closeBibTeXModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        returnFocus?.focus();
    }

    closeBtn.addEventListener('click', closeBibTeXModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeBibTeXModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeBibTeXModal();
        }
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(currentBibTeX);
            copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copy to Clipboard';
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = currentBibTeX;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied!';
            copyBtn.classList.add('copied');
        }
    });

    downloadBtn.addEventListener('click', () => {
        const blob = new Blob([currentBibTeX], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentCiteKey}.bib`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    addBibTeXButtons();

    container.addEventListener('click', event => {
        const button = event.target.closest('.bibtex-btn');
        if (button) showBibTeXModal(button.closest('.paper-card'));
    });
}
