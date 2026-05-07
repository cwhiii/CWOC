/**
 * main-views-indicators.js — Health Indicators trend charts view.
 *
 * Contains:
 *   - displayIndicatorsView (SVG line charts for health data)
 *   - _indicatorsLoad (fetch + render charts)
 *   - _indicatorsSetRange, _indicatorsHighlightBtn, _indicatorsLoadCustomRange
 *   - _indToggleExpand (expand/collapse single chart)
 *   - _enableIndicatorsDragReorder, _restoreIndicatorsOrder
 *   - _indSaveSelection, _indRestoreSelection, _indFmtDate
 *
 * Depends on: main-views.js (shared helpers), shared.js, main.js globals
 */

async function displayIndicatorsView() {
  var chitList = document.getElementById('chit-list');
  if (!chitList) return;

  chitList.innerHTML = '<div style="padding:1em;overflow-y:auto;height:100%;box-sizing:border-box;">' +
    '<div id="indicators-latest"></div>' +
    '<div id="indicators-charts"></div>' +
  '</div>';

  var now = new Date();
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput && !startInput.value) {
    var monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    startInput.value = _indFmtDate(monthAgo);
  }
  if (endInput && !endInput.value) {
    endInput.value = _indFmtDate(now);
  }
  if (!window._indRange) window._indRange = 'month';
  _indicatorsHighlightBtn(window._indRange);
  _indRestoreSelection();
  _indicatorsLoad();
}

// Persist/restore indicator checkbox selection
function _indSaveSelection() {
  var sel = [];
  document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
    if (cb.checked) sel.push(cb.dataset.ind);
  });
  try { localStorage.setItem('cwoc_ind_selection', JSON.stringify(sel)); } catch(e) {}
}
function _indRestoreSelection() {
  try {
    var raw = localStorage.getItem('cwoc_ind_selection');
    if (!raw) return;
    var sel = JSON.parse(raw);
    if (!Array.isArray(sel)) return;
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      cb.checked = sel.indexOf(cb.dataset.ind) !== -1;
    });
  } catch(e) {}
}

function _indFmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _indicatorsSetRange(range) {
  var now = new Date();
  var start = new Date(now);
  if (range === 'day') start.setDate(start.getDate() - 1);
  else if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setMonth(start.getMonth() - 1);
  else if (range === 'year') start.setFullYear(start.getFullYear() - 1);
  else if (range === 'all') start = new Date(2020, 0, 1);

  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  if (startInput) startInput.value = _indFmtDate(start);
  if (endInput) endInput.value = _indFmtDate(now);
  window._indRange = range;
  _indicatorsHighlightBtn(range);
  _indicatorsLoad();
}

function _indicatorsHighlightBtn(range) {
  document.querySelectorAll('._ind-btn').forEach(function(b) {
    var isActive = b.textContent.trim().toLowerCase() === range;
    b.style.background = isActive ? 'ivory' : '';
    b.style.color = isActive ? '#3b1f0a' : '';
  });
}

function _indicatorsLoadCustomRange() {
  window._indRange = 'custom';
  document.querySelectorAll('._ind-btn').forEach(function(b) { b.style.background = ''; });
  _indicatorsLoad();
}

