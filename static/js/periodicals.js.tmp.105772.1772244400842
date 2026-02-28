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
  // 1. DIVERGENCE CHART
  // ═══════════════════════════════════════════════════════════════
  function drawDivergence() {
    var canvas = document.getElementById('divergence-canvas');
    if (!canvas || !divergence) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    var pad = { top: 30, bottom: 45, left: 60, right: 20 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Get divergence data
    var divWindows = Object.keys(divergence).sort();
    if (!divWindows.length) return;

    var divMids = divWindows.map(function (dw) { return parseInt(dw.split('-')[0]) + 2; });
    var divVals = divWindows.map(function (dw) { return divergence[dw].cosine_distance; });

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
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(splitX, pad.top);
    ctx.lineTo(splitX, h - pad.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PURPLE;
    ctx.font = 'bold 10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('1958: M&M', splitX, pad.top - 8);

    // Area fill
    if (divMids.length > 1) {
      ctx.beginPath();
      ctx.moveTo(xPos(divMids[0]), yPos(0));
      for (var i = 0; i < divMids.length; i++) {
        ctx.lineTo(xPos(divMids[i]), yPos(divVals[i]));
      }
      ctx.lineTo(xPos(divMids[divMids.length - 1]), yPos(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 2.5;
    for (var i = 0; i < divMids.length; i++) {
      var px = xPos(divMids[i]);
      var py = yPos(divVals[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Dots
    for (var i = 0; i < divMids.length; i++) {
      ctx.beginPath();
      ctx.arc(xPos(divMids[i]), yPos(divVals[i]), 4, 0, Math.PI * 2);
      ctx.fillStyle = PURPLE;
      ctx.fill();
      ctx.strokeStyle = BG;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Y-axis label
    ctx.save();
    ctx.translate(14, pad.top + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = MUTED;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('COSINE DISTANCE', 0, 0);
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. TOPIC TRAJECTORIES CHART
  // ═══════════════════════════════════════════════════════════════
  var selectedTopics = ['earnings_capitalization', 'dcf_npv', 'speculation_trading', 'portfolio_theory'];

  function buildTopicButtons() {
    var container = document.getElementById('topic-selector');
    if (!container) return;
    container.innerHTML = '';
    topicKeys.forEach(function (key) {
      var btn = document.createElement('button');
      btn.className = 'topic-btn' + (selectedTopics.indexOf(key) >= 0 ? ' active' : '');
      btn.textContent = topics[key];
      btn.dataset.topic = key;
      btn.addEventListener('click', function () {
        var idx = selectedTopics.indexOf(key);
        if (idx >= 0) selectedTopics.splice(idx, 1);
        else selectedTopics.push(key);
        this.classList.toggle('active');
        drawTopics();
      });
      container.appendChild(btn);
    });
  }

  // Distinct colors for topics
  var TOPIC_COLORS = [
    '#e8c547', '#5ba4cf', '#e06c75', '#98c379',
    '#c678dd', '#56b6c2', '#d19a66', '#61afef',
    '#be5046', '#7ec699', '#e5c07b', '#abb2bf',
    '#ff6b6b', '#4ecdc4', '#ffe66d'
  ];

  function drawTopics() {
    var canvas = document.getElementById('topics-canvas');
    if (!canvas) return;
    var s = setupCanvas(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;

    var pad = { top: 20, bottom: 45, left: 60, right: 160 };
    var chartW = w - pad.left - pad.right;
    var chartH = h - pad.top - pad.bottom;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    if (!selectedTopics.length) {
      ctx.fillStyle = MUTED;
      ctx.font = '14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Select topics above', w / 2, h / 2);
      return;
    }

    // Find max value across selected topics
    var maxVal = 0.05;
    allWindows.forEach(function (wi) {
      selectedTopics.forEach(function (tk) {
        var pv = prac[wi] ? (prac[wi][tk] || 0) : 0;
        var av = acad[wi] ? (acad[wi][tk] || 0) : 0;
        if (pv > maxVal) maxVal = pv;
        if (av > maxVal) maxVal = av;
      });
    });
    maxVal = Math.ceil(maxVal * 10) / 10;
    if (maxVal < 0.05) maxVal = 0.05;

    var minYear = Math.min.apply(null, windowMids) - 5;
    var maxYear = Math.max.apply(null, windowMids) + 5;

    function xPos(year) { return pad.left + ((year - minYear) / (maxYear - minYear)) * chartW; }
    function yPos(val) { return pad.top + (1 - val / maxVal) * chartH; }

    // Grid
    ctx.strokeStyle = AXIS;
    ctx.lineWidth = 0.5;
    var gridStep = maxVal > 0.3 ? 0.1 : maxVal > 0.1 ? 0.05 : 0.01;
    for (var g = 0; g <= maxVal; g += gridStep) {
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

    // X axis
    ctx.textAlign = 'center';
    for (var yr = 1880; yr <= 2020; yr += 20) {
      var xx = xPos(yr);
      if (xx > pad.left && xx < w - pad.right) {
        ctx.fillStyle = MUTED;
        ctx.font = '10px ' + FONT;
        ctx.fillText(yr, xx, h - pad.bottom + 16);
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

    // Draw each selected topic: two lines (prac=solid, acad=dashed)
    selectedTopics.forEach(function (tk, ti) {
      var color = TOPIC_COLORS[topicKeys.indexOf(tk) % TOPIC_COLORS.length];

      // Practitioner line (solid)
      var pracPts = [];
      allWindows.forEach(function (wi, idx) {
        var val = prac[wi] ? (prac[wi][tk] || 0) : 0;
        var docs = prac[wi] ? (prac[wi].total_docs || 0) : 0;
        if (docs >= 5) pracPts.push({ x: xPos(windowMids[idx]), y: yPos(val) });
      });
      if (pracPts.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        pracPts.forEach(function (pt, i) {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Academic line (dashed)
      var acadPts = [];
      allWindows.forEach(function (wi, idx) {
        var val = acad[wi] ? (acad[wi][tk] || 0) : 0;
        var docs = acad[wi] ? (acad[wi].total_docs || 0) : 0;
        if (docs >= 5) acadPts.push({ x: xPos(windowMids[idx]), y: yPos(val) });
      });
      if (acadPts.length > 1) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.9;
        acadPts.forEach(function (pt, i) {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    });

    // Legend (right side)
    var legendX = w - pad.right + 12;
    var legendY = pad.top + 10;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'left';
    selectedTopics.forEach(function (tk, ti) {
      var color = TOPIC_COLORS[topicKeys.indexOf(tk) % TOPIC_COLORS.length];
      var yy = legendY + ti * 20;

      // Solid line sample
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX, yy);
      ctx.lineTo(legendX + 18, yy);
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      var label = topics[tk];
      if (label.length > 16) label = label.substring(0, 15) + '...';
      ctx.fillText(label, legendX + 22, yy + 3);
    });

    // Footer legend: solid=practitioner, dashed=academic
    ctx.font = '9px ' + FONT;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    // Solid
    ctx.strokeStyle = MUTED;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, h - 8);
    ctx.lineTo(pad.left + 18, h - 8);
    ctx.stroke();
    ctx.fillText('= Practitioner', pad.left + 22, h - 5);
    // Dashed
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left + 120, h - 8);
    ctx.lineTo(pad.left + 138, h - 8);
    ctx.stroke();
    ctx.restore();
    ctx.fillText('= Academic', pad.left + 142, h - 5);
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
  drawDivergence();
  drawTopics();
  drawHeatmap();

  window.addEventListener('resize', function () {
    drawDivergence();
    drawTopics();
    drawHeatmap();
  });
})();
