import assert from 'node:assert/strict';
import { renderSiteNavigation } from './render-site.mjs';
import { renderLLMsIndex, renderLLMsFull, renderBibliography } from './render-llms.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { escapeHTML, paperPath, paperURL, paperSchema, renderPaper, renderBibTeX, bibtexPath, siteURL, structuredJSON, citationRecord, personSchema, personID, authorName, authorProfiles } from './render-paper.mjs';
const external = 'target="_blank" rel="noopener noreferrer"';
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;

export function validatePublications(data) {
    assert.equal(data.schemaVersion, 1, 'Unsupported publication schema');
    assert(data.papers.length, 'Publication data is empty');
    const author = data.author;
    assert(author && author.name === authorName && author.givenName && author.familyName && author.description && author.jobTitle, 'Incomplete author profile');
    assert(Array.isArray(author.alternateName) && Array.isArray(author.knowsAbout) && author.knowsAbout.length && Array.isArray(author.alumniOf), 'Incomplete author profile');
    assert(author.affiliation?.name && author.affiliation.url, 'Missing author affiliation');
    assert(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(author.identifiers?.orcid), 'Invalid ORCID');
    for (const profile of authorProfiles(author)) assert.equal(new URL(profile.url).protocol, 'https:', `Invalid profile URL: ${profile.label}`);
    for (const url of [author.image, author.affiliation.url, ...author.alumniOf.map(school => school.url)]) assert(['http:', 'https:'].includes(new URL(url).protocol), `Invalid author URL: ${url}`);
    const ids = new Set();
    const paths = new Set();
    for (const paper of data.papers) {
        assert(paper.id && !ids.has(paper.id), `Duplicate or missing ID: ${paper.id}`);
        assert(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(paper.id), `Invalid paper ID: ${paper.id}`);
        assert(!paths.has(paperPath(paper).toLowerCase()), `Duplicate paper path: ${paper.id}`);
        paths.add(paperPath(paper).toLowerCase());
        ids.add(paper.id);
        assert(paper.title && paper.authors.length, `Missing title or authors: ${paper.id}`);
        assert(paper.authors.every(author => author.name && !/et al\./i.test(author.name)), `Incomplete authors: ${paper.id}`);
        assert(Number.isInteger(paper.publication.year) && paper.publication.citationText && paper.publication.venueGroup, `Missing publication information: ${paper.id}`);
        assert(paper.topics.length, `Missing topic: ${paper.id}`);
        if (paper.dates) {
            assert(paper.identifiers.arxiv, `Dates without an arXiv record: ${paper.id}`);
            assert(isDate(paper.dates.arxivFirstPosted) && isDate(paper.dates.arxivLastUpdated), `Invalid arXiv dates: ${paper.id}`);
            assert(paper.dates.arxivFirstPosted <= paper.dates.arxivLastUpdated, `arXiv dates out of order: ${paper.id}`);
        } else {
            assert(!paper.identifiers.arxiv, `Missing arXiv dates: ${paper.id}`);
        }
        if (paper.keywords) {
            assert(Array.isArray(paper.keywords) && paper.keywords.length && paper.keywords.every(term => typeof term === 'string' && term.trim()), `Invalid keywords: ${paper.id}`);
            assert.equal(new Set(paper.keywords.map(term => term.toLowerCase())).size, paper.keywords.length, `Duplicate keywords: ${paper.id}`);
        }
        for (const link of paper.links) {
            assert(['http:', 'https:'].includes(new URL(link.url).protocol), `Invalid URL: ${paper.id}`);
            assert(['arxiv', 'scholar', 'code', 'project', 'huggingface', 'paper'].includes(link.type), `Unsupported link: ${link.type}`);
            if (link.type === 'arxiv') assert(paper.identifiers.arxiv, `Missing arXiv ID: ${paper.id}`);
            if (link.type === 'scholar') assert(paper.identifiers.googleScholar, `Missing Scholar ID: ${paper.id}`);
            if (link.type === 'code') assert(link.repository, `Missing repository: ${paper.id}`);
            if (link.type === 'huggingface') assert(['model', 'dataset', 'space'].includes(link.variant) && link.label, `Invalid resource: ${paper.id}`);
        }
        assert(paper.display.badges.every(badge => ['Oral', 'Spotlight', 'Highlight'].includes(badge)), `Unsupported badge: ${paper.id}`);
        const validURL = url => assert(['http:', 'https:'].includes(new URL(url).protocol), `Invalid source URL: ${paper.id}`);
        if (paper.citation) {
            const citation = citationRecord(paper);
            assert(['inproceedings', 'article', 'phdthesis'].includes(paper.citation.type) && /^[A-Za-z0-9_-]+$/.test(paper.citation.key), `Invalid citation: ${paper.id}`);
            if (paper.citation.year !== undefined) assert(Number.isInteger(paper.citation.year) && paper.citation.year > 0, `Invalid citation year: ${paper.id}`);
            assert(typeof citation.title === 'string' && citation.title.trim() && Array.isArray(citation.authors) && citation.authors.length && citation.authors.every(author => author.name && !/et al\./i.test(author.name)), `Incomplete citation identity: ${paper.id}`);
            if (citation.month !== undefined) assert(Number.isInteger(citation.month) && citation.month >= 1 && citation.month <= 12, `Invalid citation month: ${paper.id}`);
            if (citation.firstPage !== undefined || citation.lastPage !== undefined) assert(Number.isInteger(citation.firstPage) && citation.firstPage > 0 && Number.isInteger(citation.lastPage) && citation.lastPage >= citation.firstPage, `Invalid citation pages: ${paper.id}`);
            if (citation.pdfURL) validURL(citation.pdfURL);
            if (paper.citation.type === 'inproceedings') {
                assert(typeof citation.booktitle === 'string' && citation.booktitle.trim(), `Incomplete citation: ${paper.id}`);
            } else if (paper.citation.type === 'article') {
                assert(typeof paper.citation.journal === 'string' && paper.citation.journal.trim(), `Missing citation journal: ${paper.id}`);
            } else {
                assert(typeof paper.citation.school === 'string' && paper.citation.school.trim(), `Missing thesis school: ${paper.id}`);
            }
            validURL(paper.citation.source.url);
        }
        if (paper.content) {
            const content = paper.content;
            assert(/^\d{4}-\d{2}-\d{2}$/.test(content.verifiedOn), `Incomplete content: ${paper.id}`);
            for (const source of Object.values(content.sources)) {
                assert(source.label, `Missing source label: ${paper.id}`);
                validURL(source.url);
                if (source.encodingFormat !== undefined) assert.equal(source.encodingFormat, 'application/pdf', `Unsupported source format: ${paper.id}`);
            }
            for (const item of [content.abstract, content.summary, ...content.contributions, ...content.results, ...(content.resultNotes || []), ...(content.takeaway ? [content.takeaway] : [])]) {
                assert(content.sources[item.source], `Unknown evidence source: ${paper.id}`);
                if (item.page !== undefined) assert(Number.isInteger(item.page) && item.page > 0, `Invalid source page: ${paper.id}`);
                if (item.fragment !== undefined) assert(typeof item.fragment === 'string' && item.fragment.trim(), `Invalid source fragment: ${paper.id}`);
                assert(item.text || (item.setting && item.metric), `Missing evidence text: ${paper.id}`);
            }
            if (content.results.length) {
                assert(content.resultsCaption && content.resultsNote && Array.isArray(content.resultColumns), `Missing results layout: ${paper.id}`);
                const keys = content.resultColumns.map(column => column.key);
                assert(keys.includes('baseline') && keys.includes('result') && new Set(keys).size === keys.length && content.resultColumns.every(column => typeof column.label === 'string' && column.label.trim()), `Invalid result columns: ${paper.id}`);
                for (const row of content.results) {
                    assert(keys.every(key => Number.isFinite(row[key])), `Invalid result: ${paper.id}`);
                }
            }
            if (content.methodComparison) {
                const comparison = content.methodComparison;
                assert(content.sources[comparison.source] && comparison.locator, `Invalid comparison source: ${paper.id}`);
                assert(Array.isArray(comparison.columns) && comparison.columns.length && comparison.columns.every(column => column.key && column.label), `Invalid comparison columns: ${paper.id}`);
                assert(comparison.rows.length && comparison.rows.every(row => comparison.columns.every(column => typeof row[column.key] === 'string' && row[column.key].trim())), `Incomplete method comparison: ${paper.id}`);
            }
            if (content.relatedWork) {
                assert.equal(paper.id, 'arxiv:2503.01785', 'Related work is reserved for Visual-RFT');
                for (const direction of ['cited', 'citing']) {
                    assert(Array.isArray(content.relatedWork[direction]), `Missing citation direction: ${paper.id}`);
                    const relatedURLs = new Set();
                    for (const item of content.relatedWork[direction]) {
                        assert(item.title && item.relationship && item.evidence?.label, `Incomplete related paper: ${paper.id}`);
                        assert(['paper', 'post'].includes(item.kind) && (direction !== 'cited' || item.kind === 'paper'), `Invalid related work kind: ${paper.id}`);
                        for (const field of ['attribution', 'quote']) {
                            if (item[field] !== undefined) assert(typeof item[field] === 'string' && item[field].trim(), `Invalid related work ${field}: ${paper.id}`);
                        }
                        assert(/^\d{4}-\d{2}-\d{2}$/.test(item.firstPosted) && Number.isFinite(Date.parse(item.firstPosted)) && new Date(item.firstPosted).toISOString().slice(0, 10) === item.firstPosted, `Invalid related paper date: ${paper.id}`);
                        validURL(item.url);
                        validURL(item.evidence.url);
                        assert(!relatedURLs.has(item.url), `Duplicate related paper: ${paper.id}`);
                        relatedURLs.add(item.url);
                    }
                }
            }
        }
    }
}

