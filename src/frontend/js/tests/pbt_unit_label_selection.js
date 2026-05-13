/**
 * Property-Based Test: Unit Label Selection
 *
 * Feature: indicators_zone, Property 3: Unit Label Selection
 *
 * For any Custom Object with units and metric_units fields, and any unit_system
 * setting ("imperial" or "metric"), the unit label function SHALL return
 * `metric_units` when unit_system is "metric" and `units` when unit_system is
 * "imperial". When both fields are identical, the same value is returned
 * regardless of setting.
 *
 * Validates: Requirements 1.6, 9.2, 9.3, 9.4
 *
 * Run: node src/frontend/js/tests/pbt_unit_label_selection.js
 * NO npm, NO pip, NO installs required.
 */

// ── Function Under Test (inlined from editor-health.js) ──────────────────────

function _getUnitLabel(obj, unitSystem) {
    if (unitSystem === 'metric' && obj.metric_units) return obj.metric_units;
    return obj.units || '';
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

function randomString(rng, maxLen) {
    var len = Math.floor(rng() * (maxLen || 8)) + 1;
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789°/%·';
    var s = '';
    for (var i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(rng() * chars.length));
    }
    return s;
}

function randomUnitSystem(rng) {
    return rng() < 0.5 ? 'imperial' : 'metric';
}

/**
 * Generate a random Custom Object with units and metric_units fields.
 * Covers: both present & different, both identical, only units present,
 * metric_units falsy (null/undefined/empty), both empty, units falsy with metric_units present.
 */
function randomObj(rng) {
    var roll = rng();
    var units, metric_units;

    if (roll < 0.25) {
        // Both fields present and different
        units = randomString(rng, 8);
        metric_units = randomString(rng, 8);
        if (units === metric_units) metric_units += 'x';
    } else if (roll < 0.4) {
        // Both fields identical (non-empty)
        var same = randomString(rng, 8);
        units = same;
        metric_units = same;
    } else if (roll < 0.55) {
        // Only units present, metric_units empty string
        units = randomString(rng, 8);
        metric_units = '';
    } else if (roll < 0.65) {
        // Only units present, metric_units null
        units = randomString(rng, 8);
        metric_units = null;
    } else if (roll < 0.75) {
        // Only units present, metric_units undefined
        units = randomString(rng, 8);
        metric_units = undefined;
    } else if (roll < 0.85) {
        // Both empty
        units = '';
        metric_units = '';
    } else if (roll < 0.92) {
        // units falsy (empty), metric_units has a value
        units = '';
        metric_units = randomString(rng, 8);
    } else {
        // units null, metric_units has a value
        units = null;
        metric_units = randomString(rng, 8);
    }

    return { units: units, metric_units: metric_units };
}

// ── Property Verification ────────────────────────────────────────────────────

function checkProperty(obj, unitSystem) {
    var result = _getUnitLabel(obj, unitSystem);

    // Property: metric system with truthy metric_units → return metric_units
    if (unitSystem === 'metric' && obj.metric_units) {
        if (result !== obj.metric_units) {
            return 'metric system with metric_units="' + obj.metric_units +
                '" should return metric_units, got "' + result + '"';
        }
    }
    // Property: imperial system → return units (or '' if falsy)
    else if (unitSystem === 'imperial') {
        var expected = obj.units || '';
        if (result !== expected) {
            return 'imperial system with units="' + obj.units +
                '" should return "' + expected + '", got "' + result + '"';
        }
    }
    // Property: metric system with falsy metric_units → fall back to units (or '')
    else if (unitSystem === 'metric' && !obj.metric_units) {
        var expected = obj.units || '';
        if (result !== expected) {
            return 'metric system with falsy metric_units, units="' + obj.units +
                '" should return "' + expected + '", got "' + result + '"';
        }
    }

    // Property: when both fields are identical and truthy, same value regardless of setting
    if (obj.units === obj.metric_units && obj.units) {
        var imperialResult = _getUnitLabel(obj, 'imperial');
        var metricResult = _getUnitLabel(obj, 'metric');
        if (imperialResult !== metricResult) {
            return 'identical units="' + obj.units + '" should return same value ' +
                'for both systems, got imperial="' + imperialResult +
                '" vs metric="' + metricResult + '"';
        }
    }

    return null; // pass
}

// ── Test Runner ──────────────────────────────────────────────────────────────

(function runTests() {
    var ITERATIONS = 20;
    var seed = Date.now();
    var rng = mulberry32(seed);
    var passed = 0;
    var failures = [];

    console.log('Feature: indicators_zone, Property 3: Unit Label Selection');
    console.log('Validates: Requirements 1.6, 9.2, 9.3, 9.4');
    console.log('Iterations: ' + ITERATIONS + ', Seed: ' + seed);
    console.log('─'.repeat(60));

    for (var i = 0; i < ITERATIONS; i++) {
        var obj = randomObj(rng);
        var unitSystem = randomUnitSystem(rng);
        var error = checkProperty(obj, unitSystem);

        if (error) {
            failures.push({
                iteration: i,
                obj: JSON.stringify(obj),
                unitSystem: unitSystem,
                error: error
            });
        } else {
            passed++;
        }
    }

    console.log('─'.repeat(60));
    console.log('Passed: ' + passed + '/' + ITERATIONS);
    console.log('Failed: ' + failures.length + '/' + ITERATIONS);

    if (failures.length === 0) {
        console.log('✓ ALL TESTS PASSED');
    } else {
        console.log('✗ FAILURES:');
        for (var j = 0; j < failures.length; j++) {
            var f = failures[j];
            console.log('  [' + f.iteration + '] obj=' + f.obj +
                ' unitSystem=' + f.unitSystem);
            console.log('       ' + f.error);
        }
        process.exit(1);
    }
})();
