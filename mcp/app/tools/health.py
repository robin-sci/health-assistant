"""MCP tools for querying health assistant data (labs, symptoms)."""

import logging

from fastmcp import FastMCP

from app.services.api_client import client

logger = logging.getLogger(__name__)

# Create router for health assistant tools
health_router = FastMCP(name="Health Tools")


@health_router.tool
async def get_lab_results(
    user_id: str,
    days: int = 90,
    test_name: str | None = None,
) -> dict:
    """
    Get recent lab test results for a user.

    Returns blood work, hormone levels, and other medical test results with values,
    units, and reference ranges. Use this when the user asks about their lab results,
    blood tests, or specific medical markers.

    Args:
        user_id: UUID of the user. Use get_users to discover available users.
        days: Number of days to look back. Default 90.
             Use 365 for "last year", 180 for "last 6 months".
        test_name: Optional filter by test name (partial match, case-insensitive).
                   Examples: "HbA1c", "cholesterol", "vitamin D", "iron", "TSH".

    Returns:
        A list of lab result records, each containing:
        - test_name: Name of the lab test
        - value: Measured value
        - unit: Unit of measurement
        - reference_min/reference_max: Normal reference range
        - status: "normal", "high", "low", or "critical"
        - recorded_at: Date the test was taken (YYYY-MM-DD)

    Example response:
        [
            {
                "id": "uuid-1",
                "test_name": "HbA1c",
                "value": 5.4,
                "unit": "%",
                "reference_min": 4.0,
                "reference_max": 5.6,
                "status": "normal",
                "recorded_at": "2026-01-15"
            }
        ]

    Notes for LLMs:
        - Call get_users first to get the user_id.
        - Use test_name filter to narrow results (e.g., "cholesterol" matches
          "Total Cholesterol", "LDL Cholesterol", "HDL Cholesterol").
        - Values outside reference_min/reference_max are flagged in the status field.
        - For tracking changes over time, use get_lab_trends instead.
    """
    try:
        try:
            user_data = await client.get_user(user_id)
            user = {
                "id": str(user_data.get("id")),
                "first_name": user_data.get("first_name"),
                "last_name": user_data.get("last_name"),
            }
        except ValueError as e:
            return {"error": f"User not found: {user_id}", "details": str(e)}

        results = await client.get_lab_results(
            user_id=user_id,
            days=days,
            test_name=test_name,
        )

        return {
            "user": user,
            "period_days": days,
            "filter": test_name,
            "count": len(results),
            "results": results,
        }

    except ValueError as e:
        logger.error(f"API error in get_lab_results: {e}")
        return {"error": str(e)}
    except Exception as e:
        logger.exception(f"Unexpected error in get_lab_results: {e}")
        return {"error": f"Failed to fetch lab results: {e}"}


@health_router.tool
async def get_lab_trends(
    user_id: str,
    test_name: str,
    months: int = 12,
) -> dict:
    """
    Get the historical trend for a specific lab test over time.

    Shows how a test value has changed across multiple measurements. Useful for
    tracking progress or identifying trends in markers like HbA1c, cholesterol,
    vitamin D, etc.

    Args:
        user_id: UUID of the user. Use get_users to discover available users.
        test_name: The lab test name to track (partial match, case-insensitive).
                   Examples: "HbA1c", "LDL", "Vitamin D", "Ferritin", "TSH".
        months: Number of months to look back. Default 12.

    Returns:
        A dictionary containing:
        - test_name: Actual matched test name
        - unit: Unit of measurement
        - reference_min/reference_max: Normal reference range
        - data_points: List of {date, value, status} sorted chronologically
        - statistics: {min, max, avg, latest, trend} where trend is
          "increasing", "decreasing", or "stable"

    Example response:
        {
            "test_name": "HbA1c",
            "unit": "%",
            "reference_min": 4.0,
            "reference_max": 5.6,
            "count": 4,
            "data_points": [
                {"date": "2025-06-01", "value": 5.8, "status": "high"},
                {"date": "2025-09-01", "value": 5.5, "status": "normal"},
                {"date": "2025-12-01", "value": 5.3, "status": "normal"},
                {"date": "2026-02-01", "value": 5.1, "status": "normal"}
            ],
            "statistics": {"min": 5.1, "max": 5.8, "avg": 5.43, "latest": 5.1, "trend": "decreasing"}
        }

    Notes for LLMs:
        - This is the best tool for "how has my X changed over time?" questions.
        - The trend field in statistics gives a quick summary of the direction.
        - Compare values against reference_min/reference_max to assess if they're normal.
        - If count is 0, the test name may not exist — suggest checking with get_lab_results.
    """
    try:
        try:
            user_data = await client.get_user(user_id)
            user = {
                "id": str(user_data.get("id")),
                "first_name": user_data.get("first_name"),
                "last_name": user_data.get("last_name"),
            }
        except ValueError as e:
            return {"error": f"User not found: {user_id}", "details": str(e)}

        trend_data = await client.get_lab_trends(
            user_id=user_id,
            test_name=test_name,
            months=months,
        )

        return {
            "user": user,
            **trend_data,
        }

    except ValueError as e:
        logger.error(f"API error in get_lab_trends: {e}")
        return {"error": str(e)}
    except Exception as e:
        logger.exception(f"Unexpected error in get_lab_trends: {e}")
        return {"error": f"Failed to fetch lab trends: {e}"}


