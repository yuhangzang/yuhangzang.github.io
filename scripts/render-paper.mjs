import { renderSiteNavigation } from './render-site.mjs';

export const siteURL = 'https://yuhangzang.github.io';
// One stable node for the site author so every paper's author entry resolves to the same Person.
export const personID = `${siteURL}/#person`;
export const authorName = 'Yuhang Zang';

// Profile URLs derived from the identifiers in data/publications.json.
export function authorProfiles(author) {
    const ids = author.identifiers;
    return [
        ['ORCID', ids.orcid, `https://orcid.org/${ids.orcid}`],
        ['Google Scholar', ids.googleScholar, `https://scholar.google.com/citations?user=${ids.googleScholar}`],
        ['DBLP', ids.dblp, `https://dblp.org/pid/${ids.dblp}`],
        ['OpenAlex', ids.openalex, `https://openalex.org/${ids.openalex}`],
        ['Semantic Scholar', ids.semanticScholar, `https://www.semanticscholar.org/author/${ids.semanticScholar}`],
        ['GitHub', ids.github, `https://github.com/${ids.github}`],
        ['Hugging Face', ids.huggingface, `https://huggingface.co/${ids.huggingface}`],
        ['X (Twitter)', ids.twitter, `https://twitter.com/${ids.twitter}`],
        ['LinkedIn', ids.linkedin, `https://www.linkedin.com/in/${ids.linkedin}/`]
    ].filter(([, value]) => value).map(([label, value, url]) => ({ label, value, url }));
}

export function personSchema(author) {
    const profiles = authorProfiles(author);
    const registry = { ORCID: 'ORCID', DBLP: 'DBLP', OpenAlex: 'OpenAlex', 'Semantic Scholar': 'Semantic Scholar', 'Google Scholar': 'Google Scholar' };
    return {
        '@type': 'Person',
        '@id': personID,
        name: author.name,
        givenName: author.givenName,
        familyName: author.familyName,
        alternateName: author.alternateName,
        jobTitle: author.jobTitle,
        description: author.description,
        url: `${siteURL}/`,
        image: author.image,
        affiliation: { '@type': 'Organization', name: author.affiliation.name, url: author.affiliation.url },
        alumniOf: author.alumniOf.map(school => ({ '@type': 'EducationalOrganization', name: school.name, ...(school.alternateName ? { alternateName: school.alternateName } : {}), url: school.url })),
        identifier: profiles.filter(profile => registry[profile.label]).map(profile => ({ '@type': 'PropertyValue', propertyID: registry[profile.label], value: profile.label === 'ORCID' ? profile.url : profile.value, url: profile.url })),
        sameAs: profiles.map(profile => profile.url),
        knowsAbout: author.knowsAbout,
        mainEntityOfPage: `${siteURL}/`
    };
}

const authorEntity = author => ({ '@type': 'Person', ...(author.name === authorName ? { '@id': personID } : {}), name: author.name });

export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

// IDs keep published addresses stable when titles or venues are corrected.
export const paperPath = paper => `/papers/${paper.id.replaceAll(':', '-')}.html`;
export const paperURL = paper => `${siteURL}${paperPath(paper)}`;
export const structuredJSON = value => JSON.stringify(value).replaceAll('<', '\\u003c');
// A published version can have a different title or author list from an expanded preprint.
export const citationRecord = paper => ({ ...paper.publication, title: paper.title, authors: paper.authors, ...paper.citation });
const citationYear = paper => citationRecord(paper).year;
const citationVenue = paper => paper.citation?.type === 'article' ? paper.citation.journal
    : paper.citation?.type === 'phdthesis' ? paper.citation.school
    : citationRecord(paper).booktitle || paper.publication.citationText;

function publicationContainer(paper) {
    const citation = citationRecord(paper);
    const name = citationVenue(paper);
    let container = { '@type': citation.type === 'article' && citation.status === 'published' ? 'Periodical' : 'CreativeWork', name };
    if (citation.volume) container = { '@type': 'PublicationVolume', name, volumeNumber: citation.volume, isPartOf: container };
    if (citation.number) container = { '@type': 'PublicationIssue', name, issueNumber: citation.number, isPartOf: container };
    return container;
}

