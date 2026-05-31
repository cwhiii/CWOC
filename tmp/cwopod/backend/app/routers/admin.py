"""Admin router: user management, system settings, resource monitoring (admin-only)."""

import logging
import os
import time
from uuid import UUID

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.system_settings import SystemSettings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Dependencies ---


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the current user is an admin."""
    logger.debug("require_admin check: user_id=%s, is_admin=%s", current_user.id, current_user.is_admin)
    if not current_user.is_admin:
        logger.warning("Non-admin user %s attempted admin action", current_user.id)
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# --- Schemas ---


class SystemSettingsResponse(BaseModel):
    allow_public_registration: bool
    default_text_model: str
    default_image_model: str


class SystemSettingsUpdate(BaseModel):
    allow_public_registration: bool | None = None
    default_text_model: str | None = None
    default_image_model: str | None = None


class UserListItem(BaseModel):
    id: UUID
    email: str
    display_name: str | None = None
    is_admin: bool
    created_at: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str | None = None
    is_admin: bool = False


class UpdateUserRequest(BaseModel):
    display_name: str | None = None
    is_admin: bool | None = None
    password: str | None = Field(default=None, min_length=8)


# --- System Settings Endpoints ---


@router.get("/settings", response_model=SystemSettingsResponse)
async def get_system_settings(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get system-wide settings."""
    logger.info("get_system_settings: admin_id=%s", _admin.id)
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        logger.info("get_system_settings: no settings row, returning defaults")
        return SystemSettingsResponse(
            allow_public_registration=False,
            default_text_model="mistral:7b",
            default_image_model="v1-5-pruned-emaonly.safetensors",
        )
    return SystemSettingsResponse(
        allow_public_registration=settings.allow_public_registration,
        default_text_model=settings.default_text_model,
        default_image_model=settings.default_image_model,
    )


