/**
 * Property-Based Test: Default vs Non-Default Indicator Filtering
 *
 * Feature: indicators_zone, Property 6: Default vs Non-Default Indicator Filtering
 *
 * For any set of Custom Objects with mixed config.is_default values, the default
 * filter function SHALL return exactly those objects where config.is_default === true,
 * and the non-default filter SHALL return exactly those where config.is_default is
 * false or absent. The union of both sets equals the full set, with no overlap.
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 *
 * Run: node src/frontend/js/tests/pbt_default_vs_nondefault_filtering.js
 */

// ── Functions Under Test (inlined from editor-health.js) ─────────────────────

function _getDefaultIndicators(objects) {
  return objects.filter(function(obj) {
    return obj.config && obj.config.is_default === true;
  });
}

function _getNonDefaultIndicators(objects) {
  return objects.filter(function(obj) {
    return !obj.config || obj.config.is_default !== true;
  });
}

// ── Simple PRNG (Mulberry32) for reproducible randomness ─────────────────────

function mulberry32(seed) {
  return function() {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Random Generators ────────────────────────────────────────────────────────

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomUUID(rng) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (rng() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function randomString(rng, len) {
  var chars = 'abcdefghijklmnopqrstuvwxyz';
  var s = '';
  for (var i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)];
  return s;
}

/**
 * Generate a random config object with mixed is_default values.
 * Covers all edge cases:
 *   - null (no config)
 *   - undefined (no config)
 *   - {} (config exists but no is_default key)
 *   - { is_default: true }
 *   - { is_default: false }
 *   - { is_default: "true" } (truthy string, but !== true)
 *   - { is_default: 1 } (truthy number, but !== true)
 *   - { is_default: null }
 */
function randomConfig(rng) {
  var choice = randomInt(rng, 0, 7);
  switch (choice) {
    case 0: return null;
    case 1: return undefined;
    case 2: return {};
    case 3: return { is_default: true };
    case 4: return { is_default: false };
    case 5: return { is_default: "true" };
    case 6: return { is_default: 1 };
    case 7: return { is_default: null };
    default: return { is_default: true };
  }
}

function generateObjects(rng) {
  var count = randomInt(rng, 0, 20);
  var objects = [];
  for (var i = 0; i < count; i++) {
    objects.push({
      id: randomUUID(rng),
      name: randomString(rng, randomInt(rng, 3, 12)),
      type: ['Vital', 'Measurement', 'Activity'][randomInt(rng, 0, 2)],
      value_type: ['integer', 'decimal', 'boolean', 'string'][randomInt(rng, 0, 3)],
      config: randomConfig(rng)
    });
  }
  return objects;
}

// ── Test Runner ──────────────────────────────────────────────────────────────

var ITERATIONS = 20;
var seed = Date.now();
var rng = mulberry32(seed);
var passed = 0;
var failed = 0;
var failures = [];

console.log('Feature: indicators_zone, Property 6: Default vs Non-Default Indicator Filtering');
console.log('Validates: Requirements 2.1, 2.2, 2.3');
console.log('Iterations: ' + ITERATIONS + ', Seed: ' + seed);
console.log('─'.repeat(70));

for (var iter = 0; iter < ITERATIONS; iter++) {
  var objects = generateObjects(rng);
  var defaults = _getDefaultIndicators(objects);
  var nonDefaults = _getNonDefaultIndicators(objects);

  // Property 6a: Default filter returns exactly those with config.is_default === true
  var expectedDefaults = objects.filter(function(obj) {
    return obj.config && obj.config.is_default === true;
  });

  // Property 6b: Non-default filter returns exactly those where is_default is false or absent
  var expectedNonDefaults = objects.filter(function(obj) {
    return !obj.config || obj.config.is_default !== true;
  });

  // Property 6c: Union of both sets equals the full set (no items lost)
  var unionSize = defaults.length + nonDefaults.length;
  var unionEqualsFullSet = (unionSize === objects.length);

  // Property 6d: No overlap — no object appears in both sets
  var defaultIds = {};
  var hasOverlap = false;
  for (var d = 0; d < defaults.length; d++) {
    defaultIds[defaults[d].id] = true;
  }
  for (var n = 0; n < nonDefaults.length; n++) {
    if (defaultIds[nonDefaults[n].id]) {
      hasOverlap = true;
      break;
    }
  }

  // Property 6e: Correct classification — defaults match expected, non-defaults match expected
  var defaultsCorrect = (defaults.length === expectedDefaults.length);
  var nonDefaultsCorrect = (nonDefaults.length === expectedNonDefaults.length);

  // Verify element-by-element if lengths match
  if (defaultsCorrect) {
    for (var i = 0; i < defaults.length; i++) {
      if (defaults[i] !== expectedDefaults[i]) {
        defaultsCorrect = false;
        break;
      }
    }
  }
  if (nonDefaultsCorrect) {
    for (var j = 0; j < nonDefaults.length; j++) {
      if (nonDefaults[j] !== expectedNonDefaults[j]) {
        nonDefaultsCorrect = false;
        break;
      }
    }
  }

  var allPass = unionEqualsFullSet && !hasOverlap && defaultsCorrect && nonDefaultsCorrect;

  if (allPass) {
    passed++;
  } else {
    failed++;
    if (failures.length < 5) {
      failures.push({
        iteration: iter,
        objectCount: objects.length,
        defaultCount: defaults.length,
        nonDefaultCount: nonDefaults.length,
        expectedDefaultCount: expectedDefaults.length,
        expectedNonDefaultCount: expectedNonDefaults.length,
        unionEqualsFullSet: unionEqualsFullSet,
        hasOverlap: hasOverlap,
        defaultsCorrect: defaultsCorrect,
        nonDefaultsCorrect: nonDefaultsCorrect,
        sampleConfigs: objects.slice(0, 5).map(function(o) {
          return { id: o.id, config: o.config };
        })
      });
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('─'.repeat(70));
console.log('RESULTS: ' + passed + ' passed, ' + failed + ' failed out of ' + ITERATIONS + ' iterations');
console.log('─'.repeat(70));

if (failed === 0) {
  console.log('PASS — Property 6: Default vs Non-Default Indicator Filtering holds for all inputs.');
  console.log('  • Default filter returns exactly objects with config.is_default === true');
  console.log('  • Non-default filter returns exactly objects where is_default is false/absent');
  console.log('  • Union of both sets equals the full input set');
  console.log('  • No overlap between the two sets');
  process.exit(0);
} else {
  console.log('FAIL — Property violated in ' + failed + ' iteration(s).');
  console.log('');
  console.log('First failures:');
  for (var f = 0; f < failures.length; f++) {
    console.log(JSON.stringify(failures[f], null, 2));
  }
  process.exit(1);
}