export function paperSchema(paper, includeContent = false) {
    const citation = citationRecord(paper);
    const fullText = paper.content?.sources.paper;
    const identifiers = Object.entries(paper.identifiers).filter(([key]) => ['arxiv', 'doi'].includes(key))
        .map(([key, value]) => ({ '@type': 'PropertyValue', propertyID: key === 'doi' ? 'DOI' : 'arXiv', value }));
    // Verified publication records link available versions as one work.
    const identity = paper.citation ? {
        sameAs: [...new Set([paper.citation.source.url, ...paper.links.filter(link => link.type === 'arxiv').map(link => link.url)])],
        ...(identifiers.length ? { identifier: identifiers.length === 1 ? identifiers[0] : identifiers } : {})
    } : {
        sameAs: paper.links.find(link => ['arxiv', 'paper'].includes(link.type))?.url
    };
    return {
        '@type': paper.publication.venueGroup === 'Thesis' ? 'Thesis' : 'ScholarlyArticle',
        '@id': `${paperURL(paper)}#paper`,
        name: citation.title,
        ...(citation.title !== paper.title ? { alternateName: paper.title } : {}),
        author: citation.authors.map(authorEntity),
        // A preprint is dated by its first arXiv posting; a published record keeps the venue year.
        datePublished: citation.status === 'preprint' && paper.dates ? paper.dates.arxivFirstPosted : String(citationYear(paper)),
        ...(paper.dates ? { dateCreated: paper.dates.arxivFirstPosted, dateModified: paper.dates.arxivLastUpdated } : {}),
        url: paperURL(paper),
        ...identity,
        ...(fullText?.encodingFormat === 'application/pdf' ? {
            encoding: { '@type': 'MediaObject', name: fullText.label, contentUrl: fullText.url, encodingFormat: fullText.encodingFormat }
        } : {}),
        isPartOf: publicationContainer(paper),
        ...(citation.firstPage ? { pageStart: citation.firstPage, pageEnd: citation.lastPage } : {}),
        ...(includeContent && paper.keywords ? { keywords: paper.keywords } : {}),
        ...(includeContent && paper.content?.relatedWork ? { citation: paper.content.relatedWork.cited.map(item => ({ '@type': 'ScholarlyArticle', name: item.title, url: item.url })) } : {}),
        ...(includeContent && paper.content ? { abstract: paper.content.abstract.text, description: paper.content.takeaway?.text || paper.content.summary.text } : {})
    };
}

export const bibtexPath = paper => paperPath(paper).replace(/\.html$/, '.bib');
const bibtexFile = paper => bibtexPath(paper).split('/').at(-1);

export function renderBibTeX(paper) {
    if (!paper.citation) return '';
    const tex = value => String(value).replace(/[\\{}%&#_$~^]/g, char => ({
        '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '%': '\\%', '&': '\\&',
        '#': '\\#', '_': '\\_', '$': '\\$', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'
    }[char]));
    const citation = citationRecord(paper);
    const fields = [
        ['title', `{${tex(citation.title)}}`],
        ['author', citation.authors.map(author => tex(author.name)).join(' and ')],
        [citation.type === 'article' ? 'journal' : citation.type === 'phdthesis' ? 'school' : 'booktitle', tex(citationVenue(paper))],
        ...(citation.month ? [['month', ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][citation.month - 1]]] : []),
        ['year', citation.year],
        ...['volume', 'number', 'publisher'].filter(key => citation[key]).map(key => [key, tex(citation[key])]),
        ...(citation.firstPage ? [['pages', `${citation.firstPage}--${citation.lastPage}`]] : []),
        ...(paper.identifiers.doi ? [['doi', tex(paper.identifiers.doi)]] : []),
        ['url', new URL(citation.source.url).href.replaceAll('{', '%7B').replaceAll('}', '%7D')]
    ];
    return `@${citation.type}{${citation.key},\n${fields.map(([key, value]) => `  ${key.padEnd(10)}= {${value}}`).join(',\n')}\n}\n`;
}

function evidenceLink(content, evidence) {
    const source = content.sources[evidence.source];
    const url = evidence.page ? `${source.url}#page=${evidence.page}` : evidence.fragment ? `${source.url}#${encodeURIComponent(evidence.fragment)}` : source.url;
    return `<a href="${escapeHTML(url)}">${escapeHTML(evidence.locator || source.label)}</a>`;
}

function renderAbstract(content) {
    if (!content) return '';
    return `<section aria-labelledby="abstract-heading">
      <h2 id="abstract-heading">Abstract</h2>
      <p>${escapeHTML(content.abstract.text)}</p>
      <p class="paper-detail-note">Author abstract · ${evidenceLink(content, content.abstract)}</p>
    </section>`;
}