async function _indicatorsLoad() {
  var startInput = document.getElementById('ind-start');
  var endInput = document.getElementById('ind-end');
  var container = document.getElementById('indicators-charts');
  if (!container) return;

  var since = startInput ? startInput.value : '';
  var until = endInput ? endInput.value + 'T23:59:59' : '';
  container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">⏳ Loading…</div>';

  try {
    var url = '/api/health-data';
    var params = [];
    if (since) params.push('since=' + encodeURIComponent(since));
    if (until) params.push('until=' + encodeURIComponent(until));
    if (params.length) url += '?' + params.join('&');

    var resp = await fetch(url);
    if (!resp.ok) throw new Error('API error');
    var data = await resp.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">No health data in this time range.<br>Add health indicators to chits in the editor.</div>';
      return;
    }

    var settings = await getCachedSettings();
    var isMetric = (settings.unit_system === 'metric');

    var charts = [
      { key: 'heart_rate', label: '❤️ Heart Rate', unit: 'bpm', color: '#b22222' },
      { key: 'bp_systolic', label: '🩸 Blood Pressure', unit: 'mmHg', color: '#c44', paired: 'bp_diastolic', pairedLabel: 'Diastolic', pairedColor: '#4682b4' },
      { key: 'spo2', label: '🫁 Oxygen Saturation', unit: '%', color: '#4682b4' },
      { key: 'temperature', label: '🌡️ Temperature', unit: isMetric ? '°C' : '°F', color: '#d4a017' },
      { key: 'weight', label: '⚖️ Weight', unit: isMetric ? 'kg' : 'lbs', color: '#6b8e23' },
      { key: 'height', label: '📐 Height', unit: isMetric ? 'cm' : 'in', color: '#8b5a2b' },
      { key: 'glucose', label: '🍬 Glucose', unit: isMetric ? 'mmol/L' : 'mg/dL', color: '#d2691e' },
      { key: 'distance', label: '🏃 Distance', unit: isMetric ? 'km' : 'mi', color: '#2e8b57' },
    ];

    // Get selected indicators from sidebar checkboxes + persist
    var selectedKeys = [];
    document.querySelectorAll('#ind-select input[data-ind]').forEach(function(cb) {
      if (cb.checked) selectedKeys.push(cb.dataset.ind);
    });
    _indSaveSelection();

    // Build latest values header — cards fill the row evenly
    var latestDiv = document.getElementById('indicators-latest');
    if (latestDiv) {
      latestDiv.innerHTML = '';
      charts.forEach(function(ch) {
        var latest = null;
        if (data && data.length > 0) {
          for (var di = data.length - 1; di >= 0; di--) {
            if (data[di][ch.key] != null) { latest = data[di]; break; }
          }
        }
        var val = latest ? latest[ch.key] : '—';
        var card = document.createElement('div');
        var isClickable = latest && latest.chit_id;
        card.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:5px;padding:6px 10px;text-align:center;' + (isClickable ? 'cursor:pointer;' : '');
        card.title = latest ? (latest.chit_title || '') + ' — ' + (latest.date || '') : '';
        if (isClickable) {
          (function(chitId) {
            card.addEventListener('click', function() {
              storePreviousState();
              window.location.href = '/editor?id=' + chitId;
            });
          })(latest.chit_id);
        }
        var labelText = ch.label.split(' ').slice(1).join(' ');
        card.innerHTML = '<div style="font-size:0.7em;color:#6b4e31;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + labelText + '</div>' +
          '<div style="font-size:1.2em;font-weight:bold;color:' + ch.color + ';">' + (val !== '—' ? (Math.round(val * 10) / 10) : '—') + '</div>' +
          '<div style="font-size:0.65em;color:#8b7355;">' + ch.unit + '</div>';
        latestDiv.appendChild(card);
      });
    }

    container.innerHTML = '';

    charts.forEach(function(chart) {
      if (selectedKeys.indexOf(chart.key) === -1) return;

      var points = [];
      if (data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.key] != null) points.push({ date: d.date, datetime: d.datetime, value: d[chart.key], title: d.chit_title, chitId: d.chit_id });
        });
      }
      var pairedPoints = [];
      if (chart.paired && data && data.length > 0) {
        data.forEach(function(d) {
          if (d[chart.paired] != null) pairedPoints.push({ date: d.date, datetime: d.datetime, value: d[chart.paired] });
        });
      }

      var chartDiv = document.createElement('div');
      chartDiv.style.cssText = 'background:#fff8e1;border:1px solid #8b5a2b;border-radius:6px;padding:8px 10px;';
      chartDiv.dataset.indKey = chart.key;

      // Header with expand button
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
      var title = document.createElement('span');
      title.style.cssText = 'font-weight:bold;font-size:0.9em;color:#2b1e0f;';
      title.textContent = chart.label + ' (' + chart.unit + ')' + (chart.paired ? ' / ' + chart.pairedLabel : '');
      header.appendChild(title);
      var expandBtn = document.createElement('button');
      expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
      expandBtn.title = 'Expand / collapse this chart';
      expandBtn.style.cssText = 'background:none;border:1px solid #8b5a2b;border-radius:3px;cursor:pointer;font-size:0.85em;padding:2px 7px;color:#6b4e31;';
      (function(chartKey) {
        expandBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _indToggleExpand(chartKey);
        });
      })(chart.key);
      header.appendChild(expandBtn);
      chartDiv.appendChild(header);

      if (points.length === 0) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;padding:20px 0;opacity:0.4;font-size:0.85em;';
        empty.textContent = 'No data';
        chartDiv.appendChild(empty);
        container.appendChild(chartDiv);
        return;
      }

      var svgWidth = 500, svgHeight = 180, padL = 45, padR = 10, padT = 8, padB = 22;
      var plotW = svgWidth - padL - padR, plotH = svgHeight - padT - padB;

      var allVals = points.map(function(p) { return p.value; });
      if (pairedPoints.length) pairedPoints.forEach(function(p) { allVals.push(p.value); });
      var minVal = Math.min.apply(null, allVals), maxVal = Math.max.apply(null, allVals);
      var valPad = (maxVal - minVal) * 0.1 || 1;
      minVal -= valPad; maxVal += valPad;
      var valRange = maxVal - minVal;

      var allDates = points.map(function(p) { return new Date(p.datetime || p.date).getTime(); });
      var minDate = Math.min.apply(null, allDates), maxDate = Math.max.apply(null, allDates);
      if (minDate === maxDate) { minDate -= 86400000; maxDate += 86400000; }
      var dateRange = maxDate - minDate;

      function xPos(ts) { return padL + ((ts - minDate) / dateRange) * plotW; }
      function yPos(v) { return padT + plotH - ((v - minVal) / valRange) * plotH; }

      var svg = '<svg viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">';
      for (var gi = 0; gi <= 3; gi++) {
        var gy = padT + (plotH / 3) * gi, gv = maxVal - (valRange / 3) * gi;
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (svgWidth - padR) + '" y2="' + gy + '" stroke="#e0d4b5" stroke-width="0.5"/>';
        svg += '<text x="' + (padL - 3) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#6b4e31">' + (Math.round(gv * 10) / 10) + '</text>';
      }
      var xSteps = Math.min(points.length, 6);
      // Smart date labels: use shorter format when dates are close together
      var _dateSpanDays = (maxDate - minDate) / 86400000;
      for (var xi = 0; xi < xSteps; xi++) {
        var idx = Math.round(xi * (points.length - 1) / Math.max(xSteps - 1, 1));
        var pt = points[idx], tx = xPos(new Date(pt.datetime || pt.date).getTime());
        var _labelDate = new Date(pt.datetime || pt.date);
        var _dateLabel;
        if (_dateSpanDays <= 2) {
          // Very short range: show time
          _dateLabel = String(_labelDate.getHours()).padStart(2, '0') + ':' + String(_labelDate.getMinutes()).padStart(2, '0');
        } else if (_dateSpanDays <= 14) {
          // Short range: day of month only
          _dateLabel = String(_labelDate.getDate());
        } else if (_dateSpanDays <= 90) {
          // Medium range: M/D
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate();
        } else {
          // Long range: M/D/YY
          _dateLabel = (_labelDate.getMonth() + 1) + '/' + _labelDate.getDate() + '/' + String(_labelDate.getFullYear()).slice(2);
        }
        svg += '<text x="' + tx + '" y="' + (svgHeight - 3) + '" text-anchor="middle" font-size="8" fill="#6b4e31">' + _dateLabel + '</text>';
      }
      if (pairedPoints.length > 1) {
        var pp = 'M';
        pairedPoints.forEach(function(p, i) { pp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + pp + '" fill="none" stroke="' + chart.pairedColor + '" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>';
      }
      if (points.length > 1) {
        var lp = 'M';
        points.forEach(function(p, i) { lp += (i ? ' L' : '') + xPos(new Date(p.datetime || p.date).getTime()).toFixed(1) + ' ' + yPos(p.value).toFixed(1); });
        svg += '<path d="' + lp + '" fill="none" stroke="' + chart.color + '" stroke-width="2"/>';
      }
      points.forEach(function(p) {
        var cx = xPos(new Date(p.datetime || p.date).getTime()), cy = yPos(p.value);
        svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.5" fill="' + chart.color + '" stroke="#fff8e1" stroke-width="1" style="cursor:pointer" onclick="storePreviousState();window.location.href=\'/editor?id=' + p.chitId + '\'">' +
          '<title>' + p.date + ': ' + p.value + ' ' + chart.unit + '\n' + p.title + '</title></circle>';
      });
      svg += '</svg>';
      var svgWrap = document.createElement('div');
      svgWrap.className = 'ind-chart-svg-wrap';
      svgWrap.style.cssText = 'width:100%;aspect-ratio:500/180;min-height:120px;';
      svgWrap.innerHTML = svg;
      chartDiv.appendChild(svgWrap);
      container.appendChild(chartDiv);
    });

    if (container.children.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2em;opacity:0.5;">Select indicators in the sidebar.</div>';
    } else {
      // Enable drag-to-reorder on indicator charts (HTML5 desktop + touch mobile)
      _enableIndicatorsDragReorder(container);
      // Restore saved chart order
      _restoreIndicatorsOrder(container);

      // ── Touch gesture for indicator chart reorder (mobile) ─────────────
      if (typeof enableTouchGesture === 'function') {
        var _indDraggedChart = null;
        container.querySelectorAll('[data-ind-key]').forEach(function (chartEl) {
          enableTouchGesture(chartEl, {
            onDragStart: function () {
              _indDraggedChart = chartEl;
              chartEl.classList.add('cwoc-dragging');
            },
            onDragMove: function (data) {
              if (!_indDraggedChart) return;
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Temporarily hide dragged chart from hit testing
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) return;
              var targetChart = target.closest('[data-ind-key]');
              if (targetChart && targetChart !== _indDraggedChart) {
                var rect = targetChart.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (data.clientY < midY) {
                  targetChart.style.borderTop = '3px solid #8b5a2b';
                } else {
                  targetChart.style.borderBottom = '3px solid #8b5a2b';
                }
              }
            },
            onDragEnd: function (data) {
              if (!_indDraggedChart) return;
              _indDraggedChart.classList.remove('cwoc-dragging');
              // Clear all drop indicators
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                c.style.borderTop = '';
                c.style.borderBottom = '';
              });
              // Find drop target
              _indDraggedChart.style.pointerEvents = 'none';
              var target = document.elementFromPoint(data.clientX, data.clientY);
              _indDraggedChart.style.pointerEvents = '';
              if (!target) { _indDraggedChart = null; return; }
              var targetChart = target.closest('[data-ind-key]');
              if (!targetChart || targetChart === _indDraggedChart) { _indDraggedChart = null; return; }

              // Reorder in DOM
              var rect = targetChart.getBoundingClientRect();
              if (data.clientY < rect.top + rect.height / 2) {
                container.insertBefore(_indDraggedChart, targetChart);
              } else {
                container.insertBefore(_indDraggedChart, targetChart.nextSibling);
              }

              // Save new order to localStorage
              var order = [];
              container.querySelectorAll('[data-ind-key]').forEach(function (c) {
                order.push(c.dataset.indKey);
              });
              try { localStorage.setItem('cwoc_ind_chart_order', JSON.stringify(order)); } catch (ex) {}
              if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
              _indDraggedChart = null;
            },
            onLongPress: function () {
              // Long-press: open quick-edit modal for the indicator's chit if applicable
              var indKey = chartEl.dataset.indKey;
              // Find the most recent chit that has this indicator
              var matchChit = null;
              if (typeof chits !== 'undefined' && Array.isArray(chits)) {
                for (var ci = chits.length - 1; ci >= 0; ci--) {
                  var c = chits[ci];
                  if (c.health_indicators && c.health_indicators[indKey] != null) {
                    matchChit = c;
                    break;
                  }
                }
              }
              if (matchChit && typeof showQuickEditModal === 'function') {
                showQuickEditModal(matchChit, function () { displayChits(); });
              }
            },
          });
        });
      }
    }
  } catch (e) {
    console.error('Indicators load error:', e);
    container.innerHTML = '<div style="text-align:center;padding:2em;color:#b22222;">Failed to load health data.</div>';
  }
}

