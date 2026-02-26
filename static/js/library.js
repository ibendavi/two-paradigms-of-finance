/**
 * Library: search, filter, sort, infinite scroll, and author journeys.
 */
(function () {
  'use strict';

  const data = window.LIBRARY_DATA || [];
  if (!data.length) return;

  const BATCH_SIZE = 60;
  let rendered = 0;          // rows currently in DOM
  let sortField = 'year';
  let sortDir = 1;           // 1 = asc, -1 = desc
  let filtered = data;

  // Elements
  const searchInput = document.getElementById('library-search');
  const streamFilter = document.getElementById('filter-stream');
  const topicFilter = document.getElementById('filter-topic');
  const eraFilter = document.getElementById('filter-era');
  const haveFilter = document.getElementById('filter-have');
  const tbody = document.getElementById('library-tbody');
  const stats = document.getElementById('library-stats');
  const loadMore = document.getElementById('library-load-more');
  const journeyPanel = document.getElementById('author-journey');

  // Populate topic filter dynamically
  const topics = [...new Set(data.map(d => d.topic).filter(Boolean))].sort();
  const existingTopics = new Set([...topicFilter.options].map(o => o.value));
  topics.forEach(t => {
    if (!existingTopics.has(t)) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      topicFilter.appendChild(opt);
    }
  });

  // ------------------------------------------------------------------
  // Author index: build map of normalized author key -> entries
  // ------------------------------------------------------------------
  const authorIndex = {};
  data.forEach(d => {
    const keys = getAuthorKeys(d.author);
    keys.forEach(k => {
      if (!authorIndex[k]) authorIndex[k] = [];
      authorIndex[k].push(d);
    });
  });

  // Authors with 2+ works (for clickable names)
  const multiWorkAuthors = new Set();
  Object.keys(authorIndex).forEach(k => {
    if (authorIndex[k].length >= 2) multiWorkAuthors.add(k);
  });

  function getAuthorKeys(authorStr) {
    if (!authorStr) return [];
    // Split on semicolons or " and " to handle multi-author entries
    // Then normalize each to "surname" (first word, lowercased)
    const parts = authorStr.split(/[;&]|,\s+(?=[A-Z])|\band\b/i);
    const keys = [];
    parts.forEach(p => {
      const trimmed = p.trim();
      if (!trimmed) return;
      // Use full name (lowercased, trimmed) as key for better matching
      const normalized = trimmed.replace(/[.,]/g, '').trim().toLowerCase();
      if (normalized.length > 2) keys.push(normalized);
    });
    return keys;
  }

  function getPrimaryAuthorKey(authorStr) {
    if (!authorStr) return '';
    // Get the primary (first-listed) author's surname for display matching
    const surname = authorStr.split(/[,;]/)[0].trim().toLowerCase().replace(/[.]/g, '');
    return surname;
  }

  // ------------------------------------------------------------------
  // Era ranges
  // ------------------------------------------------------------------
  function getEraRange(era) {
    switch (era) {
      case 'pre-1800': return [0, 1799];
      case '1800-1900': return [1800, 1900];
      case '1900-1958': return [1901, 1957];
      case '1958-1980': return [1958, 1980];
      case '1980-present': return [1981, 9999];
      default: return [0, 9999];
    }
  }

  // ------------------------------------------------------------------
  // Filter + sort
  // ------------------------------------------------------------------
  function applyFilters() {
    const query = (searchInput.value || '').toLowerCase().trim();
    const stream = streamFilter.value;
    const topic = topicFilter.value;
    const era = eraFilter.value;
    const have = haveFilter.value;
    const [eraMin, eraMax] = getEraRange(era);

    filtered = data.filter(d => {
      if (query) {
        const hay = (d.author + ' ' + d.title + ' ' + d.key_concepts).toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (stream && d.stream !== stream) return false;
      if (topic && d.topic !== topic) return false;
      if (era) {
        const y = Number(d.year) || 0;
        if (y < eraMin || y > eraMax) return false;
      }
      if (have === 'yes' && !d.have) return false;
      if (have === 'no' && d.have) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (sortField === 'year') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return -sortDir;
      if (va > vb) return sortDir;
      return 0;
    });

    // Reset and render first batch
    rendered = 0;
    tbody.innerHTML = '';
    renderBatch();
    updateStats();
  }

  // ------------------------------------------------------------------
  // Render rows incrementally
  // ------------------------------------------------------------------
  function renderBatch() {
    const end = Math.min(rendered + BATCH_SIZE, filtered.length);
    if (rendered >= end) {
      loadMore.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = rendered; i < end; i++) {
      const d = filtered[i];
      const tr = document.createElement('tr');

      // Year
      const tdYear = document.createElement('td');
      tdYear.className = 'year-col';
      tdYear.textContent = d.year ? String(d.year) : '';
      tr.appendChild(tdYear);

      // Author (clickable if multi-work)
      const tdAuthor = document.createElement('td');
      const authorKey = getPrimaryAuthorKey(d.author);
      if (authorKey && multiWorkAuthors.has(authorKey)) {
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'author-link';
        link.textContent = d.author;
        link.dataset.authorKey = authorKey;
        link.addEventListener('click', onAuthorClick);
        tdAuthor.appendChild(link);
      } else {
        tdAuthor.textContent = d.author;
      }
      tr.appendChild(tdAuthor);

      // Title
      const tdTitle = document.createElement('td');
      if (d.url) {
        const a = document.createElement('a');
        a.href = d.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = d.title;
        tdTitle.appendChild(a);
      } else {
        tdTitle.textContent = d.title;
      }
      tr.appendChild(tdTitle);

      // Stream
      const tdStream = document.createElement('td');
      tdStream.className = 'stream-col' + (d.stream ? ' stream-' + d.stream.toLowerCase() : '');
      tdStream.textContent = d.stream;
      tr.appendChild(tdStream);

      // Topic
      const tdTopic = document.createElement('td');
      tdTopic.textContent = d.topic;
      tr.appendChild(tdTopic);

      fragment.appendChild(tr);
    }
    tbody.appendChild(fragment);
    rendered = end;

    // Show/hide load-more sentinel
    loadMore.style.display = rendered < filtered.length ? 'block' : 'none';
  }

  function updateStats() {
    const total = filtered.length;
    const haveCount = filtered.filter(d => d.have).length;
    const showing = Math.min(rendered, total);
    stats.textContent = `Showing ${showing} of ${total} textbooks (${haveCount} in collection)`;
  }

  // ------------------------------------------------------------------
  // Infinite scroll via IntersectionObserver
  // ------------------------------------------------------------------
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && rendered < filtered.length) {
      renderBatch();
      updateStats();
    }
  }, { rootMargin: '200px' });

  observer.observe(loadMore);

  // ------------------------------------------------------------------
  // Author Journey
  // ------------------------------------------------------------------
  function onAuthorClick(e) {
    e.preventDefault();
    const key = e.currentTarget.dataset.authorKey;
    showAuthorJourney(key, e.currentTarget.textContent);
  }

  function showAuthorJourney(key, displayName) {
    const works = (authorIndex[key] || [])
      .slice()
      .sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0));

    if (works.length < 2) return;

    document.getElementById('journey-author-name').textContent = displayName;

    const yearRange = works.filter(w => w.year).map(w => Number(w.year));
    const span = yearRange.length ? `${Math.min(...yearRange)}\u2013${Math.max(...yearRange)}` : '';
    const subtitle = `${works.length} works spanning ${span}`;
    document.getElementById('journey-subtitle').textContent = subtitle;

    const container = document.getElementById('journey-timeline');
    container.innerHTML = '';

    works.forEach(w => {
      const item = document.createElement('div');
      item.className = 'journey-item';

      const dot = document.createElement('div');
      dot.className = 'journey-dot';
      if (w.stream === 'Academic') dot.classList.add('academic');
      else if (w.stream === 'Practitioner') dot.classList.add('practitioner');

      const year = document.createElement('div');
      year.className = 'journey-year';
      year.textContent = w.year || '?';

      const title = document.createElement('div');
      title.className = 'journey-title';
      title.textContent = w.title;

      const meta = document.createElement('div');
      meta.className = 'journey-meta';
      const parts = [];
      if (w.stream) parts.push(w.stream);
      if (w.topic) parts.push(w.topic);
      meta.textContent = parts.join(' \u00B7 ');

      item.appendChild(dot);
      const info = document.createElement('div');
      info.className = 'journey-info';
      info.appendChild(year);
      info.appendChild(title);
      info.appendChild(meta);
      item.appendChild(info);

      container.appendChild(item);
    });

    journeyPanel.style.display = 'block';
    journeyPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('journey-close').addEventListener('click', function () {
    journeyPanel.style.display = 'none';
  });

  // ------------------------------------------------------------------
  // Event listeners
  // ------------------------------------------------------------------
  searchInput.addEventListener('input', debounce(applyFilters, 200));
  streamFilter.addEventListener('change', applyFilters);
  topicFilter.addEventListener('change', applyFilters);
  eraFilter.addEventListener('change', applyFilters);
  haveFilter.addEventListener('change', applyFilters);

  // Sort headers
  document.querySelectorAll('.library-table th[data-sort]').forEach(th => {
    th.addEventListener('click', function () {
      const field = this.dataset.sort;
      if (sortField === field) {
        sortDir *= -1;
      } else {
        sortField = field;
        sortDir = 1;
      }
      document.querySelectorAll('.library-table th .sort-arrow').forEach(s => s.textContent = '');
      this.querySelector('.sort-arrow').textContent = sortDir === 1 ? ' \u25B2' : ' \u25BC';
      applyFilters();
    });
  });

  function debounce(fn, ms) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  // Init
  applyFilters();
})();
