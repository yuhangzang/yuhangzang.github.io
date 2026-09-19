import { siteURL, paperURL, bibtexPath, renderBibTeX, formatCitation, citationRecord, authorProfiles } from './render-paper.mjs';

// Plain-text entry points for language-model crawlers and agents (https://llmstxt.org).
// Everything here is derived from data/publications.json, so the text never drifts from the pages.

const bibtexURL = paper => `${siteURL}${bibtexPath(paper)}`;
const authorList = authors => authors.map(author => author.name).join(', ');
const evidence = (content, item) => {
    const source = content.sources[item.source];
    const url = item.page ? `${source.url}#page=${item.page}` : item.fragment ? `${source.url}#${encodeURIComponent(item.fragment)}` : source.url;
    return `${item.locator || source.label} — ${url}`;
};
const oneLine = text => String(text).replace(/\s+/g, ' ').trim();

function profileLines(author) {
    return authorProfiles(author).map(profile => `- ${profile.label}: ${profile.url}`).join('\n');
}

function paperLine(paper) {
    const takeaway = paper.content?.takeaway?.text || paper.content?.summary.text || '';
    const ids = [paper.identifiers.arxiv ? `arXiv:${paper.identifiers.arxiv}` : '', paper.identifiers.doi ? `DOI:${paper.identifiers.doi}` : ''].filter(Boolean).join(', ');
    return `- [${oneLine(paper.title)}](${paperURL(paper)}): ${paper.publication.citationText}${paper.display.badges.length ? ` (${paper.display.badges.join(', ')})` : ''}. ${oneLine(takeaway)}${ids ? ` ${ids}.` : ''}${paper.citation ? ` BibTeX: ${bibtexURL(paper)}` : ''}`;
}

