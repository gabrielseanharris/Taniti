const searchForm = document.querySelector('.header-search');

if (searchForm) {
    const searchInput = searchForm.querySelector('input[type="search"]');
    const searchStatus = searchForm.querySelector('.search-status');
    const searchableSelector = 'header h1, main h1, main h2, main p, main li';
    const landingUrl = new URL('landing-page.html', window.location.href);
    const isLandingPage = window.location.pathname === landingUrl.pathname;
    const resultsPanel = document.createElement('section');
    resultsPanel.className = 'site-search-results';
    resultsPanel.setAttribute('aria-label', 'Website search results');
    resultsPanel.hidden = true;
    document.querySelector('main')?.append(resultsPanel);

    function getSearchableItems(container) {
        return Array.from(container.querySelectorAll(searchableSelector))
            .filter((item) => !item.closest('.site-search-results'));
    }

    const ignoredWords = new Set([
        'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'best', 'can', 'could',
        'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of',
        'on', 'or', 'please', 'should', 'some', 'tell', 'that', 'the', 'their', 'them',
        'there', 'these', 'they', 'this', 'to', 'what', 'when', 'where', 'which',
        'who', 'why', 'with', 'would', 'you', 'your',
    ]);

    function normalizeText(text) {
        return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    }

    function getQueryTerms(query) {
        const words = normalizeText(query).split(/\s+/).filter(Boolean);
        const usefulWords = words.filter((word) => !ignoredWords.has(word));
        return [...new Set(usefulWords.length ? usefulWords : words)];
    }

    function getWordForms(word) {
        const forms = new Set([word]);

        if (word.length > 4 && word.endsWith('ing')) {
            const stem = word.slice(0, -3);
            forms.add(stem);
            forms.add(`${stem}e`);
            if (/(.)\1$/.test(stem)) forms.add(stem.slice(0, -1));
        }

        return [...forms];
    }

    function differsByOneCharacter(first, second) {
        if (Math.abs(first.length - second.length) > 1) return false;
        let firstIndex = 0;
        let secondIndex = 0;
        let differences = 0;

        while (firstIndex < first.length && secondIndex < second.length) {
            if (first[firstIndex] === second[secondIndex]) {
                firstIndex += 1;
                secondIndex += 1;
                continue;
            }
            differences += 1;
            if (differences > 1) return false;
            if (first.length > second.length) firstIndex += 1;
            else if (second.length > first.length) secondIndex += 1;
            else {
                firstIndex += 1;
                secondIndex += 1;
            }
        }

        if (firstIndex < first.length || secondIndex < second.length) differences += 1;
        return differences <= 1;
    }

    function getRankedMatches(container, query) {
        const normalizedQuery = normalizeText(query);
        const queryTerms = getQueryTerms(query);
        if (!queryTerms.length) return [];

        return getSearchableItems(container)
            .map((item, elementIndex) => {
                const normalizedText = normalizeText(item.textContent);
                const textWords = new Set(normalizedText.split(/\s+/));
                const matchedTerms = queryTerms.filter((term) => {
                    const forms = getWordForms(term);
                    if (forms.some((form) => textWords.has(form))) return true;
                    return [...textWords].some((word) => forms.some((form) =>
                        Math.min(word.length, form.length) >= 4
                        && Math.abs(word.length - form.length) <= 2
                        && (
                            word.startsWith(form)
                            || form.startsWith(word)
                            || (Math.min(word.length, form.length) >= 5 && differsByOneCharacter(word, form))
                        )
                    ));
                });
                const exactPhrase = normalizedText.includes(normalizedQuery);
                const coverage = matchedTerms.length / queryTerms.length;
                const minimumCoverage = queryTerms.length >= 4 ? 0.3 : queryTerms.length >= 2 ? 0.5 : 1;
                if (!exactPhrase && coverage < minimumCoverage) return null;

                return {
                    match: item,
                    elementIndex,
                    score: (exactPhrase ? 1000 : 0) + coverage * 100 + matchedTerms.length,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
    }

    function highlightMatch(match) {
        document.querySelectorAll('.search-match').forEach((item) => {
            item.classList.remove('search-match');
        });
        if (!match) return;
        match.classList.add('search-match');
        match.setAttribute('tabindex', '-1');
        match.focus({ preventScroll: true });
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        match.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }

    function makePreview(text, query) {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const lowerText = cleanText.toLocaleLowerCase();
        const exactMatchAt = lowerText.indexOf(query.toLocaleLowerCase());
        const termMatchAt = getQueryTerms(query)
            .flatMap((term) => getWordForms(term))
            .map((term) => lowerText.indexOf(term))
            .filter((index) => index >= 0)
            .sort((a, b) => a - b)[0];
        const matchAt = exactMatchAt >= 0 ? exactMatchAt : (termMatchAt ?? 0);
        const start = Math.max(0, matchAt - 55);
        const end = Math.min(cleanText.length, matchAt + Math.min(query.length, 60) + 95);
        return `${start > 0 ? '…' : ''}${cleanText.slice(start, end)}${end < cleanText.length ? '…' : ''}`;
    }

    function showResults(results, originalQuery) {
        resultsPanel.replaceChildren();
        resultsPanel.hidden = false;

        const heading = document.createElement('h2');
        heading.textContent = results.length
            ? `${results.length} result${results.length === 1 ? '' : 's'} for “${originalQuery}”`
            : `No results found for “${originalQuery}”`;
        resultsPanel.append(heading);

        if (!results.length) return;

        const list = document.createElement('ul');
        results.forEach((result) => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            const target = new URL(result.url.href);
            target.searchParams.set('q', originalQuery);
            target.searchParams.set('match', String(result.elementIndex));
            link.href = target.href;
            link.textContent = result.sectionTitle
                ? `${result.pageTitle} — ${result.sectionTitle}`
                : result.pageTitle;

            const preview = document.createElement('p');
            preview.textContent = makePreview(result.match.textContent, originalQuery);
            item.append(link, preview);
            list.append(item);
        });
        resultsPanel.append(list);
    }

    async function searchWebsite(originalQuery) {
        searchStatus.textContent = 'Searching the website…';
        resultsPanel.hidden = true;
        const pages = window.PET_PROFESSIONALS_SEARCH_INDEX || [];
        const results = pages.flatMap(({ path, html }) => {
            const pageDocument = new DOMParser().parseFromString(html, 'text/html');
            const pageMatches = getRankedMatches(pageDocument, originalQuery);
            const pageTitle = pageDocument.querySelector('header h1')?.textContent.trim()
                || pageDocument.title
                || path;
            return pageMatches.map((result) => {
                const sectionTitle = Array.from(pageDocument.querySelectorAll('main h1, main h2'))
                    .filter((heading) => heading === result.match
                        || (heading.compareDocumentPosition(result.match) & Node.DOCUMENT_POSITION_FOLLOWING))
                    .at(-1)?.textContent.trim();
                return {
                    url: new URL(path, window.location.href),
                    pageTitle,
                    sectionTitle,
                    ...result,
                };
            });
        });
        results.sort((a, b) => b.score - a.score);
        showResults(results, originalQuery);
        searchStatus.textContent = results.length
            ? `Found ${results.length} matching spot${results.length === 1 ? '' : 's'} across the website.`
            : 'The site search index is empty. Refresh the search index and try again.';
    }

    const params = new URLSearchParams(window.location.search);
    const incomingQuery = params.get('q');
    const incomingMatch = Number.parseInt(params.get('match'), 10);

    if (incomingQuery) {
        searchInput.value = incomingQuery;
        if (params.has('match')) {
            const matches = getSearchableItems(document);
            const selectedMatch = matches[incomingMatch] || matches[0];
            highlightMatch(selectedMatch);
            if (selectedMatch) searchStatus.textContent = `Showing a result for “${incomingQuery}”.`;
        } else {
            searchWebsite(incomingQuery).then(() => {
                searchInput.focus({ preventScroll: true });
            });
        }
    }

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const originalQuery = searchInput.value.trim();
        if (!originalQuery) {
            searchStatus.textContent = 'Enter a word or phrase to search the website.';
            searchInput.focus();
            resultsPanel.hidden = true;
            return;
        }

        if (!isLandingPage && window.location.protocol !== 'file:') {
            landingUrl.searchParams.set('q', originalQuery);
            window.location.href = landingUrl.href;
            return;
        }

        searchWebsite(originalQuery);
    });
}
