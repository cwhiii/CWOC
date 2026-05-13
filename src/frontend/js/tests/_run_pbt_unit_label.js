/**
 * Runner script for Property 3: Unit Label Selection
 * Execute with: node src/frontend/js/tests/_run_pbt_unit_label.js
 * NO installs required.
 */

function _getUnitLabel(obj, unitSystem) {
    if (unitSystem === 'metric' && obj.metric_units) return obj.metric_units;
    return obj.units || '';
}

function randomString(maxLen) {
    var len = Math.floor(Math.random() * maxLen) + 1;
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var s = '';
    for (var i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
}

function randomUnitSystem() {
    return Math.random() < 0.5 ? 'imperial' : 'metric';
}

function randomObj() {
    var roll = Math.random();
    var units, metric_units;
    if (roll < 0.25) {
        units = randomString(8);
        metric_units = randomString(8);
        if (units === metric_units) metric_units += 'x';
    } else if (roll < 0.4) {
        var same = randomString(8);
        units = same;
        metric_units = same;
    } else if (roll < 0.55) {
        units = randomString(8);
        metric_units = '';
    } else if (roll < 0.7) {
        units = randomString(8);
        metric_units = null;
    } else if (roll < 0.8) {
        units = randomString(8);
        metric_units = undefined;
    } else if (roll < 0.9) {
        units = '';
        metric_units = '';
    } else {
        units = Math.random() < 0.5 ? '' : null;
        metric_units = randomString(8);
    }
    return { units: units, metric_units: metric_units };
}

function checkProperty(obj, unitSystem) {
    var result = _getUnitLabel(obj, unitSystem);

    if (unitSystem === 'metric' && obj.metric_units) {
        if (result !== obj.metric_units) {
            return 'FAIL: metric system with metric_units="' + obj.metric_units +
                '" should return metric_units, got "' + result + '"';
        }
    } else if (unitSystem === 'imperial') {
        var expected = obj.units || '';
        if (result !== expected) {
            return 'FAIL: imperial system with units="' + obj.units +
                '" should return "' + expected + '", got "' + result + '"';
        }
    } else if (unitSystem === 'metric' && !obj.metric_units) {
        var expected2 = obj.units || '';
        if (result !== expected2) {
            return 'FAIL: metric system with falsy metric_units, units="' + obj.units +
                '" should return "' + expected2 + '", got "' + result + '"';
        }
    }

    if (obj.units === obj.metric_units && obj.units) {
        var imperialResult = _getUnitLabel(obj, 'imperial');
        var metricResult = _getUnitLabel(obj, 'metric');
        if (imperialResult !== metricResult) {
            return 'FAIL: identical units="' + obj.units + '" should return same value ' +
                'for both systems, got imperial="' + imperialResult +
                '" vs metric="' + metricResult + '"';
        }
    }

    return null;
}

// Run
var iterations = 200;
var failures = [];
var passed = 0;

for (var i = 0; i < iterations; i++) {
    var obj = randomObj();
    var unitSystem = randomUnitSystem();
    var error = checkProperty(obj, unitSystem);
    if (error) {
        failures.push({ iteration: i, obj: JSON.stringify(obj), unitSystem: unitSystem, error: error });
    } else {
        passed++;
    }
}

console.log('Feature: indicators_zone, Property 3: Unit Label Selection');
console.log('Validates: Requirements 1.6, 9.2, 9.3, 9.4');
console.log('────────────────────────────────────────────────────────────');
console.log('Iterations: ' + iterations);
console.log('Passed: ' + passed);
console.log('Failed: ' + failures.length);
console.log('────────────────────────────────────────────────────────────');

if (failures.length === 0) {
    console.log('✓ ALL TESTS PASSED');
    process.exit(0);
} else {
    console.log('✗ FAILURES:');
    for (var j = 0; j < Math.min(failures.length, 10); j++) {
        var f = failures[j];
        console.log('  [' + f.iteration + '] obj=' + f.obj + ' unitSystem=' + f.unitSystem);
        console.log('       ' + f.error);
    }
    if (failures.length > 10) {
        console.log('  ... and ' + (failures.length - 10) + ' more failures');
    }
    process.exit(1);
}