function renderTakeaway(content) {
    if (!content?.takeaway) return '';
    return `<section class="paper-takeaway" aria-labelledby="takeaway-heading">
      <h2 id="takeaway-heading">Key takeaway</h2>
      <p>${escapeHTML(content.takeaway.text)} ${evidenceLink(content, content.takeaway)}</p>
    </section>`;
}

function renderMethodComparison(content) {
    const comparison = content.methodComparison;
    if (!comparison) return '';
    return `<section aria-labelledby="method-comparison-heading">
      <h2 id="method-comparison-heading">Method comparison</h2>
      <div class="paper-results-scroll" role="region" aria-label="Method comparison table" tabindex="0">
        <table class="paper-methods${comparison.columns.length === 2 ? ' paper-methods-compact' : ''}">
          <thead><tr>${comparison.columns.map(column => `<th scope="col">${escapeHTML(column.label)}</th>`).join('')}</tr></thead>
          <tbody>${comparison.rows.map(row => `<tr>${comparison.columns.map((column, index) => index === 0 ? `<th scope="row">${escapeHTML(row[column.key])}</th>` : `<td>${escapeHTML(row[column.key])}</td>`).join('')}</tr>`).join('\n')}</tbody>
        </table>
      </div>
      <p class="paper-detail-note">${evidenceLink(content, comparison)}</p>
    </section>`;
}

function renderRelatedWork(paper) {
    const related = paper.content?.relatedWork;
    if (!related) return '';
    const name = paper.shortName || paper.title;
    const card = (direction, heading) => !related[direction].length ? '' : `<div class="paper-related-card" data-direction="${direction}">
        <h3>${escapeHTML(heading)}</h3>
        <ul>${related[direction].slice().sort((a, b) => a.firstPosted.localeCompare(b.firstPosted)).map(item => `<li>
          <a class="paper-related-title" href="${escapeHTML(item.url)}">${escapeHTML(item.title)}</a>
          ${item.attribution ? `<p class="paper-related-attribution">${escapeHTML(item.attribution)}</p>` : ''}
          <p class="paper-related-date">${item.kind === 'post' ? 'X post' : 'Paper · First on arXiv'} · <time datetime="${item.firstPosted}">${item.firstPosted}</time></p>
          ${item.quote ? `<blockquote cite="${escapeHTML(item.evidence.url)}"><p>“${escapeHTML(item.quote)}”</p></blockquote>` : ''}
          <p>${escapeHTML(item.relationship)}</p>
          <a class="paper-related-evidence" href="${escapeHTML(item.evidence.url)}">${escapeHTML(item.evidence.label)}</a>
        </li>`).join('\n')}</ul>
      </div>`;
    return `<section aria-labelledby="related-heading">
      <h2 id="related-heading">Related work and discussion</h2>
      <p class="paper-detail-note">Selected references and public discussion. Dates indicate first arXiv submission for papers and posting date for commentary.</p>
      <div class="paper-related-grid">
        ${card('cited', `Cited by ${name}`)}
        ${card('citing', 'Citations and discussion')}
      </div>
    </section>`;
}

function renderEvidence(content) {
    if (!content) return '';
    return `<section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Research problem and approach</h2>
      <p>${escapeHTML(content.summary.text)} ${evidenceLink(content, content.summary)}</p>
    </section>
    <section aria-labelledby="contributions-heading">
      <h2 id="contributions-heading">Main contributions</h2>
      <ul class="paper-detail-resources">${content.contributions.map(item => `<li>${escapeHTML(item.text)} ${evidenceLink(content, item)}</li>`).join('\n')}</ul>
    </section>
    ${renderMethodComparison(content)}
    ${content.results.length ? `<section aria-labelledby="results-heading">
      <h2 id="results-heading">Selected results</h2>
      <div class="paper-results-scroll" role="region" aria-label="Results table" tabindex="0">
        <table class="paper-results">
          <caption>${escapeHTML(content.resultsCaption)}</caption>
          <thead><tr><th scope="col">Setting / metric</th>${content.resultColumns.map(column => `<th scope="col">${escapeHTML(column.label)}</th>`).join('')}<th scope="col">Gain</th><th scope="col">Source</th></tr></thead>
          <tbody>${content.results.map(row => `<tr><th scope="row">${escapeHTML(row.setting)}<br><span class="paper-detail-note">${escapeHTML(row.metric)}</span></th>${content.resultColumns.map(column => `<td>${row[column.key].toFixed(1)}</td>`).join('')}<td>${row.result >= row.baseline ? '+' : ''}${(row.result - row.baseline).toFixed(1)}</td><td>${evidenceLink(content, row)}</td></tr>`).join('\n')}</tbody>
        </table>
      </div>
      <p class="paper-detail-note">${escapeHTML(content.resultsNote)}</p>
    </section>` : content.resultNotes?.length ? `<section aria-labelledby="results-heading">
      <h2 id="results-heading">Selected results</h2>
      <ul class="paper-detail-resources">${content.resultNotes.map(item => `<li>${escapeHTML(item.text)} ${evidenceLink(content, item)}</li>`).join('\n')}</ul>
    </section>` : ''}`;
}

