/**
 * shared-tab-sync.js — Cross-tab data sharing with leader election.
 *
 * Uses BroadcastChannel to share chit data between open tabs so only one tab
 * (the "leader") fetches from the API. Other tabs receive data via broadcast.
 * Leader election uses the Web Locks API — when the leader tab closes, the lock
 * is released and another tab automatically acquires it, becoming the new leader.
 *
 * Architecture:
 *   - One leader tab holds the Web Lock and is responsible for API fetches.
 *   - When the leader fetches fresh chits, it broadcasts them to all tabs.
 *   - Follower tabs listen for broadcasts and update their local data without fetching.
 *   - When any tab writes (save/delete), it broadcasts an invalidation so the leader re-fetches.
 *   - If a follower doesn't receive data within a timeout, it fetches independently (resilience).
 *
 * Depends on: nothing (loads early, before shared-utils.js is fine)
 * Loaded BEFORE shared-alarms.js and shared.js.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Tab Sync — BroadcastChannel + Web Locks leader election
// ══════════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var CHANNEL_NAME = 'cwoc-tab-sync';
  var LOCK_NAME = 'cwoc-tab-leader';
  var STALE_TIMEOUT = 10000; // 10s — if no broadcast received, fetch independently
  var TAB_ID = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  // ── State ──
  window._cwocTabSync = {
    isLeader: false,
    channel: null,
    tabId: TAB_ID,
    lastBroadcastTs: 0,       // timestamp of last received broadcast
    leaderHeartbeatTimer: null,
    followerTimeoutTimer: null,
    initialized: false
  };

  // ── Feature detection ──
  var hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';
  var hasWebLocks = typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function';

  if (!hasBroadcastChannel) {
    console.debug('[TabSync] BroadcastChannel not supported — each tab fetches independently');
    window._cwocTabSync.isLeader = true; // act as standalone
    return;
  }

  // ── Create channel ──
  var channel = new BroadcastChannel(CHANNEL_NAME);
  window._cwocTabSync.channel = channel;

  // ── Message handler ──
  channel.onmessage = function(event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'chits-data':
        // Leader is broadcasting fresh chit data
        _onChitsReceived(msg.chits, msg.ts);
        break;

      case 'invalidate':
        // A tab wrote data — leader should re-fetch
        if (window._cwocTabSync.isLeader) {
          console.debug('[TabSync] Received invalidate from tab', msg.tabId, '— re-fetching');
          _leaderFetchAndBroadcast();
        }
        break;

      case 'leader-heartbeat':
        // Leader is alive — reset follower timeout
        window._cwocTabSync.lastBroadcastTs = Date.now();
        break;

      case 'request-data':
        // A new tab is asking for current data
        if (window._cwocTabSync.isLeader) {
          console.debug('[TabSync] New tab requested data — broadcasting');
          _leaderBroadcastCurrent();
        }
        break;
    }
  };

  /**
   * Handle received chit data from the leader.
   */
  function _onChitsReceived(chitsData, ts) {
    if (!Array.isArray(chitsData)) return;
    window._cwocTabSync.lastBroadcastTs = Date.now();

    // Update the global chits array (dashboard)
    if (typeof chits !== 'undefined' && typeof displayChits === 'function') {
      // Dashboard page — update the global chits array and re-render
      chits = chitsData;
      // Apply timezone conversion (same as fetchChits does)
      if (typeof _currentTimezone !== 'undefined' && typeof getChitDisplayTime === 'function') {
        chits.forEach(function(chit) {
          if (chit.start_datetime) {
            var startResult = getChitDisplayTime(chit, 'start_datetime', _currentTimezone);
            if (startResult) {
              chit.start_datetime_obj = startResult.date;
              if (startResult.warning) chit._tzWarning = true;
            } else {
              chit.start_datetime_obj = new Date(chit.start_datetime);
            }
          }
          if (chit.end_datetime) {
            var endResult = getChitDisplayTime(chit, 'end_datetime', _currentTimezone);
            if (endResult) {
              chit.end_datetime_obj = endResult.date;
              if (endResult.warning) chit._tzWarning = true;
            } else {
              chit.end_datetime_obj = new Date(chit.end_datetime);
            }
          }
          if (chit.due_datetime) {
            var dueResult = getChitDisplayTime(chit, 'due_datetime', _currentTimezone);
            if (dueResult) {
              chit._due_datetime_obj = dueResult.date;
              if (dueResult.warning) chit._tzWarning = true;
            }
          }
        });
      }
      if (typeof _computePrerequisiteFlags === 'function') _computePrerequisiteFlags(chits);
      displayChits();
      console.debug('[TabSync] Follower updated dashboard with', chitsData.length, 'chits from leader');
    }

    // Update shared alarm system data
    window._sharedChits = chitsData;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Leader election via Web Locks
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Attempt to acquire the leader lock. The lock is held for the lifetime of
   * the tab — when the tab closes, the lock is released and another waiting
   * tab acquires it automatically.
   */
  function _electLeader() {
    if (!hasWebLocks) {
      // No Web Locks — fall back to "first tab wins" via BroadcastChannel negotiation
      _fallbackLeaderElection();
      return;
    }

    // Request the lock — this will queue if another tab holds it.
    // The callback runs when we acquire the lock. It must return a promise
    // that never resolves (to hold the lock until the tab closes).
    navigator.locks.request(LOCK_NAME, function(lock) {
      // We are now the leader
      _becomeLeader();

      // Return a promise that never resolves — holds the lock until tab closes
      return new Promise(function() {
        // This promise intentionally never resolves.
        // When the tab closes, the lock is automatically released.
      });
    });

    // While waiting for the lock, we're a follower
    _becomeFollower();
  }

  /**
   * Fallback leader election for browsers without Web Locks.
   * Uses a simple "announce and wait" pattern via BroadcastChannel.
   */
  function _fallbackLeaderElection() {
    // Announce ourselves
    channel.postMessage({ type: 'leader-claim', tabId: TAB_ID, ts: Date.now() });

    // Wait briefly to see if anyone else claims leadership
    var claimReceived = false;
    var tempHandler = function(event) {
      if (event.data && event.data.type === 'leader-active' && event.data.tabId !== TAB_ID) {
        claimReceived = true;
      }
    };
    channel.addEventListener('message', tempHandler);

    setTimeout(function() {
      channel.removeEventListener('message', tempHandler);
      if (!claimReceived) {
        _becomeLeader();
      } else {
        _becomeFollower();
      }
    }, 200);
  }

  /**
   * Transition this tab to leader role.
   */
  function _becomeLeader() {
    var wasFollower = !window._cwocTabSync.isLeader;
    window._cwocTabSync.isLeader = true;
    console.log('[TabSync] This tab is now the LEADER (id:', TAB_ID, ')');

    // Announce leadership
    channel.postMessage({ type: 'leader-active', tabId: TAB_ID });

    // Stop follower timeout if it was running
    if (window._cwocTabSync.followerTimeoutTimer) {
      clearTimeout(window._cwocTabSync.followerTimeoutTimer);
      window._cwocTabSync.followerTimeoutTimer = null;
    }

    // Start heartbeat (every 5s, tells followers the leader is alive)
    if (window._cwocTabSync.leaderHeartbeatTimer) {
      clearInterval(window._cwocTabSync.leaderHeartbeatTimer);
    }
    window._cwocTabSync.leaderHeartbeatTimer = setInterval(function() {
      channel.postMessage({ type: 'leader-heartbeat', tabId: TAB_ID, ts: Date.now() });
    }, 5000);

    // If we just became leader (were a follower), do an immediate fetch and broadcast
    if (wasFollower) {
      _leaderFetchAndBroadcast();
    }
  }

  /**
   * Transition this tab to follower role.
   */
  function _becomeFollower() {
    if (window._cwocTabSync.isLeader) return; // already leader, don't downgrade
    console.debug('[TabSync] This tab is a FOLLOWER (id:', TAB_ID, ')');

    // Request current data from the leader
    channel.postMessage({ type: 'request-data', tabId: TAB_ID });

    // Start follower timeout — if no data received within STALE_TIMEOUT, fetch independently
    _resetFollowerTimeout();
  }

  /**
   * Reset the follower's "no data received" timeout.
   * If the timeout fires, the follower fetches independently as a safety net.
   */
  function _resetFollowerTimeout() {
    if (window._cwocTabSync.isLeader) return;
    if (window._cwocTabSync.followerTimeoutTimer) {
      clearTimeout(window._cwocTabSync.followerTimeoutTimer);
    }
    window._cwocTabSync.followerTimeoutTimer = setTimeout(function() {
      // No data from leader in STALE_TIMEOUT — fetch independently
      var elapsed = Date.now() - window._cwocTabSync.lastBroadcastTs;
      if (elapsed >= STALE_TIMEOUT) {
        console.debug('[TabSync] Follower timeout — no leader data in', STALE_TIMEOUT, 'ms, fetching independently');
        // Don't call fetchChits directly (it may not exist on non-dashboard pages)
        // Instead, just fetch the API and update shared state
        _followerIndependentFetch();
      }
    }, STALE_TIMEOUT);
  }

  /**
   * Follower fetches independently when leader is unresponsive.
   */
  function _followerIndependentFetch() {
    fetch('/api/chits').then(function(r) { return r.json(); }).then(function(data) {
      if (Array.isArray(data)) {
        window._sharedChits = data;
        // If on dashboard, update the global chits array
        if (typeof chits !== 'undefined' && typeof displayChits === 'function') {
          chits = data;
          displayChits();
        }
      }
    }).catch(function(err) {
      console.error('[TabSync] Follower independent fetch failed:', err);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Leader fetch & broadcast
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Leader fetches chits from the API and broadcasts to all tabs.
   * This replaces the normal fetchChits flow for the leader — the leader
   * still calls fetchChits() normally, but after it completes, it broadcasts.
   */
  function _leaderFetchAndBroadcast() {
    if (!window._cwocTabSync.isLeader) return;

    Promise.all([
      fetch('/api/chits').then(function(r) { return r.ok ? r.json() : []; }),
      fetch('/api/shared-chits').then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
      fetch('/api/contacts/birthdays').then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; })
    ]).then(function(results) {
      var ownedChits = Array.isArray(results[0]) ? results[0] : [];
      var sharedChits = Array.isArray(results[1]) ? results[1] : [];
      var birthdayChits = Array.isArray(results[2]) ? results[2] : [];

      // Merge shared chits
      var ownedIds = new Set();
      ownedChits.forEach(function(c) { ownedIds.add(c.id); });
      sharedChits.forEach(function(sc) {
        if (ownedIds.has(sc.id)) return;
        sc._shared = true;
        ownedChits.push(sc);
      });
      // Merge birthday entries
      birthdayChits.forEach(function(bc) {
        bc._isBirthday = true;
        ownedChits.push(bc);
      });

      // Broadcast to all tabs
      try {
        channel.postMessage({
          type: 'chits-data',
          chits: ownedChits,
          ts: Date.now(),
          tabId: TAB_ID
        });
      } catch (e) {
        // postMessage can fail if data is too large for structured clone
        console.error('[TabSync] Broadcast failed (data too large?):', e);
      }

      // Also update local state
      window._sharedChits = ownedChits;
    }).catch(function(err) {
      console.error('[TabSync] Leader fetch failed:', err);
    });
  }

  /**
   * Leader broadcasts whatever chit data it currently has (for new tabs requesting data).
   */
  function _leaderBroadcastCurrent() {
    if (!window._cwocTabSync.isLeader) return;

    var currentData = null;
    // Prefer dashboard's chits array (most complete, includes shared + birthdays)
    if (typeof chits !== 'undefined' && Array.isArray(chits) && chits.length > 0) {
      currentData = chits;
    } else if (window._sharedChits && window._sharedChits.length > 0) {
      currentData = window._sharedChits;
    }

    if (currentData) {
      try {
        channel.postMessage({
          type: 'chits-data',
          chits: currentData,
          ts: Date.now(),
          tabId: TAB_ID
        });
      } catch (e) {
        console.error('[TabSync] Broadcast current failed:', e);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Public API — called by other scripts
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Notify all tabs that data has changed (call after save/delete/update).
   * If this tab is the leader, it re-fetches and broadcasts.
   * If this tab is a follower, it tells the leader to re-fetch.
   */
  window.cwocTabSyncInvalidate = function() {
    if (!channel) return;
    if (window._cwocTabSync.isLeader) {
      // Leader: re-fetch and broadcast
      _leaderFetchAndBroadcast();
    } else {
      // Follower: tell the leader to re-fetch
      channel.postMessage({ type: 'invalidate', tabId: TAB_ID });
    }
  };

  /**
   * Check if this tab is the leader (responsible for API fetches).
   * Other code can use this to skip redundant fetches.
   * @returns {boolean}
   */
  window.cwocTabSyncIsLeader = function() {
    return window._cwocTabSync.isLeader;
  };

  /**
   * Called by fetchChits() after it completes — broadcasts the fresh data to followers.
   * Only does anything if this tab is the leader.
   */
  window.cwocTabSyncBroadcastChits = function(chitsData) {
    if (!window._cwocTabSync.isLeader || !channel) return;
    try {
      channel.postMessage({
        type: 'chits-data',
        chits: chitsData,
        ts: Date.now(),
        tabId: TAB_ID
      });
    } catch (e) {
      console.error('[TabSync] Broadcast after fetchChits failed:', e);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Initialization
  // ══════════════════════════════════════════════════════════════════════════

  // Start leader election immediately
  _electLeader();
  window._cwocTabSync.initialized = true;

  console.debug('[TabSync] Initialized — tab id:', TAB_ID, '| Web Locks:', hasWebLocks);

})();
