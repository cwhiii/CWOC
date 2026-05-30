# Deployment Rules

## Infrastructure Layout

- **Proxmox host**: `ankh-morpork-iii` (SSH: root@192.168.1.x — the Proxmox node itself)
- **LXC container (CT 114)**: `gutenberg` at `192.168.1.114` — this is where cwopod runs
- **GPU**: NVIDIA GeForce GTX 1660, driver 535.261.03, passed through from host to LXC via bind mounts
- When giving commands, ALWAYS specify whether to run on the **Proxmox host** or inside the **LXC (gutenberg)**

## The Install Script Is The Only Interface

- The user will ONLY run `install.sh` on the target server. Nothing else.
- Every fix, cleanup, migration, disk management, or configuration step MUST be handled inside `install.sh`.
- Never ask the user to run manual commands on the server (docker prune, alembic, rm, etc.).
- Never ask the user to SSH in and do something separately.
- The install script must be fully self-contained and idempotent. It handles everything from a fresh state or a re-run.

## The Deploy Flow (from the user's Mac)

1. `rm -rf /opt/cwopod` (done by the install script itself or handled gracefully)
2. `scp -r` the project to the LXC
3. `chmod +x /opt/cwopod/install.sh && bash /opt/cwopod/install.sh`

That's it. The script must handle:
- Disk cleanup (docker prune before building)
- System dependencies
- Docker installation
- Project file detection and arrangement
- Environment configuration
- Docker image builds
- Database migrations
- Service startup and health checks
- AI model pulling

## No Manual Server Intervention

If something needs to happen on the server, put it in the install script. Period.
