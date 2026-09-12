import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { publicationSections, validatePublications, renderPublicationPages } from '../scripts/render-publications.mjs';
import { escapeHTML, paperPath, paperURL, renderPaper, renderBibTeX, bibtexPath, citationRecord, personSchema, personID, authorProfiles, formatCitation, siteURL } from '../scripts/render-paper.mjs';
import { renderLLMsIndex, renderLLMsFull, renderBibliography } from '../scripts/render-llms.mjs';

const data = JSON.parse(await readFile(new URL('../data/publications.json', import.meta.url), 'utf8'));

test('both lists and structured metadata use the canonical records', () => {
    const rendered = publicationSections(data);
    const paperIds = markup => [...markup.matchAll(/data-paper-id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(paperIds(rendered.homepage), data.homepage.selectedPaperIds);
    assert.deepEqual(paperIds(rendered.research), data.papers.map(paper => paper.id));
    assert.equal(rendered.items.length, data.papers.length);
    assert.deepEqual(rendered.homepageItems.map(entry => entry.item.url), data.homepage.selectedPaperIds.map(id => paperURL(data.papers.find(paper => paper.id === id))));
    assert.deepEqual(rendered.homepageItems.map(entry => entry.position), data.homepage.selectedPaperIds.map((_, index) => index + 1));
    for (const entry of rendered.homepageItems) {
        assert.deepEqual(entry.item, rendered.items.find(record => record.item['@id'] === entry.item['@id']).item);
    }
    const endocot = data.papers.find(paper => paper.id === 'arxiv:2603.12252');
    const code = endocot.links.find(link => link.type === 'code').url;
    assert(rendered.homepage.includes(code));
    assert(rendered.research.includes(code));
    const longbench = data.papers.find(paper => paper.id === 'arxiv:2407.01523');
    const metadata = rendered.items.find(entry => entry.item.url === paperURL(longbench)).item;
    assert.deepEqual(metadata.author.map(author => author.name), longbench.authors.map(author => author.name));
    assert.equal(metadata.author.length, 16);
    assert(!JSON.stringify(metadata).includes('et al.'));
    assert(rendered.research.includes('>PDF</a>'));
    assert(!rendered.research.includes('arXiv:undefined'));
    for (const paper of data.papers) {
        const page = renderPaper(paper);
        assert(rendered.research.includes(`href="${paperPath(paper).slice(1)}"`));
        assert(page.includes(`<link rel="canonical" href="${paperURL(paper)}">`));
        assert.equal(page.match(/<h1\b[^>]*>(.*?)<\/h1>/)[1], escapeHTML(paper.title));
        assert.deepEqual([...page.matchAll(/<meta name="citation_author" content="([^"]+)">/g)].map(match => match[1]), citationRecord(paper).authors.map(author => escapeHTML(author.name)));
        assert.equal((page.match(/\(corresponding author\)/g) || []).length, paper.authors.filter(author => author.corresponding).length);
        assert(!page.includes('equal-contrib'));
        const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
        assert.deepEqual(schema.author.map(author => author.name), citationRecord(paper).authors.map(author => author.name));
        assert.equal(schema.url, paperURL(paper));
        assert.equal(schema['@type'], paper.publication.venueGroup === 'Thesis' ? 'Thesis' : 'ScholarlyArticle');
    }
});

test('invalid or duplicate records fail before pages are generated', () => {
    const duplicate = structuredClone(data);
    duplicate.papers.push(duplicate.papers[0]);
    assert.throws(() => validatePublications(duplicate), /Duplicate/);
    const missing = structuredClone(data);
    missing.homepage.selectedPaperIds.push('missing-id');
    assert.throws(() => validatePublications(missing), /Unknown homepage/);
    const unsafe = structuredClone(data);
    unsafe.papers[0].links[0].url = 'javascript:alert(1)';
    assert.throws(() => validatePublications(unsafe), /Invalid URL/);
    const traversal = structuredClone(data);
    traversal.papers[0].id = '../outside';
    assert.throws(() => validatePublications(traversal), /Invalid paper ID/);
    const collision = structuredClone(data);
    collision.papers[1].id = collision.papers[0].id.replaceAll(':', '-');
    assert.throws(() => validatePublications(collision), /Duplicate paper path/);
    const evidence = structuredClone(data);
    evidence.papers.find(paper => paper.content.results.length).content.results[0].source = 'missing';
    assert.throws(() => validatePublications(evidence), /Unknown evidence source/);
    const source = structuredClone(data);
    source.papers.find(paper => paper.content).content.sources.paper.url = 'javascript:alert(1)';
    assert.throws(() => validatePublications(source), /Invalid source URL/);
    const format = structuredClone(data);
    format.papers.find(paper => paper.content).content.sources.paper.encodingFormat = 'text/html';
    assert.throws(() => validatePublications(format), /Unsupported source format/);
    const related = structuredClone(data);
    related.papers.find(paper => paper.id === 'arxiv:2503.01785').content.relatedWork.citing[0].evidence.url = 'javascript:alert(1)';
    assert.throws(() => validatePublications(related), /Invalid source URL/);
    const date = structuredClone(data);
    date.papers.find(paper => paper.id === 'arxiv:2503.01785').content.relatedWork.cited[0].firstPosted = '2025-02-30';
    assert.throws(() => validatePublications(date), /Invalid related paper date/);
    const postAsPaper = structuredClone(data);
    postAsPaper.papers.find(paper => paper.id === 'arxiv:2503.01785').content.relatedWork.cited[0].kind = 'post';
    assert.throws(() => validatePublications(postAsPaper), /Invalid related work kind/);
});

test('takeaway and related papers preserve metadata and citation direction', () => {
    const paper = structuredClone(data.papers.find(paper => paper.id === 'arxiv:2503.01785'));
    const removed = ['Intersection-over-Union (IoU) rewards', 'Qwen2-VL', 'COCO', 'LVIS', 'LISA'];
    assert.equal(paper.keywords.length, 10);
    assert(removed.every(keyword => !paper.keywords.includes(keyword)));
    paper.content.results[0].result = 81.3;
    paper.content.takeaway.text = 'A takeaway with <script>markup</script> & quotes.';
    paper.content.relatedWork.citing[0].quote = 'A quote with <script>markup</script> & punctuation.';
    const page = renderPaper(paper);
    assert(page.includes('<td>81.3</td>'));
    assert(page.includes(`<p>${escapeHTML(paper.content.takeaway.text)}`));
    assert(!page.includes('<script>markup</script>'));
    assert(page.includes(`<meta name="description" content="${escapeHTML(paper.content.takeaway.text)}">`));
    const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(schema.description, paper.content.takeaway.text);
    assert.deepEqual(schema.keywords, paper.keywords);
    assert(page.indexOf('id="takeaway-heading"') < page.indexOf('id="abstract-heading"'));
    assert(!page.includes('Findings to cite'));
    assert.deepEqual(schema.citation.map(item => item.url), paper.content.relatedWork.cited.map(item => item.url));
    assert(!schema.citation.some(item => paper.content.relatedWork.citing.some(citing => citing.url === item.url)));
    assert.equal((page.match(/class="paper-related-card"/g) || []).length, 2);
    for (const direction of ['cited', 'citing']) {
        for (const related of paper.content.relatedWork[direction]) {
            assert(page.includes(escapeHTML(related.title)));
            assert(page.includes(`datetime="${related.firstPosted}"`));
            assert(page.includes(escapeHTML(related.evidence.url)));
            if (related.quote) assert(page.includes(`<p>“${escapeHTML(related.quote)}”</p>`));
            if (related.attribution) assert(page.includes(escapeHTML(related.attribution)));
        }
    }
    assert(page.includes('X post · <time datetime="2025-03-10"'));
    assert(page.includes('Paper · First on arXiv · <time datetime="2025-05-18"'));
    assert(page.includes('Method comparison'));
    assert(page.includes('RLHF with a learned reward model'));
});

test('verified content stays consistent with metadata, citation exports, and source links', () => {
    const paper = structuredClone(data.papers.find(paper => paper.id === 'arxiv:2503.01785'));
    paper.content.abstract.text = 'An abstract with <script>alert(1)</script> & quotes.';
    const page = renderPaper(paper);
    assert(page.includes(`<p>${escapeHTML(paper.content.abstract.text)}</p>`));
    assert(!page.includes('<script>alert(1)</script>'));
    const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.equal(schema.abstract, paper.content.abstract.text);
    assert.equal(schema.pageStart, 2034);
    assert.equal(schema.pageEnd, 2044);
    assert.deepEqual(schema.keywords, paper.keywords);
    assert.deepEqual(schema.sameAs, [paper.citation.source.url, paper.links.find(link => link.type === 'arxiv').url]);
    assert(!page.includes('Scope of the evidence'));
    assert(!page.includes('Sources and versions'));
    for (const keyword of paper.keywords) assert(page.includes(escapeHTML(keyword)));
    const bibtex = renderBibTeX(paper);
    assert(bibtex.includes('pages     = {2034--2044}'));
    assert(bibtex.includes(`url       = {${paper.citation.source.url}}`));
    assert(bibtex.includes(paper.authors.map(author => author.name).join(' and ')));
    assert(page.includes(escapeHTML(bibtex)));
    assert.equal(paper.content.results[1].result, 40.6);
    assert(page.includes('Table 3, p. 2039'));
    assert(page.includes(`${paper.content.sources.paper.url}#page=6`));
    for (const markup of Object.values(publicationSections(data)).filter(value => typeof value === 'string')) {
        assert(markup.includes(escapeHTML(bibtex)));
    }
    const plainPaper = structuredClone(data.papers[0]);
    delete plainPaper.content;
    delete plainPaper.citation;
    assert(!renderPaper(plainPaper).includes('id="abstract-heading"'));
    assert.equal(renderBibTeX(plainPaper), '');
});

test('verified paper identity connects the preprint, proceedings and PDF from shared data', () => {
    const changed = structuredClone(data);
    const paper = changed.papers.find(record => record.id === 'arxiv:2503.01785');
    paper.citation.source.url = 'https://example.org/proceedings/updated';
    paper.content.sources.paper.url = 'https://example.org/papers/updated.pdf';
    const page = renderPaper(paper);
    const detail = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    const listed = publicationSections(changed).items.find(entry => entry.item.url === paperURL(paper)).item;
    for (const schema of [detail, listed]) {
        assert.equal(schema['@id'], `${paperURL(paper)}#paper`);
        assert.deepEqual(schema.identifier, { '@type': 'PropertyValue', propertyID: 'arXiv', value: '2503.01785' });
        assert.deepEqual(schema.sameAs, [paper.citation.source.url, 'https://arxiv.org/abs/2503.01785']);
        assert.equal(schema.isPartOf.name, paper.citation.booktitle);
        assert.deepEqual(schema.encoding, {
            '@type': 'MediaObject', name: paper.content.sources.paper.label,
            contentUrl: paper.content.sources.paper.url, encodingFormat: 'application/pdf'
        });
    }
    assert(page.includes(`href="${detail.encoding.contentUrl}"`));
    assert(renderBibTeX(paper).includes(`url       = {${detail.sameAs[0]}}`));
    const plain = changed.papers[0];
    delete plain.content;
    delete plain.citation;
    const plainSchema = publicationSections(changed).items.find(entry => entry.item.url === paperURL(plain)).item;
    assert.equal(plainSchema.encoding, undefined);
    assert.equal(plainSchema.identifier, undefined);
});

test('EndoCoT keeps training settings, source anchors and arXiv citation distinct', () => {
    const paper = structuredClone(data.papers.find(record => record.id === 'arxiv:2603.12252'));
    const page = renderPaper(paper);
    assert(page.includes('92.1%'));
    assert(page.includes('Unified training · one model for all tasks'));
    assert(page.includes('<td>84.2</td>'));
    assert(page.includes('<td>+7.1</td>'));
    assert(page.includes('<th scope="col">DiffThinker</th><th scope="col">EndoCoT</th>'));
    assert(!page.includes('Visual-RFT'));
    assert(!page.includes('<th scope="col">SFT</th>'));
    assert(!page.includes('data-direction="citing"'));
    assert(!page.includes('Related work and discussion'));
    assert(page.includes('https://arxiv.org/html/2603.12252v4#S5.T1'));
    assert(page.includes('https://arxiv.org/html/2603.12252v4#S4.SS2.SSS2'));
    assert(page.includes('ECCV'));
    assert(page.includes('<meta name="citation_journal_title" content="arXiv preprint arXiv:2603.12252">'));
    assert(!page.includes('citation_conference_title'));
    assert(!page.includes('undefined'));
    const bibtex = renderBibTeX(paper);
    assert(bibtex.startsWith('@article{dai2026endocot,'));
    assert(bibtex.includes('journal   = {arXiv preprint arXiv:2603.12252}'));
    assert(bibtex.includes(paper.authors.map(author => author.name).join(' and ')));
    assert(!bibtex.includes('pages'));
    const changed = structuredClone(data);
    changed.papers.find(record => record.id === paper.id).content.results[0].baseline = null;
    assert.throws(() => validatePublications(changed), /Invalid result/);
    const invalidCitation = structuredClone(data);
    delete invalidCitation.papers.find(record => record.id === paper.id).citation.journal;
    assert.throws(() => validatePublications(invalidCitation), /Missing citation journal/);
});

test('all 66 papers provide sourced content and citations; only Visual-RFT has related work', () => {
    assert.equal(data.papers.length, 66);
    validatePublications(data);
    for (const paper of data.papers) {
        const content = paper.content;
        assert(content.abstract.text.length > 100, `${paper.id}: missing abstract`);
        assert(content.takeaway.text && content.summary.text && content.contributions.length >= 2);
        assert(content.results.length || content.resultNotes?.length, `${paper.id}: missing results`);
        assert(paper.keywords.length >= 8 && paper.citation);
        const page = renderPaper(paper);
        for (const heading of ['takeaway', 'abstract', 'summary', 'contributions', 'method-comparison', 'results', 'citation']) {
            assert(page.includes(`id="${heading}-heading"`), `${paper.id}: missing ${heading}`);
        }
        assert.equal(page.includes('id="related-heading"'), paper.id === 'arxiv:2503.01785');
        assert(!page.includes('undefined') && !page.includes('this https URL') && !page.includes('this http URL'));
        assert(!/[\\${}]/.test(content.abstract.text), `${paper.id}: unrendered abstract markup`);
        assert(page.includes(`<meta name="citation_pdf_url" content="${escapeHTML(paper.citation.pdfURL || content.sources.paper.url)}">`));
        assert(page.includes(`href="${bibtexPath(paper).split('/').at(-1)}" download`));
        const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
        assert.equal(schema.abstract, content.abstract.text);
        assert.equal(schema.description, content.takeaway.text);
        assert.equal(schema.citation !== undefined, paper.id === 'arxiv:2503.01785');
        const year = paper.citation.year ?? paper.publication.year;
        assert(page.includes(`<meta name="citation_publication_date" content="${year}">`));
        assert.equal(schema.datePublished, paper.citation.status === 'preprint' ? paper.dates.arxivFirstPosted : String(year));
        assert(schema.datePublished.startsWith(String(year)));
        assert(renderBibTeX(paper).includes(`year      = {${year}}`));
        if (content.resultNotes) {
            assert(!page.includes('class="paper-results"'));
            for (const item of content.resultNotes) {
                assert(page.includes(escapeHTML(item.text)));
                const sourceURL = content.sources[item.source].url;
                assert(page.includes(`href="${escapeHTML(sourceURL + (item.page ? `#page=${item.page}` : item.fragment ? `#${encodeURIComponent(item.fragment)}` : ''))}"`));
            }
        }
    }
    const invalidEvidence = structuredClone(data);
    invalidEvidence.papers[0].content.resultNotes[0].source = 'unknown';
    assert.throws(() => validatePublications(invalidEvidence), /Unknown evidence source/);
    const unwantedSection = structuredClone(data);
    unwantedSection.papers[0].content.relatedWork = { cited: [], citing: [] };
    assert.throws(() => validatePublications(unwantedSection), /Related work is reserved/);
});

test('published citations retain version-specific titles, authors, years and journal fields', () => {
    const find = id => data.papers.find(paper => paper.id === `arxiv:${id}`);
    const kit = find('2407.11691');
    assert.equal(kit.authors.length, 44);
    assert.equal(citationRecord(kit).authors.length, 12);
    const kitBib = renderBibTeX(kit);
    assert(kitBib.includes('Haodong Duan and Junming Yang and Yuxuan Qiao and Xinyu Fang'));
    assert(kitBib.includes('10.1145/3664647.3685520'));
    const kitPage = renderPaper(kit);
    assert(kitPage.includes('This citation uses the author list of the published version.'));
    const schema = JSON.parse(kitPage.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    assert.deepEqual(schema.identifier.map(identifier => identifier.propertyID), ['arXiv', 'DOI']);
    const pyramid = find('2410.17247');
    assert(renderBibTeX(pyramid).includes('Conical Visual Concentration for Efficient Large Vision-Language Models'));
    assert.equal(renderPaper(pyramid).match(/<h1\b[^>]*>(.*?)<\/h1>/)[1], escapeHTML(pyramid.title));
    const context = find('2305.18279');
    const contextBib = renderBibTeX(context);
    for (const field of ['year      = {2025}', 'volume    = {133}', 'number    = {2}', 'pages     = {825--843}', 'doi       = {10.1007/s11263-024-02214-4}']) assert(contextBib.includes(field));
    const longclip = find('2403.15378');
    assert.equal(longclip.publication.year, 2024);
    assert.equal(longclip.citation.year, 2025); // Publisher's book year differs from the ECCV event year.
    const conferenceRecord = find('2508.04700');
    assert(renderBibTeX(conferenceRecord).startsWith('@inproceedings'));
    assert(!renderBibTeX(conferenceRecord).includes('pages'));
    assert(!renderPaper(conferenceRecord).includes('citation_firstpage'));
});

test('every paper provides full-text result evidence with explicit table, section or page locators', () => {
    for (const paper of data.papers) {
        const evidence = paper.content.results.length ? paper.content.results : paper.content.resultNotes;
        assert(evidence.length >= 2, paper.id);
        for (const item of evidence) {
            const source = paper.content.sources[item.source];
            assert(item.page || item.fragment, `${paper.id}: missing precise locator`);
            assert(/Table|Section|Chapter/i.test(item.locator), `${paper.id}: missing human-readable locator`);
            assert(!/\/abs\//.test(source.url), `${paper.id}: results still link only to an abstract`);
            assert(source.encodingFormat === 'application/pdf' || /\/html\//.test(source.url), `${paper.id}: missing full-text source`);
        }
    }
});

test('preprint citations use their own year and doctoral citations use the institution', () => {
    const paper = structuredClone(data.papers.find(record => record.citation.status === 'preprint'));
    paper.publication.year = paper.citation.year + 1;
    const bibtex = renderBibTeX(paper);
    assert(bibtex.includes(`year      = {${paper.citation.year}}`));
    assert(!bibtex.includes('booktitle') && !bibtex.includes('pages'));
    const thesis = data.papers.find(record => record.citation.type === 'phdthesis');
    const thesisBibtex = renderBibTeX(thesis);
    assert(thesisBibtex.startsWith('@phdthesis{zang2023realworld,'));
    assert(thesisBibtex.includes('school    = {Nanyang Technological University}'));
    assert(thesisBibtex.includes('doi       = {10.32657/10356/171489}'));
    assert(!thesisBibtex.includes('journal') && !thesisBibtex.includes('undefined'));
    const invalid = structuredClone(data);
    delete invalid.papers.find(record => record.citation.type === 'phdthesis').citation.school;
    assert.throws(() => validatePublications(invalid), /Missing thesis school/);
});

test('one data change propagates to static pages and JSON-LD; rebuilds are deterministic', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'publication-render-'));
    const root = pathToFileURL(`${dir}/`);
    try {
        await mkdir(join(dir, 'data'));
        for (const name of ['index.html', 'research.html']) {
            await writeFile(join(dir, name), await readFile(new URL(`../${name}`, import.meta.url)));
        }
        const changed = structuredClone(data);
        const paper = changed.papers.find(p => p.id === changed.homepage.selectedPaperIds[0]);
        paper.title = 'Test <title> & $& </script>';
        paper.authors[0].name = 'Test Author';
        changed.homepage.defaultVisibleCount = 7;
        await writeFile(join(dir, 'data/publications.json'), JSON.stringify(changed));
        await renderPublicationPages(root);
        const home = await readFile(join(dir, 'index.html'), 'utf8');
        const research = await readFile(join(dir, 'research.html'), 'utf8');
        for (const html of [home, research]) {
            assert(html.includes('<papertitle>Test &lt;title&gt; &amp; $&amp; &lt;/script&gt;</papertitle>'));
            assert(html.includes('Test Author'));
        }
        assert(home.includes('data-limit="7"'));
        const schema = JSON.parse(research.match(/<script id="publications-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
        assert(schema.mainEntity.itemListElement.some(entry => entry.item.name === paper.title));
        const homeSchema = JSON.parse(home.match(/<script id="selected-publications-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
        assert.equal(homeSchema['@type'], 'ItemList');
        assert.equal(homeSchema.numberOfItems, changed.homepage.selectedPaperIds.length);
        assert.deepEqual(homeSchema.itemListElement.map(entry => entry.item.url), changed.homepage.selectedPaperIds.map(id => paperURL(changed.papers.find(record => record.id === id))));
        assert.equal(homeSchema.itemListElement[0].item.name, paper.title);
        assert.equal(homeSchema.itemListElement[0].item.author[0].name, 'Test Author');
        for (const entry of homeSchema.itemListElement) {
            assert.deepEqual(entry.item, schema.mainEntity.itemListElement.find(record => record.item['@id'] === entry.item['@id']).item);
        }
        const detail = await readFile(new URL(paperPath(paper).slice(1), root), 'utf8');
        assert.equal(detail.match(/<h1\b[^>]*>(.*?)<\/h1>/)[1], 'Test &lt;title&gt; &amp; $&amp; &lt;/script&gt;');
        assert(detail.includes('<meta name="citation_author" content="Test Author">'));
        const detailSchema = JSON.parse(detail.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
        assert.equal(detailSchema.name, paper.title);
        const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8');
        for (const record of data.papers) {
            assert(sitemap.includes(`<loc>${paperURL(record)}</loc><lastmod>${record.content.verifiedOn}</lastmod>`));
        }
        assert.equal((sitemap.match(/<loc>/g) || []).length, data.papers.length + 2);
        assert.equal((sitemap.match(/<lastmod>/g) || []).length, data.papers.length + 2);
        const person = JSON.parse(home.match(/<script id="person-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
        assert.equal(person['@id'], personID);
        assert.equal(person['@context'], 'https://schema.org');
        assert.equal(schema.author['@id'], personID);
        for (const label of ['ORCID', 'Google Scholar', 'DBLP', 'OpenAlex', 'Semantic Scholar']) {
            const profile = authorProfiles(data.author).find(item => item.label === label);
            assert(home.includes(`<a href="${profile.url}" target="_blank" rel="me noopener noreferrer">${label}</a>`), label);
        }
        assert.equal((home.match(/class="profile-links"/g) || []).length, 1);
        assert(detail.includes(`<meta name="citation_author_orcid" content="https://orcid.org/${data.author.identifiers.orcid}">`));
        const llms = await readFile(join(dir, 'llms.txt'), 'utf8');
        assert(llms.includes(`[${paper.title}](${paperURL(paper)})`));
        assert.equal(llms, renderLLMsIndex(changed));
        const full = await readFile(join(dir, 'llms-full.txt'), 'utf8');
        assert(full.includes(`# ${paper.title}`) && full.includes('Test Author'));
        assert.equal(full, renderLLMsFull(changed));
        assert.equal(await readFile(join(dir, 'publications.bib'), 'utf8'), renderBibliography(changed));
        for (const record of changed.papers.filter(record => record.citation)) {
            assert.equal(await readFile(new URL(bibtexPath(record).slice(1), root), 'utf8'), renderBibTeX(record));
        }
        await renderPublicationPages(root);
        assert.equal(await readFile(join(dir, 'index.html'), 'utf8'), home);
        assert.equal(await readFile(join(dir, 'research.html'), 'utf8'), research);
        assert.equal(await readFile(new URL(paperPath(paper).slice(1), root), 'utf8'), detail);
        assert.equal(await readFile(new URL('sitemap.xml', root), 'utf8'), sitemap);
        assert.equal(await readFile(join(dir, 'llms.txt'), 'utf8'), llms);
        assert.equal(await readFile(join(dir, 'llms-full.txt'), 'utf8'), full);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('the author is one Person node shared by the profile, list pages and every paper', () => {
    const author = data.author;
    const person = personSchema(author);
    assert.equal(person['@id'], personID);
    assert.equal(person.name, 'Yuhang Zang');
    const profiles = authorProfiles(author);
    assert.deepEqual(person.sameAs, profiles.map(profile => profile.url));
    for (const label of ['ORCID', 'Google Scholar', 'DBLP', 'OpenAlex', 'Semantic Scholar', 'GitHub', 'Hugging Face']) {
        assert(profiles.some(profile => profile.label === label), `missing profile: ${label}`);
    }
    assert(person.sameAs.includes(`https://orcid.org/${author.identifiers.orcid}`));
    assert(person.identifier.some(item => item.propertyID === 'ORCID' && item.value === `https://orcid.org/${author.identifiers.orcid}`));
    assert(person.alternateName.includes('臧宇航'));
    for (const paper of data.papers) {
        const page = renderPaper(paper, { author });
        const schema = JSON.parse(page.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
        const self = schema.author.filter(entry => entry.name === 'Yuhang Zang');
        const listed = citationRecord(paper).authors.some(entry => entry.name === 'Yuhang Zang');
        assert.equal(self.length, listed ? 1 : 0, paper.id);
        if (listed) {
            assert.equal(self[0]['@id'], personID);
            assert(page.includes('<meta name="citation_author" content="Yuhang Zang">\n<meta name="citation_author_orcid" content="https://orcid.org/' + author.identifiers.orcid + '">'));
        }
        assert(schema.author.filter(entry => entry.name !== 'Yuhang Zang').every(entry => entry['@id'] === undefined));
        assert(!renderPaper(paper).includes('citation_author_orcid'));
        if (paper.dates) {
            assert(page.includes(`<meta name="citation_online_date" content="${paper.dates.arxivFirstPosted.replaceAll('-', '/')}">`));
            assert.equal(schema.dateCreated, paper.dates.arxivFirstPosted);
            assert.equal(schema.dateModified, paper.dates.arxivLastUpdated);
            assert(paper.dates.arxivFirstPosted <= paper.dates.arxivLastUpdated);
        } else {
            assert.equal(paper.identifiers.arxiv, undefined);
            assert(!page.includes('citation_online_date'));
        }
        assert(page.includes('<link rel="alternate" type="application/json" href="../data/publications.json"'));
    }
    const missingDates = structuredClone(data);
    delete missingDates.papers.find(paper => paper.dates).dates;
    assert.throws(() => validatePublications(missingDates), /Missing arXiv dates/);
    const badOrder = structuredClone(data);
    badOrder.papers.find(paper => paper.dates).dates.arxivLastUpdated = '2000-01-01';
    assert.throws(() => validatePublications(badOrder), /out of order/);
    const badOrcid = structuredClone(data);
    badOrcid.author.identifiers.orcid = '1234';
    assert.throws(() => validatePublications(badOrcid), /Invalid ORCID/);
});

test('llms.txt, llms-full.txt and publications.bib cover every paper with its evidence and citation', () => {
    const index = renderLLMsIndex(data);
    assert(index.startsWith('# Yuhang Zang\n\n> '));
    assert(index.includes(`${siteURL}/data/publications.json`));
    const full = renderLLMsFull(data);
    const bibliography = renderBibliography(data);
    for (const paper of data.papers) {
        assert(index.includes(`[${paper.title}](${paperURL(paper)})`), paper.id);
        assert(index.includes(paper.content.takeaway.text), paper.id);
        assert(full.includes(`# ${paper.title}\n\n- Page: ${paperURL(paper)}`), paper.id);
        assert(full.includes(paper.content.abstract.text), paper.id);
        assert(full.includes(formatCitation(paper)), paper.id);
        for (const item of [...paper.content.contributions, ...(paper.content.resultNotes || [])]) {
            assert(full.includes(item.text), paper.id);
            assert(full.includes(paper.content.sources[item.source].url), paper.id);
        }
        assert(bibliography.includes(renderBibTeX(paper)), paper.id);
        assert(full.includes(renderBibTeX(paper).trimEnd()), paper.id);
    }
    assert.equal((bibliography.match(/^@/gm) || []).length, data.papers.filter(paper => paper.citation).length);
    assert.equal((full.match(/^# /gm) || []).length, data.papers.length + 1);
    for (const profile of authorProfiles(data.author)) assert(index.includes(profile.url) && full.includes(profile.url));
    assert(!index.includes('undefined') && !full.includes('undefined') && !bibliography.includes('undefined'));
});

