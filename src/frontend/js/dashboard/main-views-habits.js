/**
 * main-views-habits.js — Habits view (sub-mode of Tasks tab).
 *
 * Contains:
 *   - displayHabitsView (habit cards with progress, streaks, success rate)
 *   - _renderHabitCards (card rendering with On Deck / Out of Mind / Accomplished sections)
 *   - _persistHabitUpdate (debounced save)
 *   - _optimisticHabitCardUpdate (instant UI feedback)
 *   - _isResetPeriodActive, _getResetEndDate, _habitUrgencyScore, _getTodayISO
 *   - _onHabitsWindowChange, _initHabitsWindowDropdown
 *
 * Depends on: main-views.js (shared helpers), shared-habits.js, main.js globals
 */

/* ── Habits View ─────────────────────────────────────────────────────────── */

/**
 * Check if a habit's reset period is currently active (user acted within the period).
 * @param {object} chit - The chit object
 * @returns {boolean} true if the reset period is active and the user should wait
 */
function _isResetPeriodActive(chit) {
  if (!chit.habit_reset_period || !chit.habit_last_action_date) return false;
  var lastAction = new Date(chit.habit_last_action_date + 'T00:00:00');
  if (isNaN(lastAction.getTime())) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse "N:UNIT" format (e.g., "3:DAILY") or legacy "DAILY"
  var resetStr = chit.habit_reset_period;
  var resetNum = 1;
  var resetUnit = resetStr;
  if (resetStr.indexOf(':') !== -1) {
    var parts = resetStr.split(':');
    resetNum = parseInt(parts[0]) || 1;
    resetUnit = parts[1];
  }

  // Calculate the reset end date: lastAction + N units
  var resetEnd = new Date(lastAction);
  if (resetUnit === 'DAILY') {
    resetEnd.setDate(resetEnd.getDate() + resetNum);
  } else if (resetUnit === 'WEEKLY') {
    resetEnd.setDate(resetEnd.getDate() + resetNum * 7);
  } else if (resetUnit === 'MONTHLY') {
    resetEnd.setMonth(resetEnd.getMonth() + resetNum);
  } else {
    return false;
  }

  // Reset is active if today is before the reset end date
  return today < resetEnd;
}

/**
 * Get the date when the reset period expires as a formatted string.
 * Returns null if no reset period or no last action date.
 */
function _getResetEndDate(chit) {
  if (!chit.habit_reset_period || !chit.habit_last_action_date) return null;
  var lastAction = new Date(chit.habit_last_action_date + 'T00:00:00');
  if (isNaN(lastAction.getTime())) return null;

  var resetStr = chit.habit_reset_period;
  var resetNum = 1;
  var resetUnit = resetStr;
  if (resetStr.indexOf(':') !== -1) {
    var parts = resetStr.split(':');
    resetNum = parseInt(parts[0]) || 1;
    resetUnit = parts[1];
  }

  var resetEnd = new Date(lastAction);
  if (resetUnit === 'DAILY') resetEnd.setDate(resetEnd.getDate() + resetNum);
  else if (resetUnit === 'WEEKLY') resetEnd.setDate(resetEnd.getDate() + resetNum * 7);
  else if (resetUnit === 'MONTHLY') resetEnd.setMonth(resetEnd.getMonth() + resetNum);
  else return null;

  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[resetEnd.getMonth()] + ' ' + resetEnd.getDate();
}

/**
 * Calculate urgency score for a habit — lower = more urgent (needs action sooner).
 * Returns the number of days until the next action is needed.
 *
 * Logic:
 * - If the habit has remaining completions and a reset period:
 *   days until cycle ends / remaining completions (spread evenly)
 * - If no reset period: days until cycle ends / remaining completions
 * - Daily habits with work to do: 0 (most urgent)
 *
 * @param {object} h — habit data object with chit, goal, success
 * @returns {number} days until next action needed (lower = more urgent)
 */