function renderAuthor(author) {
    let name = escapeHTML(author.name);
    if (author.name === authorName) name = `<span class="author-highlight">${name}</span>`;
    if (author.corresponding) name += '<span class="author-annotation corresponding"><i class="fa fa-envelope"></i></span>';
    return name;
}

function renderLink(link, paper) {
    const href = escapeHTML(link.url);
    switch (link.type) {
        case 'arxiv':
            return `<a href="${href}" ${external} class="arxiv-btn"><i class="fa fa-file-text"></i>arXiv:${escapeHTML(paper.identifiers.arxiv)}</a>`;
        case 'scholar':
            return `<a href="${href}" ${external} class="citations-btn"><i class="fa fa-quote-left"></i><span class="citation-count show_paper_citations" data="${escapeHTML(paper.identifiers.googleScholar)}">0</span></a>`;
        case 'code':
            return `<a href="${href}" ${external} class="github-btn" data-repo="${escapeHTML(link.repository)}"><i class="fa fa-star"></i><span class="star-count">0</span></a>`;
        case 'project':
            return `<a href="${href}" ${external} class="homepage-btn"><i class="fa fa-home"></i>Home</a>`;
        case 'huggingface':
            return `<a href="${href}" ${external} class="huggingface-btn ${link.variant}"><span class="hf-emoji">🤗</span>${escapeHTML(link.label)}</a>`;
        case 'paper':
            return `<a href="${href}" ${external} class="arxiv-btn"><i class="fa fa-file-pdf-o"></i>${escapeHTML(link.label)}</a>`;
    }
}