@router.patch("/settings", response_model=SystemSettingsResponse)
async def update_system_settings(
    body: SystemSettingsUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update system-wide settings."""
    logger.info("update_system_settings: admin_id=%s, body=%s", _admin.id, body.model_dump())
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = SystemSettings()
        db.add(settings)

    if body.allow_public_registration is not None:
        settings.allow_public_registration = body.allow_public_registration
        logger.info("update_system_settings: allow_public_registration=%s", body.allow_public_registration)

    if body.default_text_model is not None:
        settings.default_text_model = body.default_text_model
        logger.info("update_system_settings: default_text_model=%s", body.default_text_model)

    if body.default_image_model is not None:
        settings.default_image_model = body.default_image_model
        logger.info("update_system_settings: default_image_model=%s", body.default_image_model)

    await db.commit()
    await db.refresh(settings)
    return SystemSettingsResponse(
        allow_public_registration=settings.allow_public_registration,
        default_text_model=settings.default_text_model,
        default_image_model=settings.default_image_model,
    )


# --- User Management Endpoints ---


@router.get("/users")
async def list_users(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users."""
    logger.info("list_users: admin_id=%s", _admin.id)
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    logger.info("list_users: returning %d users", len(users))
    return {
        "users": [
            UserListItem(
                id=u.id,
                email=u.email,
                display_name=u.display_name,
                is_admin=u.is_admin,
                created_at=u.created_at.isoformat() if u.created_at else "",
            )
            for u in users
        ]
    }


@router.post("/users", status_code=201)
async def create_user(
    body: CreateUserRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (admin only)."""
    logger.info("create_user: admin_id=%s, email=%s, is_admin=%s", _admin.id, body.email, body.is_admin)

    normalized_email = body.email.strip().lower()
    password_hash = bcrypt.hashpw(
        body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    user = User(
        email=normalized_email,
        password_hash=password_hash,
        display_name=body.display_name,
        is_admin=body.is_admin,
    )
    db.add(user)

    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        logger.warning("create_user: email already exists: %s", normalized_email)
        raise HTTPException(status_code=400, detail="A user with that email already exists.")

    logger.info("create_user: created user_id=%s, email=%s", user.id, user.email)
    return UserListItem(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a user (admin only)."""
    logger.info("update_user: admin_id=%s, target_user_id=%s, body=%s", _admin.id, user_id, body.model_dump(exclude_none=True))

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.display_name is not None:
        user.display_name = body.display_name
    if body.is_admin is not None:
        # Prevent revoking admin if this would leave zero admins
        if body.is_admin is False and user.is_admin is True:
            from sqlalchemy import func
            admin_count_result = await db.execute(
                select(func.count()).select_from(User).where(User.is_admin == True)
            )
            admin_count = admin_count_result.scalar()
            logger.debug("update_user: current admin count=%d", admin_count)
            if admin_count <= 1:
                logger.warning("update_user: blocked revoking last admin, user_id=%s", user_id)
                raise HTTPException(
                    status_code=400,
                    detail="Cannot revoke admin access — this is the last admin account."
                )
        user.is_admin = body.is_admin
    if body.password is not None:
        user.password_hash = bcrypt.hashpw(
            body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
        ).decode("utf-8")
        logger.info("update_user: password changed for user_id=%s", user_id)

    await db.commit()
    await db.refresh(user)
    logger.info("update_user: updated user_id=%s", user_id)
    return UserListItem(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user (admin only). Cannot delete yourself."""
    logger.info("delete_user: admin_id=%s, target_user_id=%s", _admin.id, user_id)

    if user_id == _admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting the last admin account
    if user.is_admin:
        from sqlalchemy import func
        admin_count_result = await db.execute(
            select(func.count()).select_from(User).where(User.is_admin == True)
        )
        admin_count = admin_count_result.scalar()
        logger.debug("delete_user: current admin count=%d", admin_count)
        if admin_count <= 1:
            logger.warning("delete_user: blocked deleting last admin, user_id=%s", user_id)
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the last admin account."
            )

    await db.delete(user)
    await db.commit()
    logger.info("delete_user: deleted user_id=%s, email=%s", user_id, user.email)


# --- Resource Usage / Cost Estimator Endpoints ---


@router.get("/resources/live")
async def get_live_resources(
    _admin: User = Depends(require_admin),
):
    """Get live system resource usage (CPU, RAM, GPU)."""
    import platform
    import shutil

    logger.info("get_live_resources: admin_id=%s", _admin.id)

    result = {
        "cpu_percent": 0.0,
        "cpu_count": os.cpu_count() or 1,
        "ram_used_mb": 0.0,
        "ram_total_mb": 0.0,
        "ram_percent": 0.0,
        "disk_used_gb": 0.0,
        "disk_total_gb": 0.0,
        "gpu": None,
        "platform": platform.system(),
    }

    # CPU load average (1 min)
    try:
        load = os.getloadavg()
        cpu_count = os.cpu_count() or 1
        result["cpu_percent"] = round((load[0] / cpu_count) * 100, 1)
        result["load_avg_1m"] = round(load[0], 2)
        result["load_avg_5m"] = round(load[1], 2)
        result["load_avg_15m"] = round(load[2], 2)
    except (OSError, AttributeError):
        pass

    # RAM from /proc/meminfo (Linux) or sysctl (macOS)
    try:
        if platform.system() == "Linux":
            with open("/proc/meminfo") as f:
                meminfo = {}
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        meminfo[parts[0].rstrip(":")] = int(parts[1])
            total_kb = meminfo.get("MemTotal", 0)
            available_kb = meminfo.get("MemAvailable", 0)
            result["ram_total_mb"] = round(total_kb / 1024, 0)
            result["ram_used_mb"] = round((total_kb - available_kb) / 1024, 0)
            result["ram_percent"] = round(((total_kb - available_kb) / total_kb) * 100, 1) if total_kb else 0
        else:
            # macOS fallback — use sysctl
            import subprocess
            out = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=5)
            if out.returncode == 0:
                total_bytes = int(out.stdout.strip())
                result["ram_total_mb"] = round(total_bytes / (1024 * 1024), 0)
    except Exception as e:
        logger.debug("get_live_resources: RAM detection failed: %s", e)

    # Disk usage
    try:
        usage = shutil.disk_usage("/")
        result["disk_total_gb"] = round(usage.total / (1024**3), 1)
        result["disk_used_gb"] = round(usage.used / (1024**3), 1)
    except Exception:
        pass

    # GPU via nvidia-smi
    try:
        import subprocess
        gpu_result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if gpu_result.returncode == 0:
            line = gpu_result.stdout.strip().split("\n")[0]
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 5:
                result["gpu"] = {
                    "name": parts[0],
                    "memory_used_mb": float(parts[1]),
                    "memory_total_mb": float(parts[2]),
                    "utilization_pct": float(parts[3]),
                    "temperature_c": float(parts[4]),
                }
    except (FileNotFoundError, Exception):
        pass

    logger.debug("get_live_resources: result=%s", result)
    return result


@router.get("/resources/history")
async def get_resource_history(
    days: int = 30,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated resource usage history.

    Returns per-day totals for the last N days, plus per-operation breakdowns.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, cast, Date

    from app.models.resource_usage import ResourceUsage

    logger.info("get_resource_history: admin_id=%s, days=%d", _admin.id, days)

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Daily aggregates
    daily_query = (
        select(
            cast(ResourceUsage.created_at, Date).label("date"),
            func.count().label("operation_count"),
            func.sum(ResourceUsage.wall_time_seconds).label("total_wall_time"),
            func.sum(ResourceUsage.cpu_time_seconds).label("total_cpu_time"),
            func.sum(ResourceUsage.gpu_time_seconds).label("total_gpu_time"),
            func.max(ResourceUsage.peak_ram_mb).label("peak_ram"),
            func.max(ResourceUsage.peak_gpu_ram_mb).label("peak_gpu_ram"),
        )
        .where(ResourceUsage.created_at >= cutoff)
        .group_by(cast(ResourceUsage.created_at, Date))
        .order_by(cast(ResourceUsage.created_at, Date))
    )
    daily_result = await db.execute(daily_query)
    daily_rows = daily_result.all()

    # Per-operation aggregates
    op_query = (
        select(
            ResourceUsage.operation,
            func.count().label("count"),
            func.sum(ResourceUsage.wall_time_seconds).label("total_wall_time"),
            func.sum(ResourceUsage.cpu_time_seconds).label("total_cpu_time"),
            func.sum(ResourceUsage.gpu_time_seconds).label("total_gpu_time"),
            func.avg(ResourceUsage.wall_time_seconds).label("avg_wall_time"),
            func.avg(ResourceUsage.peak_ram_mb).label("avg_ram"),
        )
        .where(ResourceUsage.created_at >= cutoff)
        .group_by(ResourceUsage.operation)
    )
    op_result = await db.execute(op_query)
    op_rows = op_result.all()

    # Totals
    totals_query = (
        select(
            func.count().label("total_ops"),
            func.sum(ResourceUsage.wall_time_seconds).label("total_wall_time"),
            func.sum(ResourceUsage.cpu_time_seconds).label("total_cpu_time"),
            func.sum(ResourceUsage.gpu_time_seconds).label("total_gpu_time"),
        )
        .where(ResourceUsage.created_at >= cutoff)
    )
    totals_result = await db.execute(totals_query)
    totals = totals_result.one()

    return {
        "period_days": days,
        "totals": {
            "operations": totals.total_ops or 0,
            "wall_time_hours": round((totals.total_wall_time or 0) / 3600, 2),
            "cpu_time_hours": round((totals.total_cpu_time or 0) / 3600, 2),
            "gpu_time_hours": round((totals.total_gpu_time or 0) / 3600, 2),
        },
        "daily": [
            {
                "date": str(row.date),
                "operations": row.operation_count,
                "wall_time_min": round((row.total_wall_time or 0) / 60, 1),
                "cpu_time_min": round((row.total_cpu_time or 0) / 60, 1),
                "gpu_time_min": round((row.total_gpu_time or 0) / 60, 1),
                "peak_ram_mb": round(row.peak_ram or 0, 0),
                "peak_gpu_ram_mb": round(row.peak_gpu_ram or 0, 0),
            }
            for row in daily_rows
        ],
        "by_operation": [
            {
                "operation": row.operation,
                "count": row.count,
                "total_wall_time_min": round((row.total_wall_time or 0) / 60, 1),
                "total_cpu_time_min": round((row.total_cpu_time or 0) / 60, 1),
                "total_gpu_time_min": round((row.total_gpu_time or 0) / 60, 1),
                "avg_wall_time_sec": round(row.avg_wall_time or 0, 1),
                "avg_ram_mb": round(row.avg_ram or 0, 0),
            }
            for row in op_rows
        ],
    }


@router.get("/resources/projects")
async def get_project_resource_usage(
    limit: int = 50,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get per-project resource usage totals."""
    from sqlalchemy import func

    from app.models.project import BookProject
    from app.models.resource_usage import ResourceUsage

    logger.info("get_project_resource_usage: admin_id=%s, limit=%d", _admin.id, limit)

    query = (
        select(
            ResourceUsage.project_id,
            func.count().label("operation_count"),
            func.sum(ResourceUsage.wall_time_seconds).label("total_wall_time"),
            func.sum(ResourceUsage.cpu_time_seconds).label("total_cpu_time"),
            func.sum(ResourceUsage.gpu_time_seconds).label("total_gpu_time"),
            func.max(ResourceUsage.peak_ram_mb).label("peak_ram"),
            func.max(ResourceUsage.peak_gpu_ram_mb).label("peak_gpu_ram"),
        )
        .where(ResourceUsage.project_id.isnot(None))
        .group_by(ResourceUsage.project_id)
        .order_by(func.sum(ResourceUsage.wall_time_seconds).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    # Fetch project titles
    project_ids = [r.project_id for r in rows]
    projects_result = await db.execute(
        select(BookProject.id, BookProject.title, BookProject.author)
        .where(BookProject.id.in_(project_ids))
    )
    project_map = {r.id: {"title": r.title, "author": r.author} for r in projects_result.all()}

    return {
        "projects": [
            {
                "project_id": str(row.project_id),
                "title": project_map.get(row.project_id, {}).get("title", "Unknown"),
                "author": project_map.get(row.project_id, {}).get("author", ""),
                "operation_count": row.operation_count,
                "total_wall_time_min": round((row.total_wall_time or 0) / 60, 1),
                "total_cpu_time_min": round((row.total_cpu_time or 0) / 60, 1),
                "total_gpu_time_min": round((row.total_gpu_time or 0) / 60, 1),
                "peak_ram_mb": round(row.peak_ram or 0, 0),
                "peak_gpu_ram_mb": round(row.peak_gpu_ram or 0, 0),
            }
            for row in rows
        ]
    }


@router.get("/resources/estimate")
async def get_cost_estimate(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Estimate AWS costs based on recorded resource usage.

    Uses recent usage data to project monthly costs on various instance types.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func

    from app.models.resource_usage import ResourceUsage

    logger.info("get_cost_estimate: admin_id=%s", _admin.id)

    # Get last 30 days of usage
    cutoff = datetime.utcnow() - timedelta(days=30)
    result = await db.execute(
        select(
            func.count().label("total_ops"),
            func.sum(ResourceUsage.wall_time_seconds).label("total_wall"),
            func.sum(ResourceUsage.cpu_time_seconds).label("total_cpu"),
            func.sum(ResourceUsage.gpu_time_seconds).label("total_gpu"),
            func.max(ResourceUsage.peak_ram_mb).label("peak_ram"),
            func.max(ResourceUsage.peak_gpu_ram_mb).label("peak_gpu_ram"),
        )
        .where(ResourceUsage.created_at >= cutoff)
    )
    row = result.one()

    total_ops = row.total_ops or 0
    total_wall_hours = (row.total_wall or 0) / 3600
    total_cpu_hours = (row.total_cpu or 0) / 3600
    total_gpu_hours = (row.total_gpu or 0) / 3600
    peak_ram_gb = (row.peak_ram or 0) / 1024
    peak_gpu_gb = (row.peak_gpu_ram or 0) / 1024

    # AWS pricing (approximate on-demand, us-east-1, May 2026)
    # GCP pricing (approximate on-demand, us-central1, May 2026)
    # Hetzner pricing (dedicated servers, EU, May 2026)
    # All prices are rough estimates for cost modeling purposes.
    providers = {
        "aws": {
            "name": "Amazon Web Services",
            "url": "https://aws.amazon.com/ec2/pricing/",
            "instances": [
                {
                    "name": "t3.medium",
                    "description": "2 vCPU, 4 GB RAM — CPU-only, light workloads",
                    "vcpu": 2, "ram_gb": 4, "gpu": None,
                    "hourly_cost": 0.0416,
                },
                {
                    "name": "t3.large",
                    "description": "2 vCPU, 8 GB RAM — CPU-only, moderate workloads",
                    "vcpu": 2, "ram_gb": 8, "gpu": None,
                    "hourly_cost": 0.0832,
                },
                {
                    "name": "c5.xlarge",
                    "description": "4 vCPU, 8 GB RAM — compute-optimized",
                    "vcpu": 4, "ram_gb": 8, "gpu": None,
                    "hourly_cost": 0.17,
                },
                {
                    "name": "g4dn.xlarge",
                    "description": "4 vCPU, 16 GB RAM, T4 16GB GPU",
                    "vcpu": 4, "ram_gb": 16, "gpu": "T4 16GB",
                    "hourly_cost": 0.526,
                },
                {
                    "name": "g5.xlarge",
                    "description": "4 vCPU, 16 GB RAM, A10G 24GB GPU",
                    "vcpu": 4, "ram_gb": 16, "gpu": "A10G 24GB",
                    "hourly_cost": 1.006,
                },
            ],
        },
        "gcp": {
            "name": "Google Cloud Platform",
            "url": "https://cloud.google.com/compute/all-pricing",
            "instances": [
                {
                    "name": "e2-medium",
                    "description": "2 vCPU, 4 GB RAM — CPU-only, light workloads",
                    "vcpu": 2, "ram_gb": 4, "gpu": None,
                    "hourly_cost": 0.0335,
                },
                {
                    "name": "e2-standard-2",
                    "description": "2 vCPU, 8 GB RAM — CPU-only, moderate workloads",
                    "vcpu": 2, "ram_gb": 8, "gpu": None,
                    "hourly_cost": 0.067,
                },
                {
                    "name": "c2-standard-4",
                    "description": "4 vCPU, 16 GB RAM — compute-optimized",
                    "vcpu": 4, "ram_gb": 16, "gpu": None,
                    "hourly_cost": 0.209,
                },
                {
                    "name": "n1-standard-4 + T4",
                    "description": "4 vCPU, 15 GB RAM, T4 16GB GPU",
                    "vcpu": 4, "ram_gb": 15, "gpu": "T4 16GB",
                    "hourly_cost": 0.545,
                },
                {
                    "name": "g2-standard-4",
                    "description": "4 vCPU, 16 GB RAM, L4 24GB GPU",
                    "vcpu": 4, "ram_gb": 16, "gpu": "L4 24GB",
                    "hourly_cost": 0.838,
                },
            ],
        },
        "hetzner": {
            "name": "Hetzner",
            "url": "https://www.hetzner.com/cloud/",
            "instances": [
                {
                    "name": "CPX21",
                    "description": "3 vCPU, 4 GB RAM — shared CPU",
                    "vcpu": 3, "ram_gb": 4, "gpu": None,
                    "hourly_cost": 0.0083,  # ~€5.99/mo
                },
                {
                    "name": "CPX31",
                    "description": "4 vCPU, 8 GB RAM — shared CPU",
                    "vcpu": 4, "ram_gb": 8, "gpu": None,
                    "hourly_cost": 0.0153,  # ~€10.99/mo
                },
                {
                    "name": "CCX23",
                    "description": "4 vCPU, 16 GB RAM — dedicated CPU",
                    "vcpu": 4, "ram_gb": 16, "gpu": None,
                    "hourly_cost": 0.0458,  # ~€32.99/mo
                },
                {
                    "name": "GEX44 (dedicated)",
                    "description": "8 vCPU, 32 GB RAM, RTX 4000 SFF (20GB) GPU",
                    "vcpu": 8, "ram_gb": 32, "gpu": "RTX 4000 SFF 20GB",
                    "hourly_cost": 0.278,  # ~€199/mo dedicated
                },
                {
                    "name": "GEX130 (dedicated)",
                    "description": "16 vCPU, 128 GB RAM, RTX 6000 Ada (48GB) GPU",
                    "vcpu": 16, "ram_gb": 128, "gpu": "RTX 6000 Ada 48GB",
                    "hourly_cost": 0.694,  # ~€499/mo dedicated
                },
            ],
        },
    }

    # Calculate per-book average
    avg_wall_per_op = total_wall_hours / total_ops if total_ops > 0 else 0
    avg_gpu_per_op = total_gpu_hours / total_ops if total_ops > 0 else 0

    # Determine recommended instance per provider
    needs_gpu = total_gpu_hours > 0
    recommendations = {}
    for provider_key, provider_data in providers.items():
        if needs_gpu:
            # Pick cheapest GPU instance
            gpu_instances = [i for i in provider_data["instances"] if i["gpu"]]
            recommendations[provider_key] = gpu_instances[0]["name"] if gpu_instances else provider_data["instances"][-1]["name"]
        else:
            # Pick instance with enough RAM
            if peak_ram_gb > 8:
                suitable = [i for i in provider_data["instances"] if i["ram_gb"] >= 16 and not i["gpu"]]
            else:
                suitable = [i for i in provider_data["instances"] if i["ram_gb"] >= 8 and not i["gpu"]]
            if suitable:
                recommendations[provider_key] = suitable[0]["name"]
            else:
                recommendations[provider_key] = provider_data["instances"][1]["name"]

    # Cost projections per provider
    provider_projections = {}
    for provider_key, provider_data in providers.items():
        projections = []
        for inst in provider_data["instances"]:
            if needs_gpu and inst["gpu"] is None:
                monthly_note = "No GPU — not suitable for your workload"
                monthly_cost = None
            elif not needs_gpu and inst["gpu"]:
                monthly_note = "GPU not needed for your workload"
                monthly_cost = inst["hourly_cost"] * 730
            else:
                active_hours_month = total_wall_hours
                monthly_cost = inst["hourly_cost"] * active_hours_month
                monthly_note = None

            projections.append({
                "instance": inst["name"],
                "description": inst["description"],
                "hourly_cost": inst["hourly_cost"],
                "monthly_cost_on_demand": round(monthly_cost, 2) if monthly_cost is not None else None,
                "monthly_cost_always_on": round(inst["hourly_cost"] * 730, 2),
                "note": monthly_note,
            })
        provider_projections[provider_key] = {
            "name": provider_data["name"],
            "url": provider_data["url"],
            "recommended": recommendations[provider_key],
            "projections": projections,
        }

    # Per-book cost estimate per provider
    per_book_costs = {}
    if total_ops > 0:
        for provider_key, provider_data in providers.items():
            costs = []
            for inst in provider_data["instances"]:
                if needs_gpu and inst["gpu"] is None:
                    continue
                if not needs_gpu and inst["gpu"]:
                    continue
                cost_per_book = inst["hourly_cost"] * avg_wall_per_op
                costs.append({
                    "instance": inst["name"],
                    "cost_per_book": round(cost_per_book, 4),
                })
            per_book_costs[provider_key] = costs

    return {
        "period_days": 30,
        "usage_summary": {
            "total_operations": total_ops,
            "total_wall_hours": round(total_wall_hours, 2),
            "total_cpu_hours": round(total_cpu_hours, 2),
            "total_gpu_hours": round(total_gpu_hours, 2),
            "peak_ram_gb": round(peak_ram_gb, 1),
            "peak_gpu_ram_gb": round(peak_gpu_gb, 1),
            "avg_wall_time_per_op_min": round(avg_wall_per_op * 60, 1),
            "needs_gpu": needs_gpu,
        },
        "providers": provider_projections,
        "per_book_estimate": per_book_costs,
    }


# --- Profanity Filter Word List Endpoints ---


class ProfanityWordListResponse(BaseModel):
    word_list: str
    word_count: int


class ProfanityWordListUpdate(BaseModel):
    word_list: str


@router.get("/profanity-word-list", response_model=ProfanityWordListResponse)
async def get_profanity_word_list(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get the system-wide profanity word list. Returns the default if none has been saved."""
    logger.info("get_profanity_word_list: admin_id=%s", _admin.id)

    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None or settings.profanity_word_list is None:
        # Return the default shipped word list
        from app.services.profanity_filter.filter import load_default_word_list
        word_list = load_default_word_list()
        logger.info("get_profanity_word_list: returning default word list")
    else:
        word_list = settings.profanity_word_list
        logger.info("get_profanity_word_list: returning custom word list")

    word_count = len([w for w in word_list.splitlines() if w.strip()])
    return ProfanityWordListResponse(word_list=word_list, word_count=word_count)


@router.put("/profanity-word-list", response_model=ProfanityWordListResponse)
async def update_profanity_word_list(
    body: ProfanityWordListUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update the system-wide profanity word list."""
    logger.info("update_profanity_word_list: admin_id=%s", _admin.id)

    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = SystemSettings()
        db.add(settings)

    settings.profanity_word_list = body.word_list
    await db.commit()
    await db.refresh(settings)

    word_count = len([w for w in body.word_list.splitlines() if w.strip()])
    logger.info("update_profanity_word_list: saved %d words", word_count)
    return ProfanityWordListResponse(word_list=settings.profanity_word_list, word_count=word_count)


@router.post("/profanity-word-list/reset", response_model=ProfanityWordListResponse)
async def reset_profanity_word_list(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset the profanity word list to the shipped default."""
    logger.info("reset_profanity_word_list: admin_id=%s", _admin.id)

    from app.services.profanity_filter.filter import load_default_word_list
    default_list = load_default_word_list()

    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = SystemSettings()
        db.add(settings)

    settings.profanity_word_list = default_list
    await db.commit()
    await db.refresh(settings)

    word_count = len([w for w in default_list.splitlines() if w.strip()])
    logger.info("reset_profanity_word_list: reset to default, %d words", word_count)
    return ProfanityWordListResponse(word_list=settings.profanity_word_list, word_count=word_count)