function _habitUrgencyScore(h) {
  var chit = h.chit;
  var remaining = h.goal - h.success;
  if (remaining <= 0) return 9999; // complete — least urgent

  var rule = chit.recurrence_rule;
  var freq = (rule && rule.freq) ? rule.freq : 'DAILY';

  // Calculate days left in the current cycle
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var currentPeriod = (typeof getCurrentPeriodDate === 'function') ? getCurrentPeriodDate(chit) : null;
  var daysInCycle = 1;
  if (freq === 'DAILY') daysInCycle = 1;
  else if (freq === 'WEEKLY') daysInCycle = 7;
  else if (freq === 'MONTHLY') daysInCycle = 30;
  else if (freq === 'YEARLY') daysInCycle = 365;

  var daysLeft = daysInCycle;
  if (currentPeriod) {
    var periodStart = new Date(currentPeriod + 'T00:00:00');
    var elapsed = Math.floor((today - periodStart) / 86400000);
    daysLeft = Math.max(1, daysInCycle - elapsed);
  }

  // Days per remaining completion — how often you need to act
  var daysPerAction = daysLeft / remaining;

  return daysPerAction;
}

/**
 * Get today's date as an ISO string (YYYY-MM-DD).
 */
function _getTodayISO() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/**
 * Render the Habits view — one card per chit with habit=true.
 * Cards show progress (X/Y), frequency, streak 🔥, success rate %, status badge.
 * Goal=1 habits get a checkbox; goal>1 habits get +/− counter buttons.
 */
function displayHabitsView(chitsToDisplay) {
  var chitList = document.getElementById('chit-list');
  chitList.innerHTML = '';

  // 6.1 — Filter by explicit habit flag, not recurrence_rule presence
  var habitChits = chitsToDisplay.filter(function(chit) {
    return chit.habit === true;
  });

  if (habitChits.length === 0) {
    chitList.innerHTML = '<div class="cwoc-empty" style="text-align:center;padding:2em 1em;opacity:0.7;">' +
      '<p style="font-size:1.1em;margin-bottom:0.8em;">No habits yet. Mark a recurring chit as a habit in the editor to start tracking.</p>' +
      '</div>';
    return;
  }

  // Read success window setting
  var settings = window._cwocSettings || {};
  var windowDays = settings.habits_success_window || '30';

  // Build habit data: evaluate rollover, compute metrics
  var habitData = habitChits.map(function(chit) {
    // Lazy rollover before rendering
    var rolledOver = _evaluateHabitRollover(chit);
    if (rolledOver) {
      _persistHabitRollover(chit);
    }
    var goal = chit.habit_goal || 1;
    var success = chit.habit_success || 0;
    var isCompleted = success >= goal;

    // Calculate success rate from habit rollover snapshots + current period.
    var exceptions = chit.recurrence_exceptions || [];
    var periodEntries = [];
    for (var ei = 0; ei < exceptions.length; ei++) {
      var ex = exceptions[ei];
      if (!ex.date || ex.broken_off) continue;
      // Only count entries with habit-specific fields (from period rollover snapshots)
      if (ex.habit_success !== undefined && ex.habit_goal !== undefined) {
        periodEntries.push(ex);
      }
    }
    // Add current period only if goal is met (in-progress periods don't count against you)
    if (isCompleted) {
      periodEntries.push({ habit_success: success, habit_goal: goal, _current: true });
    }

    // Apply window filter (window is number of entries, not days, for this simple calc)
    var windowCount = (windowDays === 'all') ? periodEntries.length : parseInt(windowDays, 10) || 30;
    var windowEntries = periodEntries.slice(-windowCount);

    var metCount = 0;
    for (var wi = 0; wi < windowEntries.length; wi++) {
      if (windowEntries[wi].habit_success >= windowEntries[wi].habit_goal) metCount++;
    }
    var successRate = windowEntries.length > 0 ? Math.round((metCount / windowEntries.length) * 100) : 0;

    // Streak: count consecutive met periods walking backward from past snapshots
    var streak = 0;
    // Walk backward through past snapshots only (not current in-progress)
    for (var si = periodEntries.length - 1; si >= 0; si--) {
      if (periodEntries[si].habit_success >= periodEntries[si].habit_goal) {
        streak++;
      } else {
        break;
      }
    }

    // Detailed logging for debugging
    var exDetails = [];
    for (var di = 0; di < periodEntries.length; di++) {
      var pe = periodEntries[di];
      exDetails.push((pe._current ? '*' : '') + (pe.date || 'now') + ':' + pe.habit_success + '/' + pe.habit_goal);
    }
    console.log('[Habit] ' + (chit.title || chit.id) +
      ': current=' + success + '/' + goal + (isCompleted ? ' ✓' : '') +
      ', periods=[' + exDetails.join(', ') + ']' +
      ', rate=' + metCount + '/' + windowEntries.length + '=' + successRate + '%' +
      ', streak=' + streak);

    return {
      chit: chit,
      goal: goal,
      success: success,
      isCompleted: isCompleted,
      successRate: successRate,
      metCount: metCount,
      totalPeriods: windowEntries.length,
      streak: streak
    };
  });

  var habitsContainer = document.createElement('div');
  habitsContainer.className = 'checklist-view';

  // 6.8 — Sort: incomplete first, completed last
  _renderHabitCards(habitsContainer, habitData, windowDays);

  chitList.appendChild(habitsContainer);
}