// The "Selected" scope on the publications page keeps papers where the site author is first or last author.
export function isSelectedPaper(paper) {
    return [paper.authors[0], paper.authors.at(-1)].some(author => author.name === authorName);
}

function renderCard(paper) {
    const info = [
        `<a class="paper-title-link" href="${paperPath(paper).slice(1)}"><papertitle>${escapeHTML(paper.title)}</papertitle></a>`,
        `<div class="author-names">${paper.authors.map(renderAuthor).join(', ')}</div>`,
        `<div class="paper-venue">${escapeHTML(paper.publication.citationText).replace(/\(([^()]+)\)/, '(<b>$1</b>)')}${paper.display.badges.map(badge => ` <span class="oral-spotlight-badge ${badge === 'Oral' ? 'oral' : 'spotlight'}-badge">${escapeHTML(badge)}</span>`).join('')}</div>`
    ].join('\n');
    const isNew = paper.display.new;
    // Preserve the existing spacing of older cards, which have no info wrapper.
    const wrapInfo = paper.display.infoWrapper;
    return `<div class="paper-card" data-paper-id="${escapeHTML(paper.id)}" data-year="${paper.publication.year}" data-topic="${escapeHTML(paper.topics[0])}" data-venue="${escapeHTML(paper.publication.venueGroup)}"${isSelectedPaper(paper) ? ' data-selected="true"' : ''}>
${isNew ? '<div class="new-badge">New!</div>\n' : ''}<div class="paper-content">
${wrapInfo ? `<div class="paper-info">\n${info}\n</div>` : info}
<div class="paper-badges">
${paper.links.map(link => renderLink(link, paper)).join('\n')}
</div>
${paper.citation ? `<template class="paper-citation" data-cite-key="${escapeHTML(paper.citation.key)}">${escapeHTML(renderBibTeX(paper))}</template>` : ''}
</div>
</div>`;
}

export function publicationSections(data) {
    validatePublications(data);
    return {
        research: data.papers.map(renderCard).join('\n\n'),
        items: data.papers.map((paper, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: paperSchema(paper)
        }))
    };
}

function replacePaperSection(html, cards) {
    const marker = /<!-- BEGIN GENERATED PAPERS -->[\s\S]*?<!-- END GENERATED PAPERS -->/g;
    assert.equal([...html.matchAll(marker)].length, 1, 'Expected exactly one generated paper section');
    return html.replace(marker, () => `<!-- BEGIN GENERATED PAPERS -->\n${cards}\n<!-- END GENERATED PAPERS -->`);
}

