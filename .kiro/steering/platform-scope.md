# Platform Scope — Mandatory Clarification Before Work Begins

**ABSOLUTE RULE: Never proceed on any spec, task, or feature without explicitly knowing which platform(s) it applies to.**

Before starting implementation on ANY spec or task:
1. Determine whether it applies to **web** (desktop browser), **mobile** (mobile browser), **app** (Android), or a combination.
2. If the spec/task does not clearly state the target platform(s), **STOP and ask the user** before doing any work.
3. Do not infer or assume the platform from context. Get explicit confirmation.

**Valid platform scopes:**
- Web only
- Mobile only (mobile browser)
- App only (Android)
- Web + Mobile (both browser versions)
- Web + App
- Mobile + App
- All platforms (Web + Mobile + App)

**This applies to:**
- New specs being created
- Existing specs being worked on
- Individual tasks within a spec
- Bug fixes
- Feature requests in conversation

**No exceptions.** Even if it "seems obvious," confirm the platform scope before writing code.

**Exception — Settings page changes are ALWAYS universal (all platforms).** If the user talks about the settings page, that applies to web, mobile, and app. No need to ask.