/**
 * Render habit cards into the container. Sorts incomplete first, completed last.
 */
function _renderHabitCards(container, habitData, windowDays) {
  container.innerHTML = '';

  // Split into 3 groups: On Deck, Out of Mind, Accomplished
  var onDeck = [];
  var outOfMind = [];
  var completed = [];

  habitData.forEach(function(h) {
    if (h.isCompleted) {
      completed.push(h);
    } else if (h.chit.habit_reset_period && _isResetPeriodActive(h.chit) && h.success > 0 && h.success < h.goal) {
      outOfMind.push(h);
    } else {
      onDeck.push(h);
    }
  });

  // Sort on-deck: most time-urgent first.
  // "When do I need to do this next?" — soonest deadline at the top.
  // For habits with a reset: next action = when reset expires
  // For habits without reset: next action = time left in cycle / remaining completions
  onDeck.sort(function(a, b) {
    return _habitUrgencyScore(a) - _habitUrgencyScore(b);
  });

  var sorted = onDeck.concat(outOfMind).concat(completed);

  if (sorted.length === 0) {
    var emptyMsg = document.createElement('div');
    emptyMsg.className = 'cwoc-empty';
    emptyMsg.style.cssText = 'text-align:center;padding:2em 1em;opacity:0.7;';
    emptyMsg.innerHTML = '<p>All habits completed! ✨</p>';
    container.appendChild(emptyMsg);
    return;
  }

  // Section header: On Deck
  if (onDeck.length > 0) {
    var onDeckHeader = document.createElement('div');
    onDeckHeader.className = 'habit-section-header';
    onDeckHeader.innerHTML = '<span class="habit-section-icon">🔜</span> On Deck';
    container.appendChild(onDeckHeader);
  }

  var outOfMindHeaderAdded = false;
  var completedHeaderAdded = false;

  sorted.forEach(function(h) {
    // Insert "Out of Mind" header before the first out-of-mind habit
    if (!outOfMindHeaderAdded && outOfMind.indexOf(h) !== -1) {
      outOfMindHeaderAdded = true;
      var restingHeader = document.createElement('div');
      restingHeader.className = 'habit-section-header habit-section-resting';
      restingHeader.innerHTML = '😌 Out of Mind';
      container.appendChild(restingHeader);
    }

    // Insert "Accomplished" header before the first completed habit
    if (h.isCompleted && !completedHeaderAdded) {
      completedHeaderAdded = true;
      var doneHeader = document.createElement('div');
      doneHeader.className = 'habit-section-header habit-section-done';
      doneHeader.innerHTML = '✅ Accomplished';
      container.appendChild(doneHeader);
    }

    var chit = h.chit;
    var isResting = outOfMind.indexOf(h) !== -1;
    var card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.chitId = chit.id;
    if (h.isCompleted) card.classList.add('habit-done');
    if (isResting) card.classList.add('habit-resting');
    if (typeof applyChitColors === 'function') {
      applyChitColors(card, typeof chitColor === 'function' ? chitColor(chit) : '#fdf6e3');
    }

    // ── Header row: interaction control + title + frequency ──
    var header = document.createElement('div');
    header.className = 'habit-header';

    if (h.goal === 1) {
      // 6.4 — Checkbox interaction for goal=1 habits
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = h.isCompleted;
      // Disable if reset period is active
      var _resetActive = (h.success > 0) && _isResetPeriodActive(chit);
      if (_resetActive && !h.isCompleted) {
        checkbox.disabled = true;
        checkbox.title = 'Reset period active — wait for cooldown';
        checkbox.style.opacity = '0.4';
      } else {
        checkbox.title = h.isCompleted ? 'Mark as not done' : 'Mark as done for this period';
      }
      checkbox.addEventListener('change', function(e) {
        e.stopPropagation();
        var newSuccess = checkbox.checked ? 1 : 0;
        // 6.7 — Cap at goal
        if (newSuccess > h.goal) newSuccess = h.goal;
        // Update local chit object for accumulation
        chit.habit_success = newSuccess;
        if (newSuccess >= h.goal) {
          chit.status = 'Complete';
        } else if (chit.status === 'Complete') {
          chit.status = '';
        }
        // Set last action date when incrementing
        if (newSuccess > 0) {
          chit.habit_last_action_date = _getTodayISO();
        }
        // Optimistic UI update
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      header.appendChild(checkbox);
    }

    // Title as clickable link
    var titleLink = document.createElement('a');
    titleLink.href = '/editor?id=' + chit.id;
    titleLink.textContent = chit.title || '(Untitled)';
    titleLink.addEventListener('click', function(e) {
      e.preventDefault();
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    header.appendChild(titleLink);

    // Period label (e.g., "Week of Apr 28" or "May 2026")
    var periodLabel = (typeof _formatCurrentPeriodLabel === 'function') ? _formatCurrentPeriodLabel(chit) : '';
    if (periodLabel) {
      var sep = document.createElement('span');
      sep.className = 'habit-separator';
      sep.textContent = ' · ';
      header.appendChild(sep);
      var periodSpan = document.createElement('span');
      periodSpan.className = 'habit-frequency';
      periodSpan.textContent = periodLabel;
      header.appendChild(periodSpan);
    }

    // Status badge — show inline with title for habits
    if (h.isCompleted) {
      // Compute next cycle start date
      var _nextPeriod = '';
      var _rule = chit.recurrence_rule;
      if (_rule && _rule.freq && typeof getCurrentPeriodDate === 'function') {
        var _curPeriod = getCurrentPeriodDate(chit);
        if (_curPeriod && typeof _getPreviousPeriodDate === 'function') {
          // _getPreviousPeriodDate goes backward; we need forward — reverse the logic
          var _freq = _rule.freq;
          var _interval = _rule.interval || 1;
          var _cp = new Date(_curPeriod + 'T00:00:00');
          if (_freq === 'DAILY') _cp.setDate(_cp.getDate() + _interval);
          else if (_freq === 'WEEKLY') _cp.setDate(_cp.getDate() + _interval * 7);
          else if (_freq === 'MONTHLY') _cp.setMonth(_cp.getMonth() + _interval);
          else if (_freq === 'YEARLY') _cp.setFullYear(_cp.getFullYear() + _interval);
          var _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          _nextPeriod = _months[_cp.getMonth()] + ' ' + _cp.getDate();
        }
      }
      var completeLine = document.createElement('span');
      completeLine.className = 'habit-complete-line';
      completeLine.textContent = '✅ Complete for this cycle.' + (_nextPeriod ? ' (Next cycle starts ' + _nextPeriod + '.)' : '');
      header.appendChild(completeLine);
    }

    // Resting label for Out of Mind habits (reset period active, not yet complete)
    if (isResting) {
      var resetEndDate = _getResetEndDate(chit);
      var restingLine = document.createElement('span');
      restingLine.className = 'habit-resting-line';
      restingLine.textContent = '☐ Too soon to complete again. Resets on ' + (resetEndDate || '—') + '.';
      header.appendChild(restingLine);
    }

    card.appendChild(header);

    // ── Metrics row: labeled boxes for each metric ──
    var metrics = document.createElement('div');
    metrics.className = 'habit-metrics';

    // Progress box: "X / Y" with counter buttons
    var progressBox = document.createElement('div');
    progressBox.className = 'habit-metric-box';
    var progressLabel = document.createElement('span');
    progressLabel.className = 'habit-metric-label';
    progressLabel.textContent = '📊 Progress';
    progressBox.appendChild(progressLabel);
    var progressRow = document.createElement('div');
    progressRow.className = 'habit-metric-value';
    var progressSpan = document.createElement('span');
    progressSpan.className = 'habit-progress';
    var _freqLabel = '';
    var _rule = chit.recurrence_rule;
    if (_rule && _rule.freq) {
      if (_rule.freq === 'DAILY') _freqLabel = ' each Day';
      else if (_rule.freq === 'WEEKLY') _freqLabel = ' each Week';
      else if (_rule.freq === 'MONTHLY') _freqLabel = ' each Month';
      else if (_rule.freq === 'YEARLY') _freqLabel = ' each Year';
    }
    progressSpan.textContent = h.success + ' / ' + h.goal + _freqLabel;
    progressSpan.title = 'Progress: ' + h.success + ' of ' + h.goal + ' this period';

    // Counter buttons: [−] progress [+]
    if (h.goal > 1) {
      var _resetActiveCounter = (h.success > 0) && _isResetPeriodActive(chit);

      var minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'habit-counter-btn';
      minusBtn.textContent = '−';
      minusBtn.title = 'Decrement';
      minusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var curSuccess = chit.habit_success || 0;
        if (curSuccess <= 0) return;
        var newSuccess = curSuccess - 1;
        chit.habit_success = newSuccess;
        if (newSuccess < (chit.habit_goal || 1) && chit.status === 'Complete') {
          chit.status = '';
        }
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      progressRow.appendChild(minusBtn);
      progressRow.appendChild(progressSpan);

      var plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'habit-counter-btn';
      plusBtn.textContent = '+';
      plusBtn.title = _resetActiveCounter ? 'Reset period active — wait for cooldown' : 'Increment';
      if (_resetActiveCounter) {
        plusBtn.disabled = true;
        plusBtn.style.opacity = '0.4';
        plusBtn.style.cursor = 'not-allowed';
      }
      plusBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        if ((chit.habit_success || 0) > 0 && _isResetPeriodActive(chit)) return;
        var curSuccess = chit.habit_success || 0;
        var goal = chit.habit_goal || 1;
        if (curSuccess >= goal) return;
        var newSuccess = curSuccess + 1;
        chit.habit_success = newSuccess;
        if (newSuccess >= goal) {
          chit.status = 'Complete';
        }
        chit.habit_last_action_date = _getTodayISO();
        _optimisticHabitCardUpdate(card, chit, newSuccess, h.goal);
        _persistHabitUpdate(JSON.parse(JSON.stringify(chit)));
      });
      progressRow.appendChild(plusBtn);
    } else {
      progressRow.appendChild(progressSpan);
    }
    progressBox.appendChild(progressRow);
    metrics.appendChild(progressBox);

    // Cycle progress box
    var cyclePct = Math.round((h.success / h.goal) * 100);
    var cycleBox = document.createElement('div');
    cycleBox.className = 'habit-metric-box';
    var cycleLabel = document.createElement('span');
    cycleLabel.className = 'habit-metric-label';
    cycleLabel.textContent = '🎯 Cycle';
    cycleBox.appendChild(cycleLabel);
    var cycleVal = document.createElement('div');
    cycleVal.className = 'habit-metric-value';
    var cycleSpan = document.createElement('span');
    cycleSpan.className = 'habit-cycle-badge';
    cycleSpan.textContent = cyclePct + '%';
    cycleSpan.title = 'This period, ' + h.success + ' of ' + h.goal + ' tasks completed';
    cycleVal.appendChild(cycleSpan);
    cycleBox.appendChild(cycleVal);
    metrics.appendChild(cycleBox);

    // Overall success rate box (hidden if habit_hide_overall is set)
    if (!chit.habit_hide_overall) {
      var overallBox = document.createElement('div');
      overallBox.className = 'habit-metric-box';
      var overallLabel = document.createElement('span');
      overallLabel.className = 'habit-metric-label';
      overallLabel.textContent = '📈 Overall';
      overallBox.appendChild(overallLabel);
      var overallVal = document.createElement('div');
      overallVal.className = 'habit-metric-value';
      var overallSpan = document.createElement('span');
      overallSpan.className = 'habit-success-badge';
      overallSpan.textContent = h.successRate + '%';
      overallSpan.title = 'Completed ' + h.metCount + ' of ' + h.totalPeriods + ' cycles successfully';
      overallVal.appendChild(overallSpan);
      overallBox.appendChild(overallVal);
      metrics.appendChild(overallBox);
    }

    // Streak box (only if streak > 0)
    if (h.streak > 0) {
      var streakBox = document.createElement('div');
      streakBox.className = 'habit-metric-box';
      var streakLabel = document.createElement('span');
      streakLabel.className = 'habit-metric-label';
      streakLabel.textContent = '🔥 Streak';
      streakBox.appendChild(streakLabel);
      var streakVal = document.createElement('div');
      streakVal.className = 'habit-metric-value';
      streakVal.textContent = h.streak;
      streakBox.appendChild(streakVal);
      metrics.appendChild(streakBox);
    }

    // Build card content — if there's a note, use a two-column grid layout
    var hasNote = chit.note && chit.note.trim();
    if (hasNote) {
      var cardGrid = document.createElement('div');
      cardGrid.className = 'habit-card-grid';

      var leftCol = document.createElement('div');
      leftCol.className = 'habit-card-left';
      leftCol.appendChild(header);
      leftCol.appendChild(metrics);
      cardGrid.appendChild(leftCol);

      var notePreview = document.createElement('div');
      notePreview.className = 'habit-note-preview';
      var noteHtml = chit.note
        .replace(/^#{1,6}\s+(.+)$/gm, '<strong>$1</strong> ')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/^[\-\*]\s+/gm, '• ')
        .replace(/^\d+\.\s+/gm, function(m) { return m.trim() + ' '; })
        .replace(/\n+/g, '  ');
      notePreview.innerHTML = noteHtml.trim();
      cardGrid.appendChild(notePreview);

      card.appendChild(cardGrid);
    } else {
      card.appendChild(header);
      card.appendChild(metrics);
    }

    // ── Interaction: double-click to editor, long-press for quick edit ──
    card.addEventListener('dblclick', function(e) {
      // Don't navigate if the user double-clicked a button or checkbox
      if (e.target.closest('button, input[type="checkbox"]')) return;
      if (typeof storePreviousState === 'function') storePreviousState();
      window.location.href = '/editor?id=' + chit.id;
    });
    if (typeof enableTouchGesture === 'function') {
      enableTouchGesture(card, {
        onLongPress: function () {
          showQuickEditModal(chit, function () { displayChits(); });
        },
      });
    }

    container.appendChild(card);
  });
}

/**
 * Debounced habit update — delays 1 second, resets on each click.
 * Stores pending updates per chit ID so rapid clicks accumulate.
 */
var _habitUpdateTimers = {};
var _habitPendingChits = {};

function _persistHabitUpdate(chit) {
  var id = chit.id;
  _habitPendingChits[id] = chit;

  // Clear existing timer for this chit (reset the delay)
  if (_habitUpdateTimers[id]) {
    clearTimeout(_habitUpdateTimers[id]);
  }

  // Set a new 1-second timer
  _habitUpdateTimers[id] = setTimeout(function() {
    delete _habitUpdateTimers[id];
    var pendingChit = _habitPendingChits[id];
    delete _habitPendingChits[id];
    if (!pendingChit) return;

    fetch('/api/chits/' + pendingChit.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingChit)
    }).then(function(resp) {
      if (resp.ok && typeof fetchChits === 'function') {
        fetchChits();
      } else if (!resp.ok) {
        console.error('[_persistHabitUpdate] Failed:', resp.status);
      }
    }).catch(function(err) {
      console.error('[_persistHabitUpdate] Error:', err);
    });
  }, 1000);
}

/**
 * Optimistically update a habit card's UI without waiting for server round-trip.
 * Moves the card between On Deck / Accomplished sections with animation.
 */
function _optimisticHabitCardUpdate(card, chit, newSuccess, goal) {
  // Update progress text
  var progressSpan = card.querySelector('.habit-progress');
  if (progressSpan) {
    var _oFreqLabel = '';
    var _oRule = chit.recurrence_rule;
    if (_oRule && _oRule.freq) {
      if (_oRule.freq === 'DAILY') _oFreqLabel = ' each Day';
      else if (_oRule.freq === 'WEEKLY') _oFreqLabel = ' each Week';
      else if (_oRule.freq === 'MONTHLY') _oFreqLabel = ' each Month';
      else if (_oRule.freq === 'YEARLY') _oFreqLabel = ' each Year';
    }
    progressSpan.textContent = newSuccess + ' / ' + goal + _oFreqLabel;
    progressSpan.title = 'Progress: ' + newSuccess + ' of ' + goal + ' this period';
  }

  // Update cycle progress badge
  var cycleBadge = card.querySelector('.habit-cycle-badge');
  if (cycleBadge) {
    var pct = Math.round((newSuccess / goal) * 100);
    cycleBadge.textContent = pct + '%';
    cycleBadge.title = 'This period, ' + newSuccess + ' of ' + goal + ' tasks completed';
  }

  // Update checkbox for goal=1
  var checkbox = card.querySelector('.habit-header input[type="checkbox"]');
  if (checkbox) {
    checkbox.checked = newSuccess >= goal;
  }

  // Check if completion status changed
  var wasCompleted = card.classList.contains('habit-done');
  var isNowCompleted = newSuccess >= goal;

  if (wasCompleted !== isNowCompleted) {
    // Phase 1: fade out the card (400ms)
    card.style.transition = 'opacity 0.4s ease';
    card.style.opacity = '0';

    setTimeout(function() {
      var container = card.closest('.checklist-view');
      if (!container) return;

      // Update card state
      if (isNowCompleted) {
        card.classList.add('habit-done');
        var titleLink = card.querySelector('.habit-header a');
        if (titleLink) titleLink.style.textDecoration = 'line-through';
        _updateStatusBadge(card, 'Complete');
      } else {
        card.classList.remove('habit-done');
        var titleLink = card.querySelector('.habit-header a');
        if (titleLink) titleLink.style.textDecoration = '';
        _updateStatusBadge(card, '');
      }

      // Find or create section headers
      var doneHeader = container.querySelector('.habit-section-done');
      var onDeckHeader = container.querySelector('.habit-section-header:not(.habit-section-done):not(.habit-section-resting)');
      var restingHeader = container.querySelector('.habit-section-resting');

      // Move the card to the correct section
      if (isNowCompleted) {
        card.classList.remove('habit-resting');
        if (!doneHeader) {
          doneHeader = document.createElement('div');
          doneHeader.className = 'habit-section-header habit-section-done';
          doneHeader.innerHTML = '✅ Accomplished';
          container.appendChild(doneHeader);
        }
        doneHeader.insertAdjacentElement('afterend', card);
      } else if (chit.habit_reset_period && _isResetPeriodActive(chit)) {
        // Move to Out of Mind
        card.classList.add('habit-resting');
        if (!restingHeader) {
          restingHeader = document.createElement('div');
          restingHeader.className = 'habit-section-header habit-section-resting';
          restingHeader.innerHTML = '😌 Out of Mind';
          // Insert before Accomplished header or at end
          if (doneHeader) {
            container.insertBefore(restingHeader, doneHeader);
          } else {
            container.appendChild(restingHeader);
          }
        }
        restingHeader.insertAdjacentElement('afterend', card);
      } else {
        if (onDeckHeader) {
          var nextSibling = onDeckHeader.nextElementSibling;
          while (nextSibling && nextSibling.classList.contains('habit-card') && !nextSibling.classList.contains('habit-done')) {
            nextSibling = nextSibling.nextElementSibling;
          }
          container.insertBefore(card, nextSibling);
        } else {
          container.insertBefore(card, container.firstChild);
        }
      }

      // Remove empty On Deck header if no incomplete cards remain
      if (onDeckHeader && !container.querySelector('.habit-card:not(.habit-done)')) {
        onDeckHeader.remove();
      }

      // Phase 2: fade back in (400ms)
      card.style.opacity = '0';
      card.style.transition = 'opacity 0.4s ease';
      // Force reflow so the browser sees opacity:0 before transitioning
      void card.offsetWidth;
      card.style.opacity = isNowCompleted ? '0.6' : '1';

      // Clean up
      setTimeout(function() {
        card.style.transition = '';
      }, 450);
    }, 420);
  }
}

/** Update or remove the status badge on a habit card */
function _updateStatusBadge(card, status) {
  var header = card.querySelector('.habit-header');
  if (!header) return;
  var existing = header.querySelector('.habit-complete-line');
  if (status === 'Complete') {
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'habit-complete-line';
      header.appendChild(existing);
    }
    existing.textContent = '✅ Complete for this cycle.';
  } else if (existing) {
    existing.remove();
  }
}