// Scholarly profile links are visible page text, not only JSON-LD, so readers that skip <head> still see them.
function renderProfileLinks(author) {
    const scholarly = ['ORCID', 'Google Scholar', 'DBLP', 'OpenAlex', 'Semantic Scholar'];
    const links = authorProfiles(author).filter(profile => scholarly.includes(profile.label))
        .map(profile => `<a href="${escapeHTML(profile.url)}" target="_blank" rel="me noopener noreferrer">${escapeHTML(profile.label)}</a>`);
    return `<p class="profile-links">Profiles: ${links.join(' · ')}</p>`;
}

function replaceProfileLinks(html, author) {
    const marker = /<!-- BEGIN GENERATED PROFILES -->[\s\S]*?<!-- END GENERATED PROFILES -->/g;
    assert.equal([...html.matchAll(marker)].length, 1, 'Expected exactly one generated profile section');
    return html.replace(marker, () => `<!-- BEGIN GENERATED PROFILES -->\n                  ${renderProfileLinks(author)}\n                  <!-- END GENERATED PROFILES -->`);
}

function replaceNavigation(html, active) {
    const navigation = /<nav class="main-nav"[^>]*>[\s\S]*?<\/nav>/g;
    assert.equal([...html.matchAll(navigation)].length, 1, 'Expected exactly one main navigation');
    return html.replace(navigation, () => renderSiteNavigation('./', active));
}

export async function renderPublicationPages(root = new URL('../', import.meta.url)) {
    const data = JSON.parse(await readFile(new URL('data/publications.json', root), 'utf8'));
    const sections = publicationSections(data);
    const [home, research] = await Promise.all(['index.html', 'research.html'].map(name => readFile(new URL(name, root), 'utf8')));
    const personPattern = /<script id="person-schema" type="application\/ld\+json">[\s\S]*?<\/script>/g;
    assert.equal([...home.matchAll(personPattern)].length, 1, 'Expected exactly one person schema');
    // The home page has no paper list; only its navigation, profile links and person schema are generated.
    const homeOutput = replaceProfileLinks(replaceNavigation(home, 'home'), data.author)
        .replace(personPattern, () => `<script id="person-schema" type="application/ld+json">\n${structuredJSON({ '@context': 'https://schema.org', ...personSchema(data.author) })}\n</script>`);
    const schemaPattern = /<script id="publications-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    const schemaMatches = [...research.matchAll(schemaPattern)];
    assert.equal(schemaMatches.length, 1, 'Expected exactly one publications schema');
    const schema = JSON.parse(schemaMatches[0][1]);
    schema.author = { '@type': 'Person', '@id': personID, name: data.author.name, url: `${siteURL}/` };
    schema.mainEntity = { '@type': 'ItemList', itemListElement: sections.items };
    // Escape '<' so a title cannot terminate the embedded JSON-LD script.
    const researchOutput = replacePaperSection(replaceNavigation(research, 'publications'), sections.research).replace(schemaPattern,
        () => `<script id="publications-schema" type="application/ld+json">\n${structuredJSON(schema)}\n</script>`);
    const pages = data.papers.map(paper => ({ path: paperPath(paper).slice(1), html: renderPaper(paper, { author: data.author }) }));
    for (const paper of data.papers.filter(paper => paper.citation)) {
        pages.push({ path: bibtexPath(paper).slice(1), html: renderBibTeX(paper) });
    }
    // Sitemap dates follow the content verification date, so a rebuild without data changes is byte-identical.
    const lastmod = paper => paper.content?.verifiedOn;
    const latest = data.papers.map(lastmod).filter(Boolean).sort().at(-1);
    const entries = [[`${siteURL}/`, latest], [`${siteURL}/research.html`, latest], ...data.papers.map(paper => [paperURL(paper), lastmod(paper)])];
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([url, date]) => `  <url><loc>${escapeHTML(url)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
    await mkdir(new URL('papers/', root), { recursive: true });
    for (const page of pages) await writeFile(new URL(page.path, root), page.html);
    await writeFile(new URL('index.html', root), homeOutput);
    await writeFile(new URL('research.html', root), researchOutput);
    await writeFile(new URL('sitemap.xml', root), sitemap);
    await writeFile(new URL('llms.txt', root), renderLLMsIndex(data));
    await writeFile(new URL('llms-full.txt', root), renderLLMsFull(data));
    await writeFile(new URL('publications.bib', root), renderBibliography(data));
}
