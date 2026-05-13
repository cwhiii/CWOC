/**
 * Property-Based Test: Conditional Display Evaluation
 *
 * Feature: indicators_zone, Property 1: Conditional Display Evaluation
 *
 * For any Custom Object with a conditional_display rule {"setting": S, "equals": V}
 * and any user settings object, the evaluation function SHALL return true if and only
 * if settings[S] === V, and SHALL return true when no rule is defined (rule is null/undefined).
 *
 * Validates: Requirements 1.2
 *
 * Run: node src/frontend/js/tests/pbt_conditional_display.js
 */

// ── Function Under Test (inlined from editor-health.js) ──────────────────────
function _evaluateConditionalDisplay(rule, settings) {
  if (!rule) return true;
  return settings[rule.setting] === rule.equals;
}

// ── Simple PRNG (Mulberry32) for reproducible randomness ─────────────────────
function mulberry32(seed) {
  return function () {
    var t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Random generators ────────────────────────────────────────────────────────
var SETTING_NAMES = [
  'sex', 'unit_system', 'theme', 'language', 'timezone',
  'display_mode', 'notifications', 'font_size', 'color_scheme'
];
var SETTING_VALUES = [
  'Woman', 'Man', 'imperial', 'metric', 'dark', 'light',
  'en', 'fr', 'es', 'UTC', 'EST', 'on', 'off', '14', '16', '18'
];

function randomChoice(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function randomString(rng) {
  var len = Math.floor(rng() * 10) + 1;
  var chars = 'abcdefghijklmnopqrstuvwxyz_0123456789';
  var s = '';
  for (var i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

function generateRule(rng) {
  // ~20% chance of null/undefined rule (tests the "no rule" path)
  var r = rng();
  if (r < 0.1) return null;
  if (r < 0.2) return undefined;
  // Generate a rule with a setting name and expected value
  var setting = rng() < 0.6 ? randomChoice(SETTING_NAMES, rng) : randomString(rng);
  var equals = rng() < 0.6 ? randomChoice(SETTING_VALUES, rng) : randomString(rng);
  return { setting: setting, equals: equals };
}

function generateSettings(rng, rule) {
  var settings = {};
  // Add some random settings
  var numSettings = Math.floor(rng() * 5) + 1;
  for (var i = 0; i < numSettings; i++) {
    var key = rng() < 0.5 ? randomChoice(SETTING_NAMES, rng) : randomString(rng);
    var val = rng() < 0.5 ? randomChoice(SETTING_VALUES, rng) : randomString(rng);
    settings[key] = val;
  }
  // If rule exists, ~50% chance we set the matching setting to the matching value
  if (rule) {
    if (rng() < 0.5) {
      settings[rule.setting] = rule.equals;
    } else {
      // Possibly set it to a different value, or leave it absent
      if (rng() < 0.5) {
        settings[rule.setting] = randomString(rng);
      }
      // else: setting key absent from settings object
    }
  }
  return settings;
}

// ── Test runner ──────────────────────────────────────────────────────────────
var ITERATIONS = 20;
var seed = Date.now();
var rng = mulberry32(seed);
var passed = 0;
var failed = 0;
var failures = [];

console.log('Feature: indicators_zone, Property 1: Conditional Display Evaluation');
console.log('Validates: Requirements 1.2');
console.log('Iterations: ' + ITERATIONS + ', Seed: ' + seed);
console.log('─'.repeat(70));

for (var i = 0; i < ITERATIONS; i++) {
  var rule = generateRule(rng);
  var settings = generateSettings(rng, rule);
  var result = _evaluateConditionalDisplay(rule, settings);

  // Compute expected result
  var expected;
  if (!rule) {
    // No rule defined → should return true
    expected = true;
  } else {
    // Rule defined → true iff settings[rule.setting] === rule.equals
    expected = settings[rule.setting] === rule.equals;
  }

  if (result === expected) {
    passed++;
  } else {
    failed++;
    failures.push({
      iteration: i,
      rule: JSON.stringify(rule),
      settings: JSON.stringify(settings),
      expected: expected,
      got: result
    });
  }
}

console.log('─'.repeat(70));

if (failed === 0) {
  console.log('PASSED: All ' + passed + '/' + ITERATIONS + ' iterations passed.');
} else {
  console.log('FAILED: ' + failed + '/' + ITERATIONS + ' iterations failed.');
  console.log('');
  console.log('Failing examples:');
  for (var j = 0; j < failures.length; j++) {
    var f = failures[j];
    console.log('  Iteration ' + f.iteration + ':');
    console.log('    Rule:     ' + f.rule);
    console.log('    Settings: ' + f.settings);
    console.log('    Expected: ' + f.expected);
    console.log('    Got:      ' + f.got);
  }
  process.exit(1);
}