/* ── Assigned to Me View (Requirement 7.3) ───────────────────────────────── */

/**
 * Render the "Assigned to Me" view — shows only chits where assigned_to
 * matches the current user's ID.

 */
function _onHabitsWindowChange(newVal) {
  // Update settings cache
  if (window._cwocSettings) window._cwocSettings.habits_success_window = newVal;
  // Persist to backend
  var currentUserId = (typeof getCurrentUser === 'function' && getCurrentUser()) ? getCurrentUser().user_id : null;
  if (currentUserId) {
    var s = Object.assign({}, window._cwocSettings || {}, { user_id: currentUserId, habits_success_window: newVal });
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(function(e) { console.error('Failed to save habits window:', e); });
  }
  // Re-render if currently in habits mode
  if (_tasksViewMode === 'habits') displayChits();
}

/**
 * Initialize the sidebar habits success window dropdown from cached settings.
 */
function _initHabitsWindowDropdown() {
  var sel = document.getElementById('habits-success-window-sidebar');
  if (!sel) return;
  var settings = window._cwocSettings || {};
  var val = settings.habits_success_window || '30';
  sel.value = val;
  // Also show/hide based on current mode
  var wrap = document.getElementById('habits-window-wrap');
  if (wrap) wrap.style.display = _tasksViewMode === 'habits' ? '' : 'none';
}

// Run init after settings are loaded
if (typeof getCachedSettings === 'function') {
  getCachedSettings().then(_initHabitsWindowDropdown);
}