// Expand/collapse a single indicator chart to fill the view
function _indToggleExpand(key) {
  var container = document.getElementById('indicators-charts');
  if (!container) return;
  var expanded = container.dataset.expanded;
  if (expanded === key) {
    // Collapse — show all again
    delete container.dataset.expanded;
    container.style.gridTemplateColumns = '';
    Array.from(container.children).forEach(function(c) {
      c.style.display = '';
      // Reset SVG wrapper to normal size
      var wrap = c.querySelector('.ind-chart-svg-wrap');
      if (wrap) {
        wrap.style.aspectRatio = '500/180';
        wrap.style.minHeight = '120px';
        wrap.style.maxHeight = '';
        wrap.style.height = '';
      }
      // Reset expand button icon
      var btn = c.querySelector('button i.fas');
      if (btn) btn.className = 'fas fa-expand';
    });
  } else {
    // Expand — hide all except this one, make it fill available space
    container.dataset.expanded = key;
    container.style.gridTemplateColumns = '1fr';
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        c.style.display = '';
        // Make SVG wrapper fill available height
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          wrap.style.aspectRatio = 'auto';
          wrap.style.minHeight = '300px';
          // Calculate available height: viewport minus header, latest cards, chart header, padding
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
          wrap.style.height = Math.max(300, availH) + 'px';
        }
        // Update expand button icon to compress
        var btn = c.querySelector('button i.fas');
        if (btn) btn.className = 'fas fa-compress';
      } else {
        c.style.display = 'none';
      }
    });
  }
}

