# W87: _evaluateConditionalDisplay(rule, settings)

## What the web function does
Evaluates a conditional display rule for a health indicator object. If the rule is set (e.g., `{setting: "sex", equals: "male"}`), the indicator is only shown when the user's settings match. Returns true if the indicator should be displayed.

Simple logic: `return settings[rule.setting] === rule.equals`

## What exists on Android
Nothing. The `HealthIndicatorsZone` renders all indicator objects from the API without checking their `conditional_display` field.

## What's missing
Conditional display filtering. Indicators with a `conditional_display` rule should be hidden when the user's settings don't match the condition (e.g., pregnancy-related indicators hidden for male users).

## Fix needed
In `HealthIndicatorsZone`, filter `indicatorObjects` by evaluating each object's `conditionalDisplay` field against the current user's settings before rendering.
