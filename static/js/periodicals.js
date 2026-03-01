/**
 * Periodicals: visualize topic trajectories in practitioner vs academic literature.
 */
(function () {
  'use strict';

  var D = window.TRAJECTORIES;
  if (!D) return;

  var topics = D.topics;        // {key: label}
  var prac = D.practitioner;    // {window: {topic: freq, total_docs: n}}
  var acad = D.academic;
  var divergence = D.divergence; // {window: {cosine_distance, ...}}
  var pracLag = D.prac_lag || {};  // {window: {cosine_distance, vs_window}}
  var acadLag = D.acad_lag || {};  // {window: {cosine_distance, vs_window}}
  var perSourceDiv = D.per_source_divergence || {};
  var perSourceResid = D.per_source_residuals || {};
  var sourceFE = D.source_fe || {};
  var windowFE = D.window_fe || {};

  // Two-pole paradigm data (v2)
  var perSourceScores = D.per_source_scores || {};
  var aggPracScores = D.agg_prac_scores || {};
  var aggAcadScores = D.agg_acad_scores || {};
  var poles = D.poles || {};

  // Colors
  var GOLD = '#d4a017';
  var BLUE = '#5ba4cf';
  var BG = '#1c1a22';
  var BORDER = '#363040';
  var TEXT = '#ede8d8';
  var MUTED = '#706a5a';
  var AXIS = '#4a4458';
  var PURPLE = '#a78bfa';
  var FONT = '"JetBrains Mono", "Consolas", monospace';

  // All windows sorted
  var allWindows = Object.keys(Object.assign({}, prac, acad)).sort();
  var windowMids = allWindows.map(function (w) {
    return parseInt(w.split('-')[0]) + 2;
  });

  // Topic keys and labels
  var topicKeys = Object.keys(topics);
  var topicLabels = topicKeys.map(function (k) { return topics[k]; });

  // DPR
  var dpr = window.devicePixelRatio || 1;

  // --- Counts ---
  var totalPrac = 0, totalAcad = 0;
  allWindows.forEach(function (w) {
    if (prac[w]) totalPrac += prac[w].total_docs || 0;
    if (acad[w]) totalAcad += acad[w].total_docs || 0;
  });
  var pe = document.getElementById('prac-count');
  var ae = document.getElementById('acad-count');
  if (pe) pe.textContent = totalPrac.toLocaleString();
  if (ae) ae.textContent = totalAcad.toLocaleString();

  // ═══════════════════════════════════════════════════════════════
  // Helper: set up canvas with DPR
  // ═══════════════════════════════════════════════════════════════
  function setupCanvas(canvas) {
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = rect.width;
    // Store the original CSS height on first call to avoid DPR multiplication bug:
    // canvas.height gets set to h*dpr, and getAttribute('height') reads that back
    var h = parseInt(canvas.dataset.baseHeight || canvas.getAttribute('height')) || 300;
    canvas.dataset.baseHeight = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. DIVERGENCE CHART — three series
  //    Purple: cross-stream (practitioner vs academic, same window)
  //    Gold:   practitioner vs own previous window
  //    Blue:   academic vs own previous window
  // ═══════════════════════════════════════════════════════════════

  function getSeries(obj) {
    var wins = Object.keys(obj).sort();
    return {
      mids: wins.map(function (w) { return parseInt(w.split('-')[0]) + 2; }),
      vals: wins.map(function (w) { return obj[w].cosine_distance; })
    };
  }

  function drawDivergence() {
    var canvas = document.getElementById('divergence-canvas');
    if (!canvas) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    var pad = { top: 30, bottom: 55, left: 60, right: 20 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    var cross = getSeries(divergence || {});
    var pLag  = getSeries(pracLag);
    var aLag  = getSeries(acadLag);

    // If nothing to show, bail
    if (!cross.mids.length && !pLag.mids.length && !aLag.mids.length) return;

    var minYear = Math.min.apply(null, windowMids) - 5;
    var maxYear = Math.max.apply(null, windowMids) + 5;

    function xPos(year) { return pad.left + ((year - minYear) / (maxYear - minYear)) * chartW; }
    function yPos(val) { return pad.top + (1 - val) * chartH; }

    // Grid
    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 1; g += 0.25) {
      var gy = yPos(g);
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText(g.toFixed(2), pad.left - 6, gy + 3);
    }

    // X axis labels
    ctx.textAlign = 'center';
    for (var yr = 1880; yr <= 2020; yr += 20) {
      var xx = xPos(yr);
      if (xx > pad.left && xx < w - pad.right) {
        ctx.fillStyle = MUTED;
        ctx.font = '10px ' + FONT;
        ctx.fillText(yr, xx, h - pad.bottom + 16);
        ctx.beginPath();
        ctx.moveTo(xx, pad.top);
        ctx.lineTo(xx, h - pad.bottom);
        ctx.strokeStyle = AXIS;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    // 1958 marker
    var splitX = xPos(1958);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, pad.top);
    ctx.lineTo(splitX, h - pad.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PURPLE;
    ctx.font = '9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('M&M 1958', splitX, pad.top - 8);

    // Helper: draw a line+dot series
    function drawSeries(mids, vals, color, dotRadius) {
      if (mids.length < 2) return;
      // Line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (var i = 0; i < mids.length; i++) {
        var px = xPos(mids[i]), py = yPos(vals[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // Dots
      for (var i = 0; i < mids.length; i++) {
        ctx.beginPath();
        ctx.arc(xPos(mids[i]), yPos(vals[i]), dotRadius || 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw: practitioner lag (gold), academic lag (blue), cross-stream (purple)
    drawSeries(pLag.mids, pLag.vals, GOLD, 3);
    drawSeries(aLag.mids, aLag.vals, BLUE, 3);
    drawSeries(cross.mids, cross.vals, PURPLE, 4);

    // Y-axis label
    ctx.save();
    ctx.translate(14, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = MUTED;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('COSINE DISTANCE', 0, 0);
    ctx.restore();

    // Legend at bottom
    ctx.font = '9px ' + FONT;
    ctx.textAlign = 'left';
    var lx = pad.left, ly = h - 10;
    // Purple: cross-stream
    ctx.fillStyle = PURPLE;
    ctx.fillRect(lx, ly - 4, 14, 3);
    ctx.fillText('Practitioner vs Academic', lx + 18, ly);
    // Gold: prac lag
    var lx2 = lx + 180;
    ctx.fillStyle = GOLD;
    ctx.fillRect(lx2, ly - 4, 14, 3);
    ctx.fillText('Practitioner vs own lag', lx2 + 18, ly);
    // Blue: acad lag
    var lx3 = lx2 + 170;
    ctx.fillStyle = BLUE;
    ctx.fillRect(lx3, ly - 4, 14, 3);
    ctx.fillText('Academic vs own lag', lx3 + 18, ly);
  }

  // ═══════════════════════════════════════════════════════════════
  // 1b. PARADIGM SPECTRUM — two-pole chart
  //     Y-axis: sim(practitioner pole) - sim(academic pole)
  //     Positive = closer to pre-1920 practitioner paradigm
  //     Negative = closer to post-2000 academic paradigm
  // ═══════════════════════════════════════════════════════════════

  var SOURCE_PALETTE_ACAD = [
    '#5ba4cf', '#7ec8e3', '#4a90d9', '#82b1ff', '#5c6bc0', '#7986cb', '#90caf9'
  ];
  var SOURCE_PALETTE_PRAC = [
    '#d4a017', '#e6b800', '#c49000', '#f0c040', '#b8860b', '#daa520', '#cd853f',
    '#e8a920', '#c8a000', '#d4b030', '#bfa020', '#c09820'
  ];

  var hasTwoPole = Object.keys(perSourceScores).length > 0;
  var sourceData = hasTwoPole ? perSourceScores : perSourceDiv;
  var sourceNames = Object.keys(sourceData).sort();
  var sourceColors = {};
  var aidx = 0, pidx = 0;
  sourceNames.forEach(function (name) {
    if (sourceData[name].stream === 'academic') {
      sourceColors[name] = SOURCE_PALETTE_ACAD[aidx % SOURCE_PALETTE_ACAD.length];
      aidx++;
    } else {
      sourceColors[name] = SOURCE_PALETTE_PRAC[pidx % SOURCE_PALETTE_PRAC.length];
      pidx++;
    }
  });

  var activeSources = {};
  sourceNames.forEach(function (n) { activeSources[n] = true; });

  function buildSourceButtons() {
    var container = document.getElementById('source-selector');
    if (!container) return;
    container.innerHTML = '';

    var acadSources = sourceNames.filter(function (n) { return sourceData[n].stream === 'academic'; });
    var pracSources = sourceNames.filter(function (n) { return sourceData[n].stream === 'practitioner'; });

    function addGroup(label, sources, className) {
      var group = document.createElement('div');
      group.style.marginBottom = '0.3rem';
      var lbl = document.createElement('span');
      lbl.style.fontSize = '0.7rem';
      lbl.style.color = className === 'academic' ? BLUE : GOLD;
      lbl.style.marginRight = '0.5rem';
      lbl.textContent = label + ':';
      group.appendChild(lbl);
      sources.forEach(function (name) {
        var btn = document.createElement('button');
        btn.className = 'topic-btn source-btn' + (activeSources[name] ? ' active' : '');
        btn.style.fontSize = '0.65rem';
        btn.style.padding = '2px 6px';
        btn.style.borderColor = sourceColors[name];
        if (activeSources[name]) btn.style.backgroundColor = sourceColors[name] + '33';
        btn.textContent = name;
        btn.dataset.source = name;
        btn.addEventListener('click', function () {
          activeSources[name] = !activeSources[name];
          btn.classList.toggle('active', activeSources[name]);
          btn.style.backgroundColor = activeSources[name] ? sourceColors[name] + '33' : '';
          drawSourceDivergence();
        });
        group.appendChild(btn);
      });
      container.appendChild(group);
    }

    addGroup('Academic journals', acadSources, 'academic');
    addGroup('Practitioner magazines', pracSources, 'practitioner');
  }

  var dotPositions = [];

  function dotRadius(wordCount) {
    if (!wordCount || wordCount < 100) return 2;
    var r = 1.0 + Math.log10(wordCount) * 0.7;
    return Math.max(2, Math.min(8, r));
  }

  function drawSourceDivergence() {
    var canvas = document.getElementById('source-divergence-canvas');
    if (!canvas) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    dotPositions = [];

    var pad = { top: 30, bottom: 35, left: 60, right: 20 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    var minYear = Math.min.apply(null, windowMids) - 5;
    var maxYear = Math.max.apply(null, windowMids) + 5;

    var yBound = 0.5;

    function xPos(year) { return pad.left + ((year - minYear) / (maxYear - minYear)) * chartW; }
    function yPos(val) { return pad.top + ((yBound - val) / (2 * yBound)) * chartH; }

    // Zero line
    var zeroY = yPos(0);
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(w - pad.right, zeroY);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 0.5;
    [-0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4].forEach(function (g) {
      var gy = yPos(g);
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
    });

    // Y-axis tick labels
    ctx.fillStyle = MUTED;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'right';
    [-0.4, -0.2, 0, 0.2, 0.4].forEach(function (g) {
      ctx.fillText((g >= 0 ? '+' : '') + g.toFixed(1), pad.left - 6, yPos(g) + 3);
    });

    // X axis labels
    ctx.textAlign = 'center';
    for (var yr = 1880; yr <= 2020; yr += 20) {
      var xx = xPos(yr);
      if (xx > pad.left && xx < w - pad.right) {
        ctx.fillStyle = MUTED;
        ctx.font = '10px ' + FONT;
        ctx.fillText(yr, xx, h - pad.bottom + 16);
        ctx.beginPath();
        ctx.moveTo(xx, pad.top);
        ctx.lineTo(xx, h - pad.bottom);
        ctx.strokeStyle = AXIS;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }

    // 1958 marker
    var splitX = xPos(1958);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, pad.top);
    ctx.lineTo(splitX, h - pad.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PURPLE;
    ctx.font = '9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('M&M 1958', splitX, pad.top - 8);

    // Pole labels
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.fillText('\u2191 Practitioner paradigm', w - pad.right, pad.top + 12);
    ctx.fillStyle = BLUE;
    ctx.fillText('\u2193 Academic paradigm', w - pad.right, h - pad.bottom - 6);

    // Y-axis label
    ctx.save();
    ctx.translate(14, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = MUTED;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('PARADIGM SCORE  (sim\u2009prac \u2212 sim\u2009acad)', 0, 0);
    ctx.restore();

    // Draw per-source dots
    sourceNames.forEach(function (name) {
      if (!activeSources[name]) return;
      var info = sourceData[name];
      if (!info || !info.series) return;
      var color = sourceColors[name];
      var wordsMap = info.words || {};
      var simPracMap = info.sim_prac || {};
      var simAcadMap = info.sim_acad || {};
      var wins = Object.keys(info.series).sort();
      var mids = wins.map(function (wi) { return parseInt(wi.split('-')[0]) + 2; });
      var vals = wins.map(function (wi) { return info.series[wi]; });
      if (mids.length === 0) return;

      for (var i = 0; i < mids.length; i++) {
        var wc = wordsMap[wins[i]] || 0;
        var r = dotRadius(wc);
        var px = xPos(mids[i]), py = yPos(Math.max(-yBound, Math.min(yBound, vals[i])));
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        dotPositions.push({
          x: px, y: py, r: r,
          name: name, window: wins[i],
          score: vals[i], words: wc,
          sim_prac: simPracMap[wins[i]] || 0,
          sim_acad: simAcadMap[wins[i]] || 0,
          stream: info.stream, color: color
        });
      }
    });

    // Aggregate lines (thick, on top of dots)
    function drawAggLine(aggData, color, lineWidth) {
      var wins = Object.keys(aggData).sort();
      if (wins.length < 2) return;
      var mids = wins.map(function (wi) { return parseInt(wi.split('-')[0]) + 2; });
      var vals = wins.map(function (wi) { return aggData[wi]; });
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      for (var i = 0; i < mids.length; i++) {
        var px = xPos(mids[i]);
        var py = yPos(Math.max(-yBound, Math.min(yBound, vals[i])));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      for (var i = 0; i < mids.length; i++) {
        var px = xPos(mids[i]);
        var py = yPos(Math.max(-yBound, Math.min(yBound, vals[i])));
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (hasTwoPole) {
      drawAggLine(aggPracScores, GOLD, 3);
      drawAggLine(aggAcadScores, BLUE, 3);
    }
  }

  // ── Hover callouts for paradigm spectrum ──
  (function () {
    var canvas = document.getElementById('source-divergence-canvas');
    var tooltip = document.getElementById('source-tooltip');
    if (!canvas || !tooltip) return;

    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      var best = null, bestDist = 144;
      for (var i = 0; i < dotPositions.length; i++) {
        var d = dotPositions[i];
        var dx = mx - d.x, dy = my - d.y;
        var dist2 = dx * dx + dy * dy;
        if (dist2 < bestDist) {
          bestDist = dist2;
          best = d;
        }
      }

      if (best) {
        var wStr = best.words >= 1000000
          ? (best.words / 1000000).toFixed(1) + 'M'
          : best.words >= 1000
            ? (best.words / 1000).toFixed(0) + 'K'
            : best.words.toString();
        var scoreLabel = best.score >= 0 ? '+' + best.score.toFixed(3) : best.score.toFixed(3);
        tooltip.innerHTML =
          '<strong style="color:' + best.color + ';">' + best.name + '</strong><br>' +
          best.window + ' &middot; ' + wStr + ' words<br>' +
          'Score: ' + scoreLabel +
          ' (prac: ' + best.sim_prac.toFixed(3) + ', acad: ' + best.sim_acad.toFixed(3) + ')';
        tooltip.style.display = 'block';
        var tx = e.clientX - rect.left + 14;
        var ty = e.clientY - rect.top - 10;
        if (tx + tooltip.offsetWidth > rect.width - 10) tx = mx - tooltip.offsetWidth - 14;
        if (ty < 0) ty = my + 20;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
      } else {
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', function () {
      tooltip.style.display = 'none';
    });
  })();

  // ═══════════════════════════════════════════════════════════════
  // 2. TOPIC TRAJECTORIES CHART — single-topic, gold vs blue
  // ═══════════════════════════════════════════════════════════════
  var activeTopic = 'earnings_capitalization';

  function buildTopicButtons() {
    var container = document.getElementById('topic-selector');
    if (!container) return;
    container.innerHTML = '';
    topicKeys.forEach(function (key) {
      var btn = document.createElement('button');
      btn.className = 'topic-btn' + (key === activeTopic ? ' active' : '');
      btn.textContent = topics[key];
      btn.dataset.topic = key;
      btn.addEventListener('click', function () {
        if (key === activeTopic) return;
        activeTopic = key;
        // update button states
        var btns = container.querySelectorAll('.topic-btn');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.toggle('active', btns[i].dataset.topic === key);
        }
        drawTopics();
      });
      container.appendChild(btn);
    });
  }

  function drawTopics() {
    var canvas = document.getElementById('topics-canvas');
    if (!canvas) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    var pad = { top: 30, bottom: 45, left: 60, right: 20 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    var tk = activeTopic;
    if (!tk) return;

    // Title
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(topics[tk], pad.left, 18);

    // Gather data points (with >=5 doc threshold)
    var pracPts = [], acadPts = [];
    allWindows.forEach(function (wi, idx) {
      var mid = windowMids[idx];
      var pd = prac[wi] ? (prac[wi].total_docs || 0) : 0;
      var ad = acad[wi] ? (acad[wi].total_docs || 0) : 0;
      if (pd >= 5) pracPts.push({ mid: mid, val: prac[wi][tk] || 0 });
      if (ad >= 5) acadPts.push({ mid: mid, val: acad[wi][tk] || 0 });
    });

    // Auto-scale y axis
    var maxVal = 0.05;
    pracPts.forEach(function (p) { if (p.val > maxVal) maxVal = p.val; });
    acadPts.forEach(function (p) { if (p.val > maxVal) maxVal = p.val; });
    // Round up to nice value
    if (maxVal <= 0.05) maxVal = 0.05;
    else if (maxVal <= 0.1) maxVal = 0.1;
    else if (maxVal <= 0.2) maxVal = 0.2;
    else if (maxVal <= 0.3) maxVal = 0.3;
    else if (maxVal <= 0.5) maxVal = 0.5;
    else maxVal = 1.0;

    var minYear = Math.min.apply(null, windowMids) - 5;
    var maxYear = Math.max.apply(null, windowMids) + 5;

    function xPos(year) { return pad.left + ((year - minYear) / (maxYear - minYear)) * chartW; }
    function yPos(val) { return pad.top + (1 - val / maxVal) * chartH; }
    var baseY = yPos(0);

    // Grid lines
    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 0.5;
    var gridStep = maxVal >= 0.5 ? 0.1 : maxVal >= 0.2 ? 0.05 : 0.01;
    for (var g = 0; g <= maxVal + 0.001; g += gridStep) {
      var gy = yPos(g);
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(w - pad.right, gy);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText((g * 100).toFixed(0) + '%', pad.left - 6, gy + 3);
    }

    // X axis labels
    ctx.textAlign = 'center';
    for (var yr = 1880; yr <= 2020; yr += 20) {
      var xx = xPos(yr);
      if (xx > pad.left && xx < w - pad.right) {
        ctx.fillStyle = MUTED;
        ctx.font = '10px ' + FONT;
        ctx.fillText(yr, xx, h - pad.bottom + 16);
      }
    }

    // 1958 M&M marker
    var splitX = xPos(1958);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, pad.top);
    ctx.lineTo(splitX, h - pad.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PURPLE;
    ctx.font = '9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('M&M 1958', splitX, h - pad.bottom + 28);

    // --- Practitioner: gold filled area + line ---
    if (pracPts.length > 1) {
      // Area
      ctx.beginPath();
      ctx.moveTo(xPos(pracPts[0].mid), baseY);
      pracPts.forEach(function (p) { ctx.lineTo(xPos(p.mid), yPos(p.val)); });
      ctx.lineTo(xPos(pracPts[pracPts.length - 1].mid), baseY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(212, 160, 23, 0.15)';
      ctx.fill();
      // Line
      ctx.beginPath();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.5;
      pracPts.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(xPos(p.mid), yPos(p.val));
        else ctx.lineTo(xPos(p.mid), yPos(p.val));
      });
      ctx.stroke();
      // Dots
      pracPts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(xPos(p.mid), yPos(p.val), 3, 0, Math.PI * 2);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // --- Academic: blue filled area + line ---
    if (acadPts.length > 1) {
      // Area
      ctx.beginPath();
      ctx.moveTo(xPos(acadPts[0].mid), baseY);
      acadPts.forEach(function (p) { ctx.lineTo(xPos(p.mid), yPos(p.val)); });
      ctx.lineTo(xPos(acadPts[acadPts.length - 1].mid), baseY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(91, 164, 207, 0.15)';
      ctx.fill();
      // Line
      ctx.beginPath();
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2.5;
      acadPts.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(xPos(p.mid), yPos(p.val));
        else ctx.lineTo(xPos(p.mid), yPos(p.val));
      });
      ctx.stroke();
      // Dots
      acadPts.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(xPos(p.mid), yPos(p.val), 3, 0, Math.PI * 2);
        ctx.fillStyle = BLUE;
        ctx.fill();
        ctx.strokeStyle = BG;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Inline legend
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'left';
    var lx = pad.left + 8, ly = pad.top + 14;
    // Gold swatch
    ctx.fillStyle = GOLD;
    ctx.fillRect(lx, ly - 6, 14, 3);
    ctx.fillText('Practitioner', lx + 18, ly);
    // Blue swatch
    ctx.fillStyle = BLUE;
    ctx.fillRect(lx + 110, ly - 6, 14, 3);
    ctx.fillText('Academic', lx + 128, ly);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. HEATMAP
  // ═══════════════════════════════════════════════════════════════
  function drawHeatmap() {
    var canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    var pad = { top: 30, bottom: 30, left: 180, right: 10 };
    var rows = topicKeys.length * 2; // practitioner + academic for each topic
    var cols = allWindows.length;
    var cellW = (w - pad.left - pad.right) / cols;
    var cellH = Math.min(18, (h - pad.top - pad.bottom) / rows);
    var totalH = cellH * rows;

    // Adjust canvas height if needed
    var needH = totalH + pad.top + pad.bottom + 20;
    if (needH > h) {
      h = needH;
      canvas.dataset.baseHeight = h;
      canvas.style.height = h + 'px';
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw cells
    topicKeys.forEach(function (tk, ti) {
      var pracY = pad.top + ti * 2 * cellH;
      var acadY = pad.top + (ti * 2 + 1) * cellH;

      // Row label
      ctx.fillStyle = MUTED;
      ctx.font = '9px ' + FONT;
      ctx.textAlign = 'right';
      var label = topics[tk];
      if (label.length > 24) label = label.substring(0, 23) + '..';
      ctx.fillText(label, pad.left - 6, pracY + cellH - 2);

      // Stream indicators
      ctx.fillStyle = GOLD;
      ctx.fillRect(pad.left - 4, pracY + 2, 2, cellH - 4);
      ctx.fillStyle = BLUE;
      ctx.fillRect(pad.left - 4, acadY + 2, 2, cellH - 4);

      allWindows.forEach(function (wi, ci) {
        var x = pad.left + ci * cellW;

        // Practitioner cell
        var pv = prac[wi] ? (prac[wi][tk] || 0) : 0;
        var pd = prac[wi] ? (prac[wi].total_docs || 0) : 0;
        if (pd >= 5) {
          var alpha = Math.min(pv * 3, 1);
          ctx.fillStyle = 'rgba(212, 160, 23, ' + alpha.toFixed(3) + ')';
          ctx.fillRect(x + 0.5, pracY + 0.5, cellW - 1, cellH - 1);
        } else {
          ctx.fillStyle = 'rgba(50, 45, 55, 0.3)';
          ctx.fillRect(x + 0.5, pracY + 0.5, cellW - 1, cellH - 1);
        }

        // Academic cell
        var av = acad[wi] ? (acad[wi][tk] || 0) : 0;
        var ad = acad[wi] ? (acad[wi].total_docs || 0) : 0;
        if (ad >= 5) {
          var alpha = Math.min(av * 3, 1);
          ctx.fillStyle = 'rgba(91, 164, 207, ' + alpha.toFixed(3) + ')';
          ctx.fillRect(x + 0.5, acadY + 0.5, cellW - 1, cellH - 1);
        } else {
          ctx.fillStyle = 'rgba(50, 45, 55, 0.3)';
          ctx.fillRect(x + 0.5, acadY + 0.5, cellW - 1, cellH - 1);
        }
      });
    });

    // Column labels (years)
    ctx.fillStyle = MUTED;
    ctx.font = '8px ' + FONT;
    ctx.textAlign = 'center';
    allWindows.forEach(function (wi, ci) {
      var x = pad.left + ci * cellW + cellW / 2;
      var label = wi.split('-')[0].substring(2); // "65" from "1865"
      if (ci % 3 === 0) {
        ctx.save();
        ctx.translate(x, pad.top + totalH + 4);
        ctx.rotate(Math.PI / 4);
        ctx.fillText("'" + label, 0, 0);
        ctx.restore();
      }
    });

    // 1958 marker
    var splitIdx = -1;
    for (var i = 0; i < allWindows.length; i++) {
      var start = parseInt(allWindows[i].split('-')[0]);
      if (start <= 1958 && start + 4 >= 1958) { splitIdx = i; break; }
    }
    if (splitIdx >= 0) {
      var sx = pad.left + splitIdx * cellW + cellW / 2;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = PURPLE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, pad.top - 5);
      ctx.lineTo(sx, pad.top + totalH + 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════
  buildTopicButtons();
  buildSourceButtons();
  drawDivergence();
  drawSourceDivergence();
  drawTopics();
  drawHeatmap();

  window.addEventListener('resize', function () {
    drawDivergence();
    drawSourceDivergence();
    drawTopics();
    drawHeatmap();
  });
})();
