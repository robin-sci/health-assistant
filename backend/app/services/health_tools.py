"""Ollama tool definitions and executor for health data queries.

Provides:
- HEALTH_TOOL_DEFINITIONS: List of tool schemas in Ollama format
- execute_health_tool(): Dispatcher that routes tool calls to service functions
"""

import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.health_tools_service import (
    correlate_metrics,
    get_daily_summary,
    get_lab_trend,
    get_recent_labs,
    get_symptom_timeline,
    get_wearable_summary,
)

logger = logging.getLogger(__name__)


# Tool definitions in Ollama format (compatible with OpenAI function calling schema)
HEALTH_TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_recent_labs",
            "description": (
                "Get recent lab test results for the user. Returns blood work, hormone levels, "
                "and other medical test results with values, units, and reference ranges. "
                "Use this when the user asks about their lab results, blood tests, or specific medical markers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Default 90.",
                    },
                    "test_name": {
                        "type": "string",
                        "description": (
                            "Optional: filter by test name (partial match, case-insensitive). "
                            "Examples: 'HbA1c', 'cholesterol', 'vitamin D', 'iron', 'TSH'."
                        ),
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lab_trend",
            "description": (
                "Get the historical trend for a specific lab test over time. Shows how a test value "
                "has changed across multiple measurements. Useful for tracking progress or identifying "
                "trends in markers like HbA1c, cholesterol, vitamin D, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "test_name": {
                        "type": "string",
                        "description": (
                            "The lab test name to track (partial match). "
                            "Examples: 'HbA1c', 'LDL', 'Vitamin D', 'Ferritin'."
                        ),
                    },
                    "months": {
                        "type": "integer",
                        "description": "Number of months to look back. Default 12.",
                    },
                },
                "required": ["test_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_symptom_timeline",
            "description": (
                "Get symptom entries logged by the user over a time period. Shows when symptoms occurred, "
                "their severity (0-10), duration, triggers, and notes. "
                "Use when the user asks about their symptoms, headaches, migraines, pain, mood, energy, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symptom_type": {
                        "type": "string",
                        "description": (
                            "Optional: filter by symptom type (exact match). "
                            "Common types: 'migraine', 'headache', 'back_pain', 'fatigue', "
                            "'insomnia', 'nausea', 'joint_pain', 'anxiety', 'brain_fog'. "
                            "Omit to get all symptom types."
                        ),
                    },
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Default 30.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_wearable_summary",
            "description": (
                "Get wearable device data for a specific health metric. Returns daily aggregated values "
                "with statistics. Use for questions about heart rate, steps, sleep, workouts, HRV, weight, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "description": (
                            "The metric to retrieve. Options: "
                            "'heart_rate' (avg/min/max bpm), "
                            "'steps' (daily step count), "
                            "'sleep' (sleep duration and timing), "
                            "'workouts' (exercise sessions), "
                            "'resting_heart_rate' (daily resting HR), "
                            "'heart_rate_variability_sdnn' (HRV), "
                            "'weight' (body weight), "
                            "'active_energy_burned' (calories), "
                            "'blood_oxygen_saturation' (SpO2), "
                            "'distance_walking_running' (distance in meters)."
                        ),
                    },
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Default 30.",
                    },
                },
                "required": ["metric"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_summary",
            "description": (
                "Get a combined summary of ALL health data for a specific date. Includes wearable metrics, "
                "lab results, symptoms, sleep, and workouts for that day. "
                "Use when the user asks about a specific day or wants an overview."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format. Example: '2026-02-20'.",
                    },
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "correlate_metrics",
            "description": (
                "Find correlations between two health metrics over time. Calculates Pearson correlation "
                "coefficient and provides interpretation. Useful for finding patterns like "
                "'does poor sleep correlate with more headaches?' or 'does exercise affect my HRV?'. "
                "Prefix symptom types with 'symptom:' (e.g., 'symptom:migraine') and lab tests with "
                "'lab:' (e.g., 'lab:HbA1c'). Wearable metrics use their code directly (e.g., 'heart_rate')."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_a": {
                        "type": "string",
                        "description": (
                            "First metric. Examples: 'heart_rate', 'steps', 'symptom:migraine', "
                            "'symptom:energy', 'lab:HbA1c'."
                        ),
                    },
                    "metric_b": {
                        "type": "string",
                        "description": "Second metric. Same format as metric_a.",
                    },
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back. Default 90.",
                    },
                },
                "required": ["metric_a", "metric_b"],
            },
        },
    },
]


async def execute_health_tool(
    tool_name: str,
    arguments: dict[str, Any],
    db: Session,
    user_id: UUID,
) -> str:
    """Execute a health tool call and return the result as a JSON string.

    This is the tool_executor function passed to OllamaService.chat_with_tools().

    Args:
        tool_name: Name of the tool to execute.
        arguments: Tool arguments from the LLM.
        db: Database session.
        user_id: The user whose data to query.

    Returns:
        JSON string with the tool result.
    """
    logger.info(f"Executing health tool: {tool_name} with args: {arguments}")

    try:
        result: dict[str, Any]

        if tool_name == "get_recent_labs":
            result = get_recent_labs(
                db=db,
                user_id=user_id,
                days=arguments.get("days", 90),
                test_name=arguments.get("test_name"),
            )

        elif tool_name == "get_lab_trend":
            result = get_lab_trend(
                db=db,
                user_id=user_id,
                test_name=arguments["test_name"],
                months=arguments.get("months", 12),
            )

        elif tool_name == "get_symptom_timeline":
            result = get_symptom_timeline(
                db=db,
                user_id=user_id,
                symptom_type=arguments.get("symptom_type"),
                days=arguments.get("days", 30),
            )

        elif tool_name == "get_wearable_summary":
            result = get_wearable_summary(
                db=db,
                user_id=user_id,
                metric=arguments["metric"],
                days=arguments.get("days", 30),
            )

        elif tool_name == "get_daily_summary":
            result = get_daily_summary(
                db=db,
                user_id=user_id,
                target_date=arguments["date"],
            )

        elif tool_name == "correlate_metrics":
            result = correlate_metrics(
                db=db,
                user_id=user_id,
                metric_a=arguments["metric_a"],
                metric_b=arguments["metric_b"],
                days=arguments.get("days", 90),
            )

        else:
            result = {"error": f"Unknown tool: {tool_name}"}

        return json.dumps(result, default=str)

    except Exception as e:
        logger.exception(f"Health tool execution failed: {tool_name}")
        return json.dumps({"error": f"Tool execution failed: {e}"})