// Plain-text reference in the form shown under "Cite this paper".
export function formatCitation(paper) {
    if (!paper.citation) return '';
    const citation = citationRecord(paper);
    const pages = citation.firstPage ? `, pp. ${citation.firstPage}–${citation.lastPage}` : '';
    const volume = citation.volume ? `, ${citation.volume}${citation.number ? `(${citation.number})` : ''}` : '';
    return `${citation.authors.map(author => author.name).join(', ')}. ${citation.title}. ${citationVenue(paper)}${volume}, ${citationYear(paper)}${pages}.`;
}

function renderCitation(paper) {
    if (!paper.citation) return '';
    const citation = citationRecord(paper);
    return `<section aria-labelledby="citation-heading">
      <h2 id="citation-heading">Cite this paper</h2>
      <p>${escapeHTML(formatCitation(paper))}</p>
      ${paper.citation.authors ? '<p class="paper-detail-note">This citation uses the author list of the published version.</p>' : ''}
      ${citation.type === 'inproceedings' && citation.year !== paper.publication.year ? `<p class="paper-detail-note">The conference took place in ${paper.publication.year}; the proceedings volume was published in ${citation.year}.</p>` : ''}
      <div class="paper-citation-actions">
        <button class="paper-copy-button" type="button" data-copy-target="paper-bibtex-content" aria-describedby="bibtex-copy-status" hidden>Copy to clipboard</button>
        <a href="${bibtexFile(paper)}" download>Download BibTeX</a>
        <a href="${escapeHTML(paper.citation.source.url)}">${escapeHTML(paper.citation.source.label)}</a>
      </div>
      <p id="bibtex-copy-status" class="paper-detail-note" role="status" aria-live="polite"></p>
      <pre class="paper-bibtex"><code id="paper-bibtex-content">${escapeHTML(renderBibTeX(paper))}</code></pre>
    </section>`;
}

function resourceLabel(link, paper) {
    switch (link.type) {
        case 'arxiv': return `arXiv:${paper.identifiers.arxiv}`;
        case 'scholar': return 'Google Scholar';
        case 'code': return `Code · ${link.repository}`;
        case 'project': return 'Project website';
        case 'huggingface': return `Hugging Face · ${link.label}`;
        case 'paper': return link.label === 'PDF' ? 'Paper (PDF)' : 'Paper · institutional repository';
    }
}