@health_router.tool
async def get_symptom_history(
    user_id: str,
    days: int = 30,
    symptom_type: str | None = None,
) -> dict:
    """
    Get symptom entries logged by the user over a time period.

    Shows when symptoms occurred, their severity (0-10 scale), duration, triggers,
    and notes. Use when the user asks about their symptoms, headaches, migraines,
    pain, mood, energy levels, etc.

    Args:
        user_id: UUID of the user. Use get_users to discover available users.
        days: Number of days to look back. Default 30.
        symptom_type: Optional filter by symptom type (exact match).
                      Common types: "migraine", "headache", "back_pain", "fatigue",
                      "insomnia", "nausea", "joint_pain", "anxiety", "brain_fog",
                      "mood_low", "energy_high".
                      Omit to get all symptom types.

    Returns:
        A dictionary containing:
        - user: User information
        - period_days: Number of days queried
        - count: Total number of symptom entries
        - entries: List of symptom records with type, severity, notes, triggers
        - types_found: Distinct symptom types in the results

    Example response:
        {
            "user": {"id": "uuid-1", "first_name": "John", "last_name": "Doe"},
            "period_days": 30,
            "count": 8,
            "entries": [
                {
                    "symptom_type": "migraine",
                    "severity": 7,
                    "recorded_at": "2026-02-20T14:30:00Z",
                    "duration_minutes": 180,
                    "triggers": ["stress", "poor sleep"],
                    "notes": "Started after lunch"
                }
            ],
            "types_found": ["migraine", "headache", "fatigue"]
        }

    Notes for LLMs:
        - Severity scale: 0 = none, 1-3 = mild, 4-6 = moderate, 7-9 = severe, 10 = worst possible.
        - To see what symptom types exist, call without symptom_type filter.
        - Duration is in minutes (e.g., 180 = 3 hours).
        - Triggers are user-reported potential causes.
        - For correlating symptoms with other metrics, use the backend's correlate_metrics tool.
    """
    try:
        try:
            user_data = await client.get_user(user_id)
            user = {
                "id": str(user_data.get("id")),
                "first_name": user_data.get("first_name"),
                "last_name": user_data.get("last_name"),
            }
        except ValueError as e:
            return {"error": f"User not found: {user_id}", "details": str(e)}

        entries = await client.get_symptoms(
            user_id=user_id,
            days=days,
            symptom_type=symptom_type,
        )

        # Extract distinct types from results
        types_found = sorted({e.get("symptom_type") for e in entries if e.get("symptom_type")})

        return {
            "user": user,
            "period_days": days,
            "filter": symptom_type,
            "count": len(entries),
            "entries": entries,
            "types_found": types_found,
        }

    except ValueError as e:
        logger.error(f"API error in get_symptom_history: {e}")
        return {"error": str(e)}
    except Exception as e:
        logger.exception(f"Unexpected error in get_symptom_history: {e}")
        return {"error": f"Failed to fetch symptom history: {e}"}
