/**
 * Interactive Timeline for The Two Paradigms of Finance
 * ~2,800 textbooks scored on EPS-vs-NPV spectrum.
 * Y-position = paradigm score from content analysis.
 * Highlighted dots = research notes with evidence pages.
 */
(function () {
  'use strict';

  const data = window.TIMELINE_DATA || [];
  if (!data.length) return;

  const canvas = document.getElementById('timeline-canvas');
  const wrapper = document.getElementById('timeline-wrapper');
  const popup = document.getElementById('timeline-popup');
  const ctx = canvas.getContext('2d');

  // Colors (warm palette)
  const COLORS = {
    'pre-split':     '#94a3b8',
    'transitional':  '#a78bfa',
    'academic':      '#5ba4cf',
    'practitioner':  '#d4a017',
  };
  const BG = '#1c1a22';
  const BORDER = '#363040';
  const TEXT = '#ede8d8';
  const TEXT_MUTED = '#706a5a';
  const AXIS_COLOR = '#4a4458';

  // State
  let filter = 'all';
  let hoveredIdx = -1;
  let selectedIdx = -1;
  let dpr = window.devicePixelRatio || 1;

  // Year range
  const years = data.map(d => d.year).filter(y => y > 0);
  const minYear = Math.min(...years) - 10;
  const maxYear = Math.max(...years) + 10;

  // Layout
  const PADDING = { top: 70, bottom: 60, left: 80, right: 100 };
  const DOT_R = 2.5;          // regular dot
  const DOT_R_NOTE = 6;       // research-note dot
  const DOT_R_HOVER = 9;
  const SPLIT_YEAR = 1958;

  // Simple hash for deterministic jitter
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  function resize() {
    const rect = wrapper.getBoundingClientRect();
    const w = rect.width;
    const h = 560;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function yearToX(year) {
    const w = canvas.width / dpr;
    const usable = w - PADDING.left - PADDING.right;
    return PADDING.left + ((year - minYear) / (maxYear - minYear)) * usable;
  }

  function scoreToY(score) {
    // score: -1 (practitioner/EPS, bottom) to +1 (academic/NPV, top)
    const h = canvas.height / dpr;
    const centerY = h / 2;
    const halfRange = (h - PADDING.top - PADDING.bottom) / 2;
    // Negative score → below center, positive → above center
    return centerY - score * halfRange;
  }

  function getFiltered() {
    return data.filter(d => {
      if (d.year <= 0) return false;
      if (filter === 'all') return true;
      return d.paradigm === filter;
    });
  }

  // Layout: use score for Y, add small jitter for visual spread
  function layoutDots(items) {
    return items.map(d => {
      const seed = hashStr(d.author + d.title);
      const jitter = (seed % 30 - 15) * 0.3;
      return {
        x: yearToX(d.year),
        y: scoreToY(d.score || 0) + jitter,
        d: d,
      };
    });
  }

  // Compute trend lines from decade averages of score
  function computeTrends(positions) {
    function avgByDecade(pts) {
      const buckets = {};
      pts.forEach(p => {
        const dec = Math.floor(p.d.year / 10) * 10;
        if (!buckets[dec]) buckets[dec] = [];
        buckets[dec].push(p.y);
      });
      return Object.keys(buckets)
        .map(Number)
        .sort((a, b) => a - b)
        .map(dec => ({
          x: yearToX(dec + 5),
          y: buckets[dec].reduce((a, b) => a + b, 0) / buckets[dec].length,
        }));
    }

    const acad = positions.filter(p => p.d.paradigm === 'academic');
    const prac = positions.filter(p => p.d.paradigm === 'practitioner');

    return {
      academic: avgByDecade(acad),
      practitioner: avgByDecade(prac),
    };
  }

  function draw() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const centerY = h / 2;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const splitX = yearToX(SPLIT_YEAR);
    const halfRange = (h - PADDING.top - PADDING.bottom) / 2;

    // --- Divergence cone ---
    const coneEndX = w - PADDING.right;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(splitX, centerY);
    for (let x = splitX; x <= coneEndX; x += 4) {
      const frac = (x - splitX) / (coneEndX - splitX);
      ctx.lineTo(x, centerY - halfRange * Math.sqrt(frac));
    }
    for (let x = coneEndX; x >= splitX; x -= 4) {
      const frac = (x - splitX) / (coneEndX - splitX);
      ctx.lineTo(x, centerY + halfRange * Math.sqrt(frac));
    }
    ctx.closePath();
    const coneGrad = ctx.createLinearGradient(splitX, 0, coneEndX, 0);
    coneGrad.addColorStop(0, 'rgba(167, 139, 250, 0.06)');
    coneGrad.addColorStop(1, 'rgba(167, 139, 250, 0.02)');
    ctx.fillStyle = coneGrad;
    ctx.fill();
    ctx.restore();

    // --- Center axis ---
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, centerY);
    ctx.lineTo(w - PADDING.right, centerY);
    ctx.stroke();

    // --- Year ticks ---
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '11px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    const step = maxYear - minYear > 200 ? 50 : 25;
    for (let y = Math.ceil(minYear / step) * step; y <= maxYear; y += step) {
      const x = yearToX(y);
      ctx.beginPath();
      ctx.moveTo(x, centerY - 4);
      ctx.lineTo(x, centerY + 4);
      ctx.stroke();
      ctx.fillText(y, x, centerY + 20);
    }

    // --- Split marker ---
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(splitX, PADDING.top - 10);
    ctx.lineTo(splitX, h - PADDING.bottom + 10);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 11px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1958: M&M', splitX, PADDING.top - 18);

    // --- Y-axis labels ---
    ctx.save();
    ctx.translate(16, centerY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '10px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VALUATION METHOD', 0, 0);
    ctx.restore();

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '10px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('\u2191 Discounted Cash Flows', PADDING.left - 10, PADDING.top - 8);
    ctx.fillText('\u2193 Earnings Capitalization', PADDING.left - 10, h - PADDING.bottom + 18);

    ctx.fillStyle = TEXT_MUTED;
    ctx.font = 'bold 11px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('DCF', w - 12, PADDING.top + 12);
    ctx.fillText('EARNINGS CAP', w - 12, h - PADDING.bottom - 4);

    // --- Dots ---
    const items = getFiltered();
    const positions = layoutDots(items);

    // --- Trend lines ---
    const trends = computeTrends(positions);
    function drawTrend(pts, color) {
      if (pts.length < 2) return;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    }
    drawTrend(trends.academic, COLORS.academic);
    drawTrend(trends.practitioner, COLORS.practitioner);

    // --- Draw regular dots (small, translucent) ---
    positions.forEach(pos => {
      if (pos.d.has_note) return;
      const color = COLORS[pos.d.paradigm] || '#888';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // --- Draw research-note dots (larger, brighter, border) ---
    positions.forEach((pos, i) => {
      if (!pos.d.has_note) return;
      const isHov = i === hoveredIdx;
      const isSel = i === selectedIdx;
      const r = isHov || isSel ? DOT_R_HOVER : DOT_R_NOTE;
      const color = COLORS[pos.d.paradigm] || '#fff';

      if (isHov || isSel) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHov || isSel ? 1 : 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isHov || isSel ? TEXT : BORDER;
      ctx.lineWidth = isHov || isSel ? 2 : 1;
      ctx.stroke();
    });

    // --- Hover label ---
    if (hoveredIdx >= 0 && hoveredIdx < positions.length) {
      const pos = positions[hoveredIdx];
      const r = pos.d.has_note ? DOT_R_HOVER : DOT_R + 4;
      ctx.fillStyle = TEXT;
      ctx.font = 'bold 12px "Playfair Display", "Georgia", serif';
      ctx.textAlign = 'center';
      const author = (pos.d.author || '').split(',')[0];
      ctx.fillText(author + ' (' + pos.d.year + ')', pos.x, pos.y - r - 8);
    }

    canvas._positions = positions;
  }

  // Hit testing — note-dots first (larger hit area)
  function getHitIndex(mx, my) {
    const positions = canvas._positions || [];
    for (let i = positions.length - 1; i >= 0; i--) {
      if (!positions[i].d.has_note) continue;
      const dx = mx - positions[i].x;
      const dy = my - positions[i].y;
      if (dx * dx + dy * dy <= (DOT_R_HOVER + 2) * (DOT_R_HOVER + 2)) return i;
    }
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].d.has_note) continue;
      const dx = mx - positions[i].x;
      const dy = my - positions[i].y;
      if (dx * dx + dy * dy <= (DOT_R + 6) * (DOT_R + 6)) return i;
    }
    return -1;
  }

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousemove', function (e) {
    const pos = getMousePos(e);
    const idx = getHitIndex(pos.x, pos.y);
    if (idx !== hoveredIdx) {
      hoveredIdx = idx;
      canvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
      draw();
    }
  });

  canvas.addEventListener('click', function (e) {
    const pos = getMousePos(e);
    const idx = getHitIndex(pos.x, pos.y);
    if (idx >= 0) {
      selectedIdx = idx;
      showPopup(canvas._positions[idx].d, canvas._positions[idx]);
      draw();
    } else {
      hidePopup();
      selectedIdx = -1;
      draw();
    }
  });

  canvas.addEventListener('mouseleave', function () {
    hoveredIdx = -1;
    canvas.style.cursor = 'default';
    draw();
  });

  function showPopup(d, pos) {
    const title = document.getElementById('popup-title');
    const finding = document.getElementById('popup-finding');
    const link = document.getElementById('popup-link');

    title.textContent = (d.author || 'Unknown') + ' (' + d.year + ')';
    title.style.color = COLORS[d.paradigm] || TEXT;

    if (d.key_finding) {
      finding.textContent = d.key_finding;
    } else {
      finding.textContent = d.title || '';
    }
    finding.style.display = '';

    var siteRoot = window.SITE_ROOT || '';
    if (d.has_note && d.slug) {
      link.href = siteRoot + 'evidence/' + d.slug + '.html';
      link.style.display = '';
    } else {
      link.style.display = 'none';
    }

    const canvasRect = canvas.getBoundingClientRect();
    let left = pos.x + 15;
    let top = pos.y - 60;
    if (left + 350 > canvasRect.width) left = pos.x - 365;
    if (top < 0) top = 10;

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.classList.add('visible');
  }

  function hidePopup() {
    popup.classList.remove('visible');
  }

  // Filter buttons
  document.querySelectorAll('.timeline-controls button').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.timeline-controls button').forEach(b =>
        b.classList.remove('active', 'active-gold', 'active-blue'));
      this.classList.add('active');
      if (this.dataset.filter === 'practitioner') this.classList.add('active-gold');
      if (this.dataset.filter === 'academic') this.classList.add('active-blue');
      filter = this.dataset.filter;
      selectedIdx = -1;
      hidePopup();
      draw();
    });
  });

  window.addEventListener('resize', () => { resize(); draw(); });
  resize();
  draw();
})();
