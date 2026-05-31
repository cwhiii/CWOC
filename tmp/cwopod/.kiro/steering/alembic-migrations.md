Here you go. Drop this whole thing into ``:

```markdown
# Alembic Migration Rules - CWOPOD

This steering doc prevents the `Multiple head revisions` crash that causes HTTP 502 errors.

## Core Rule: Linear History Only

CWOPOD uses a single linear migration chain. Branching migrations crash the backend on startup.

## Required Workflow Before Creating Migrations

1. **Always check current state first**
   ```bash
   alembic heads
   alembic current
   ```
   If `alembic heads` returns more than 1 revision ID, STOP. You must fix the branch before creating new migrations.

2. **Never manually create migration files**
   - Do NOT create files like `006_*.py` by hand
   - Do NOT guess the next number or revision ID
   - ALWAYS use: `alembic revision --autogenerate -m "descriptive_message"`
   - Alembic controls the revision ID and parent. Filenames are just for humans.

3. **Verify down_revision before committing**
   After generating a migration, open it and confirm `down_revision` points to the previous head from step 1. 
   If it doesn't, you created a branch. Delete the file and investigate.

4. **Post-generation check**
   After any migration change, run:
   ```bash
   alembic heads
   ```
   There must be exactly 1 result. If there are 2+, you broke it.

## How to Fix Multiple Heads

If `alembic heads` shows multiple revisions:

1. **Identify the branches**: Look at `down_revision` in each head file
2. **Fix the dependency**: Edit the newer migration to set `down_revision` to the other head
3. **Verify**: Run `alembic heads` again. Should show 1.
4. **Only merge if told to**: `alembic merge heads -m "merge_heads"` is a last resort and requires C.W. approval

## Example of What Went Wrong

Bad state that caused the 502:
```
006_order_history_fields.py -> revision: 006_order_history, down_revision: 005
006_resource_usage.py       -> revision: 006_resource_usage, down_revision: 013
```
Result: Two heads. `alembic upgrade head` fails. Container exits 255.

Correct fix:
```python
# 006_resource_usage.py
revision = '006_resource_usage'
down_revision = '006_order_history'  # Must follow 006_order_history, not jump to 013
```

## Activation

Kiro will auto-load this file. To force acknowledgment: `/steering alembic-migrations`

## Why This Matters

Breaking this rule takes down the entire API with `HTTP 502 Bad Gateway` because the `cwopod-app` container fails to start. Every endpoint returns 502 until fixed.
```

After you save that file, run `/steering alembic-migrations` in Kiro so it loads immediately.