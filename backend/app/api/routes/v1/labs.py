"""Lab results API routes."""

from uuid import UUID

from fastapi import APIRouter

from app.database import DbSession
from app.repositories.lab_result_repository import LabResultRepository
from app.schemas.lab_result import LabResultRead, LabTrendPoint, LabTrendResponse
from app.services import ApiKeyDep

router = APIRouter()
lab_result_repo = LabResultRepository()


@router.get("/labs", response_model=list[LabResultRead])
async def list_labs(
    user_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
    days: int = 90,
    test_name: str | None = None,
):
    """Get recent lab results for a user.

    Query params:
    - user_id: UUID of the user (required)
    - days: Number of days to look back (default 90)
    - test_name: Optional filter by test name (partial match, case-insensitive)
    """
    return lab_result_repo.get_by_user(db, user_id=user_id, days=days, test_name=test_name)


@router.get("/labs/trends/{test_name}", response_model=LabTrendResponse)
async def get_lab_trend(
    test_name: str,
    user_id: UUID,
    db: DbSession,
    _api_key: ApiKeyDep,
    months: int = 12,
):
    """Get trend data for a specific lab test.

    Path params:
    - test_name: Lab test name to search (partial match, case-insensitive)

    Query params:
    - user_id: UUID of the user (required)
    - months: Number of months to look back (default 12)
    """
    results = lab_result_repo.get_trend(db, user_id=user_id, test_name=test_name, months=months)

    if not results:
        return LabTrendResponse(
            test_name=test_name,
            unit="",
            period_months=months,
            count=0,
            data_points=[],
        )

    actual_name = results[0].test_name
    unit = results[0].unit
    ref_min = float(results[0].reference_min) if results[0].reference_min is not None else None
    ref_max = float(results[0].reference_max) if results[0].reference_max is not None else None

    data_points = [
        LabTrendPoint(
            date=result.recorded_at,
            value=float(result.value),
            status=result.status,
        )
        for result in results
    ]

    values = [float(result.value) for result in results if result.value is not None]
    stats = None
    if values:
        stats = {
            "min": min(values),
            "max": max(values),
            "avg": round(sum(values) / len(values), 2),
            "latest": values[-1],
            "trend": (
                "increasing"
                if len(values) >= 2 and values[-1] > values[0]
                else "decreasing"
                if len(values) >= 2 and values[-1] < values[0]
                else "stable"
            ),
        }

    return LabTrendResponse(
        test_name=actual_name,
        unit=unit,
        reference_min=ref_min,
        reference_max=ref_max,
        period_months=months,
        count=len(data_points),
        data_points=data_points,
        statistics=stats,
    )