// Resize handler — update expanded chart height on window resize/zoom
var _indResizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_indResizeTimer);
  _indResizeTimer = setTimeout(function() {
    var container = document.getElementById('indicators-charts');
    if (!container || !container.dataset.expanded) return;
    var key = container.dataset.expanded;
    // Recalculate the expanded chart height
    Array.from(container.children).forEach(function(c) {
      if (c.dataset.indKey === key) {
        var wrap = c.querySelector('.ind-chart-svg-wrap');
        if (wrap) {
          var rect = container.getBoundingClientRect();
          var availH = window.innerHeight - rect.top - 40;
          wrap.style.height = Math.max(300, availH) + 'px';
          wrap.style.maxHeight = Math.max(300, availH) + 'px';
        }
      }
    });
  }, 150);
});

// ── Indicators drag-to-reorder ───────────────────────────────────────────────

var _IND_ORDER_KEY = 'cwoc_indicators_chart_order';

function _enableIndicatorsDragReorder(container) {
  var draggedEl = null;

  Array.from(container.children).forEach(function(chartDiv) {
    if (!chartDiv.dataset.indKey) return;
    chartDiv.draggable = true;
    chartDiv.style.cursor = 'grab';

    chartDiv.addEventListener('dragstart', function(e) {
      draggedEl = chartDiv;
      e.dataTransfer.setData('text/plain', chartDiv.dataset.indKey);
      e.dataTransfer.effectAllowed = 'move';
      chartDiv.style.opacity = '0.4';
    });

    chartDiv.addEventListener('dragend', function() {
      chartDiv.style.opacity = '';
      draggedEl = null;
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (typeof _markDragJustEnded === 'function') _markDragJustEnded();
    });

    chartDiv.addEventListener('dragover', function(e) {
      if (!draggedEl || draggedEl === chartDiv) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var rect = chartDiv.getBoundingClientRect();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (e.clientY < rect.top + rect.height / 2) {
        chartDiv.style.borderTop = '3px solid #8b5a2b';
      } else {
        chartDiv.style.borderBottom = '3px solid #8b5a2b';
      }
    });

    chartDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });
      if (!draggedEl || draggedEl === chartDiv) return;

      var rect = chartDiv.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        container.insertBefore(draggedEl, chartDiv);
      } else {
        container.insertBefore(draggedEl, chartDiv.nextSibling);
      }

      // Save order
      var order = [];
      container.querySelectorAll('[data-ind-key]').forEach(function(c) {
        order.push(c.dataset.indKey);
      });
      try { localStorage.setItem(_IND_ORDER_KEY, JSON.stringify(order)); } catch(ex) {}
    });
  });
}

function _restoreIndicatorsOrder(container) {
  try {
    var raw = localStorage.getItem(_IND_ORDER_KEY);
    if (!raw) return;
    var order = JSON.parse(raw);
    if (!Array.isArray(order)) return;

    // Reorder children to match saved order
    order.forEach(function(key) {
      var el = container.querySelector('[data-ind-key="' + key + '"]');
      if (el) container.appendChild(el);
    });
  } catch(ex) {}
}