export function renderLLMsIndex(data) {
    const author = data.author;
    const years = [...new Set(data.papers.map(paper => paper.publication.year))].sort((a, b) => b - a);
    const topics = [...new Set(data.papers.flatMap(paper => paper.topics))];
    return `# ${author.name}

> ${author.description}

${author.name} (${author.alternateName.join(', ')}) is a ${author.jobTitle} at ${author.affiliation.name} (${author.affiliation.url}). Research areas: ${author.knowsAbout.join('; ')}. This site is the canonical, author-maintained record of ${author.name}'s publications: every paper page carries the author abstract, a one-sentence takeaway, verified results with table or section locators in the source paper, and a BibTeX entry checked against the published record.

Publications listed: ${data.papers.length}. Topics: ${topics.join('; ')}.

## Author identifiers

${profileLines(author)}
- Homepage: ${siteURL}/

## Machine-readable data

- [All publications (JSON)](${siteURL}/data/publications.json): every record on this site with abstracts, takeaways, verified results, source locators and citation metadata
- [All publications (BibTeX)](${siteURL}/publications.bib): one file with every citation entry
- [Full text of every paper page](${siteURL}/llms-full.txt): the complete content of all paper pages in Markdown
- [Sitemap](${siteURL}/sitemap.xml): all pages with last-modified dates
- Each paper page also has a BibTeX file (\`.bib\`) at the same address as its \`.html\` page; its full record is the matching entry in the JSON file above.

${years.map(year => `## Publications ${year}\n\n${data.papers.filter(paper => paper.publication.year === year).map(paperLine).join('\n')}`).join('\n\n')}

## Pages

- [Home](${siteURL}/): biography, news and services
- [All publications](${siteURL}/research.html): the complete list with filters by year, topic and venue
`;
}

function renderPaperText(paper) {
    const content = paper.content;
    const citation = citationRecord(paper);
    const links = paper.links.map(link => {
        switch (link.type) {
            case 'arxiv': return `- arXiv: ${link.url}`;
            case 'scholar': return `- Google Scholar: ${link.url}`;
            case 'code': return `- Code (${link.repository}): ${link.url}`;
            case 'project': return `- Project page: ${link.url}`;
            case 'huggingface': return `- Hugging Face ${link.variant} (${link.label}): ${link.url}`;
            case 'paper': return `- Paper (${link.label}): ${link.url}`;
        }
    });
    const sections = [`# ${oneLine(paper.title)}

- Page: ${paperURL(paper)}
- Authors: ${authorList(paper.authors)}${paper.citation?.authors ? `\n- Authors of the published version: ${authorList(citation.authors)}` : ''}
- Published in: ${paper.publication.citationText}${paper.display.badges.length ? ` (${paper.display.badges.join(', ')})` : ''}${citation.title !== paper.title ? `\n- Title of the published version: ${oneLine(citation.title)}` : ''}${paper.identifiers.arxiv ? `\n- arXiv: ${paper.identifiers.arxiv}${paper.dates ? ` (first posted ${paper.dates.arxivFirstPosted}, last revised ${paper.dates.arxivLastUpdated})` : ''}` : ''}${paper.identifiers.doi ? `\n- DOI: ${paper.identifiers.doi}` : ''}
- Topics: ${(paper.keywords || paper.topics).join('; ')}
${links.join('\n')}${paper.citation ? `\n- BibTeX: ${bibtexURL(paper)}` : ''}`];
    if (content) {
        if (content.takeaway) sections.push(`## Key takeaway\n\n${oneLine(content.takeaway.text)} (Source: ${evidence(content, content.takeaway)})`);
        sections.push(`## Abstract\n\n${oneLine(content.abstract.text)} (Author abstract: ${evidence(content, content.abstract)})`);
        sections.push(`## Research problem and approach\n\n${oneLine(content.summary.text)} (Source: ${evidence(content, content.summary)})`);
        sections.push(`## Main contributions\n\n${content.contributions.map(item => `- ${oneLine(item.text)} (Source: ${evidence(content, item)})`).join('\n')}`);
        if (content.methodComparison) {
            const comparison = content.methodComparison;
            const cell = value => oneLine(value).replaceAll('|', '\\|');
            sections.push(`## Method comparison\n\n| ${comparison.columns.map(column => cell(column.label)).join(' | ')} |\n| ${comparison.columns.map(() => '---').join(' | ')} |\n${comparison.rows.map(row => `| ${comparison.columns.map(column => cell(row[column.key])).join(' | ')} |`).join('\n')}\n\nSource: ${evidence(content, comparison)}`);
        }
        if (content.results.length) {
            const columns = content.resultColumns;
            sections.push(`## Selected results\n\n${oneLine(content.resultsCaption)}\n\n| Setting | Metric | ${columns.map(column => oneLine(column.label)).join(' | ')} | Gain | Source |\n| --- | --- | ${columns.map(() => '---').join(' | ')} | --- | --- |\n${content.results.map(row => `| ${oneLine(row.setting)} | ${oneLine(row.metric)} | ${columns.map(column => row[column.key].toFixed(1)).join(' | ')} | ${row.result >= row.baseline ? '+' : ''}${(row.result - row.baseline).toFixed(1)} | ${evidence(content, row)} |`).join('\n')}\n\n${oneLine(content.resultsNote)}`);
        } else if (content.resultNotes?.length) {
            sections.push(`## Selected results\n\n${content.resultNotes.map(item => `- ${oneLine(item.text)} (Source: ${evidence(content, item)})`).join('\n')}`);
        }
        sections.push(`Content verified against the sources above on ${content.verifiedOn}.`);
    }
    if (paper.citation) {
        sections.push(`## Cite this paper\n\n${formatCitation(paper)}${paper.citation.authors ? '\n\nThis citation uses the author list of the published version.' : ''}\n\nPublished record: ${paper.citation.source.url}\n\n\`\`\`bibtex\n${renderBibTeX(paper).trimEnd()}\n\`\`\``);
    }
    return sections.join('\n\n');
}

export function renderLLMsFull(data) {
    const author = data.author;
    return `# ${author.name} — all publications

> ${author.description}

This file contains the full content of every paper page on ${siteURL}/ (${data.papers.length} papers), generated from the same data as the HTML pages. Each entry gives the author abstract, a takeaway, contributions and results with locators in the source paper, and a citation. Author identifiers: ${authorProfiles(author).map(profile => `${profile.label} ${profile.url}`).join('; ')}.

---

${data.papers.map(renderPaperText).join('\n\n---\n\n')}
`;
}

export function renderBibliography(data) {
    const entries = data.papers.filter(paper => paper.citation);
    return `% Publications of ${data.author.name} — ${siteURL}/
% ${entries.length} entries generated from ${siteURL}/data/publications.json
% Each entry is also available at ${siteURL}/papers/<id>.bib next to its paper page.

${entries.map(renderBibTeX).join('\n')}`;
}
