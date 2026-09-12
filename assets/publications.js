import { initPaperList } from './js/papers.js';
import { initMetrics } from './js/metrics.js';
import { initBibTeX } from './js/bibtex.js';

const container = document.getElementById('papers-container');
if (container) {
    initPaperList(container);
    initBibTeX(container);
    initMetrics(container);
}
