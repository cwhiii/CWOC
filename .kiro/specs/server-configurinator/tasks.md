# Implementation Plan: Server Configurinator

## Overview

Build `configurinator/build.sh` — a single, self-contained Bash script that provisions a bare Linux machine (Debian/Ubuntu or Fedora/RHEL) into a running CWOC production server. The script is built up section by section, with each task adding a logical phase. Every task builds on the previous one so the script is always in a runnable state.

## Tasks

- [x] 1. Create script skeleton with guards and logging helpers
  - Create `configurinator/build.sh` with shebang (`#!/usr/bin/env bash`), `set -e`, and a header comment explaining the script's purpose
  - Implement logging helper functions: `log_step()`, `log_ok()`, `log_error()`
  - Implement `check_root()` — verify running as root, print error and exit 1 if not
  - Implement `detect_package_manager()` — check for `apt-get` or `dnf`, set `PKG_MGR` variable, exit 1 with error if neither found
  - Create the `main()` function that calls each phase function in order (stub the later ones)
  - Make the script executable (`chmod +x`)
  - _Requirements: 7.1, 7.2, 7.3, 10.1, 10.2, 10.3_

- [x] 2. Implement system package installation phase
  - Implement `install_system_packages()` function
  - For `apt-get`: run `apt-get update -y`, then install `python3`, `python3-venv`, `python3-pip`, `sqlite3`
  - For `dnf`: install `python3`, `python3-pip`, `sqlite`
  - Add `log_step` before and `log_ok` after the install commands
  - Handle install failures with an identifying error message before `set -e` terminates
  - Wire into `main()` after the guard checks
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.1, 10.2_

- [x] 3. Implement directory structure creation phase
  - Implement `create_directories()` function
  - Use `mkdir -p` to create `/app`, `/app/backend`, `/app/frontend`, `/app/static`, `/app/data`
  - Set ownership to root with `chown -R root:root /app`
  - Set read/write permissions on `/app/data` for root
  - Preserve any existing contents (mkdir -p handles this naturally)
  - Add step/ok logging
  - Wire into `main()`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3_

- [x] 4. Implement virtual environment setup phase
  - Implement `setup_virtualenv()` function
  - Check if `/app/venv/bin/python` exists — skip creation if it does
  - If not, create venv with `python3 -m venv /app/venv`
  - Upgrade pip inside the venv: `/app/venv/bin/pip install --upgrade pip`
  - Handle creation failure with error message and exit
  - Add step/ok logging (log skip if venv already exists)
  - Wire into `main()`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.2_

- [x] 5. Implement Python dependency installation phase
  - Implement `install_python_deps()` function
  - Use `/app/venv/bin/pip install` to install `fastapi`, `uvicorn`, `pydantic`, `python-dotenv`
  - Handle pip install failure with error message identifying the failed step
  - Add step/ok logging
  - Wire into `main()`
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Checkpoint — Verify provisioning foundations
  - Ensure the script runs cleanly through tasks 1–5 on a fresh system
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement systemd service configuration phase
  - Implement `configure_service()` function
  - Stop existing cwoc service if running (`systemctl stop cwoc` guarded by `systemctl is-active` check)
  - Write the systemd unit file to `/etc/systemd/system/cwoc.service` using a heredoc matching the existing `cwoc.service` in the repo
  - Unit file must include: `WorkingDirectory=/app`, `ExecStart=/app/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 3333 --log-level debug`, `Restart=always`, `RestartSec=3`
  - Run `systemctl daemon-reload`
  - Run `systemctl enable cwoc`
  - Overwrite existing unit file if present (idempotent)
  - Add step/ok logging
  - Wire into `main()`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.3_

- [x] 8. Implement service startup and verification phase
  - Implement `start_and_verify()` function
  - Start the service with `systemctl start cwoc`
  - Wait 5 seconds with `sleep 5`
  - Check `systemctl is-active cwoc`
  - If active: print success message with the URL `http://<machine-ip>:3333` (detect IP from `hostname -I`)
  - If not active: print error message, dump last 20 lines of `journalctl -u cwoc --no-pager -n 20`, exit with non-zero status
  - Add step/ok logging
  - Wire into `main()` as the final phase
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 9. Final checkpoint — Full script review and idempotency
  - Review the complete `configurinator/build.sh` for consistency, correct phase ordering, and idempotent behavior
  - Verify all logging follows the `[STEP]`/`[OK]`/`[ERROR]` format consistently
  - Verify `set -e` is at the top and all phases are called from `main()`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

## Notes

- This is a single Bash script (`configurinator/build.sh`) — no test frameworks, no npm, no build step
- No property-based tests — the script is pure side effects against system state
- The script does NOT deploy application files (backend/, frontend/, static/ contents) — that's handled by the existing `cwoc-push.sh`
- Each task adds a logical section to the script, keeping it runnable at every step
- Idempotency is built into each phase: `mkdir -p`, venv existence checks, package manager re-install safety, unit file overwrite