export function renderPaper(paper, options = {}) {
    const title = escapeHTML(paper.title);
    const citation = citationRecord(paper);
    const meta = (name, content) => `<meta name="${name}" content="${escapeHTML(content)}">`;
    const orcid = options.author?.identifiers?.orcid;
    const description = paper.content?.takeaway?.text || paper.content?.summary.text || `${paper.title}. ${paper.publication.citationText}. Authors, publication details, and research resources.`;
    const corresponding = paper.authors.some(author => author.corresponding);
    const envelope = '<svg class="paper-envelope" viewBox="0 0 16 12" aria-hidden="true"><path fill="currentColor" d="M1 0h14a1 1 0 0 1 1 1v1L8 7 0 2V1a1 1 0 0 1 1-1ZM0 4l8 5 8-5v7a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1Z"/></svg>';
    return `<!DOCTYPE html>
<!-- Generated from data/publications.json. Edit the shared data and rebuild. -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Yuhang Zang</title>
${meta('description', description)}
<link rel="canonical" href="${paperURL(paper)}">
${meta('citation_title', citation.title)}
${citation.authors.map(author => meta('citation_author', author.name) + (orcid && author.name === authorName ? `\n${meta('citation_author_orcid', `https://orcid.org/${orcid}`)}` : '')).join('\n')}
${meta('citation_publication_date', citationYear(paper))}
${paper.dates ? meta('citation_online_date', paper.dates.arxivFirstPosted.replaceAll('-', '/')) : ''}
${paper.identifiers.arxiv ? meta('citation_arxiv_id', paper.identifiers.arxiv) : ''}
${paper.identifiers.doi ? meta('citation_doi', paper.identifiers.doi) : ''}
${citation.pdfURL ? meta('citation_pdf_url', citation.pdfURL) : paper.content?.sources.paper?.encodingFormat === 'application/pdf' ? meta('citation_pdf_url', paper.content.sources.paper.url) : ''}
${paper.citation?.type === 'inproceedings' ? meta('citation_conference_title', citation.booktitle) : paper.citation?.type === 'article' ? meta('citation_journal_title', citation.journal) : ''}
${citation.firstPage ? `${meta('citation_firstpage', citation.firstPage)}\n${meta('citation_lastpage', citation.lastPage)}` : ''}
${citation.volume ? meta('citation_volume', citation.volume) : ''}
${citation.number ? meta('citation_issue', citation.number) : ''}
${paper.citation ? `<link rel="alternate" type="application/x-bibtex" href="${bibtexFile(paper)}">` : ''}
<link rel="alternate" type="application/json" href="../data/publications.json" title="All publications (JSON)">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${paperURL(paper)}">
<link rel="icon" type="image/svg+xml" href="../imgs/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap" rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;700&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet"></noscript>
<script>
try {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
} catch {}
</script>
<link rel="stylesheet" href="../main.min.css">
<script type="application/ld+json">${structuredJSON({ '@context': 'https://schema.org', ...paperSchema(paper, true) })}</script>
<script src="../assets/main.min.js" defer></script>
</head>
<body class="paper-page">
${renderSiteNavigation('../', 'publications', 'location')}
<main class="paper-detail">
  <article class="papers-section">
    <p class="paper-detail-kicker">${escapeHTML(paper.publication.venueGroup)} · ${paper.publication.year}</p>
    <h1 class="section-heading">${title}</h1>
    <p class="paper-detail-authors author-names">${paper.authors.map(author => `${author.name === 'Yuhang Zang' ? `<strong class="author-highlight">${escapeHTML(author.name)}</strong>` : escapeHTML(author.name)}${author.corresponding ? `<span class="paper-corresponding author-annotation corresponding" role="img" aria-label="Corresponding author" title="Corresponding author">${envelope}<span class="paper-sr-only">(corresponding author)</span></span>` : ''}`).join(', ')}</p>
    ${corresponding ? `<p class="paper-detail-note paper-author-legend">${envelope} Corresponding author</p>` : ''}
    ${renderTakeaway(paper.content)}
    ${renderAbstract(paper.content)}
    <section aria-labelledby="publication-heading">
      <h2 id="publication-heading">Publication</h2>
      <p>${escapeHTML(paper.publication.citationText)}</p>
      ${paper.display.badges.length ? `<p>${paper.display.badges.map(escapeHTML).join(' · ')}</p>` : ''}
    </section>
    <section aria-labelledby="resources-heading">
      <h2 id="resources-heading">Paper and resources</h2>
      <ul class="paper-detail-resources">
        ${paper.content?.sources.paper ? `<li><a href="${escapeHTML(paper.content.sources.paper.url)}">${escapeHTML(paper.content.sources.paper.label)} (PDF)</a></li>` : ''}
        ${paper.links.filter(link => link.url !== paper.content?.sources.paper?.url).map(link => `<li><a href="${escapeHTML(link.url)}">${escapeHTML(resourceLabel(link, paper))}</a></li>`).join('\n        ')}
      </ul>
    </section>
    <section aria-labelledby="topics-heading">
      <h2 id="topics-heading">Research topics</h2>
      <p class="paper-keywords">${(paper.keywords || paper.topics).map(escapeHTML).join(' · ')}</p>
    </section>
    ${renderEvidence(paper.content)}
    ${renderRelatedWork(paper)}
    ${renderCitation(paper)}
  <footer class="paper-detail-footer"><a href="../research.html">← All publications</a></footer>
  </article>
</main>
</body>
</html>
`.replace(/^[\t ]+$/gm, '');
}
