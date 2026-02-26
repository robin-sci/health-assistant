"""Health data query functions for AI tool-calling.

These functions query the database for lab results, symptoms, and wearable data.
They are used both by the Ollama tool executor (chat API) and by REST API endpoints.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.data_point_series import DataPointSeries
from app.models.event_record import EventRecord
from app.models.lab_result import LabResult
from app.models.series_type_definition import SeriesTypeDefinition
from app.models.symptom_entry import SymptomEntry

logger = logging.getLogger(__name__)


def _to_float(val: Decimal | float | None) -> float | None:
    """Convert Decimal to float for JSON serialization."""
    if val is None:
        return None
    return float(val)


def _get_data_source_for_user(db: Session, user_id: UUID) -> list[UUID]:
    """Get all data_source_ids for a user (via data_source.user_id)."""
    from app.models.data_source import DataSource

    return [row[0] for row in db.query(DataSource.id).filter(DataSource.user_id == user_id).all()]


def get_recent_labs(
    db: Session,
    user_id: UUID,
    days: int = 90,
    test_name: str | None = None,
    limit: int = 50,
) -> dict:
    """Get recent lab results for a user.

    Args:
        db: Database session.
        user_id: User UUID.
        days: Number of days to look back (default 90).
        test_name: Optional filter by test name (case-insensitive partial match).
        limit: Maximum number of results to return.

    Returns:
        Dict with lab results grouped by date, including reference ranges.
    """
    cutoff = date.today() - timedelta(days=days)

    query = (
        db.query(LabResult)
        .filter(
            LabResult.user_id == user_id,
            LabResult.recorded_at >= cutoff,
        )
        .order_by(LabResult.recorded_at.desc(), LabResult.test_name)
    )

    if test_name:
        query = query.filter(LabResult.test_name.ilike(f"%{test_name}%"))

    results = query.limit(limit).all()

    records = []
    for r in results:
        record = {
            "test_name": r.test_name,
            "value": _to_float(r.value),
            "unit": r.unit,
            "recorded_at": r.recorded_at.isoformat(),
            "status": r.status,
            "reference_min": _to_float(r.reference_min),
            "reference_max": _to_float(r.reference_max),
        }
        if r.test_code:
            record["test_code"] = r.test_code
        records.append(record)

    return {
        "user_id": str(user_id),
        "period_days": days,
        "count": len(records),
        "results": records,
    }


def get_lab_trend(
    db: Session,
    user_id: UUID,
    test_name: str,
    months: int = 12,
) -> dict:
    """Get time series trend for a specific lab test.

    Args:
        db: Database session.
        user_id: User UUID.
        test_name: Exact or partial test name to match.
        months: Number of months to look back (default 12).

    Returns:
        Dict with data points sorted chronologically, including reference ranges.
    """
    cutoff = date.today() - timedelta(days=months * 30)

    results = (
        db.query(LabResult)
        .filter(
            LabResult.user_id == user_id,
            LabResult.test_name.ilike(f"%{test_name}%"),
            LabResult.recorded_at >= cutoff,
        )
        .order_by(LabResult.recorded_at.asc())
        .all()
    )

    if not results:
        return {
            "user_id": str(user_id),
            "test_name": test_name,
            "period_months": months,
            "count": 0,
            "data_points": [],
            "message": f"No results found for '{test_name}' in the last {months} months.",
        }

    # Use the first result's reference range as the baseline
    ref_min = _to_float(results[0].reference_min)
    ref_max = _to_float(results[0].reference_max)
    unit = results[0].unit
    actual_test_name = results[0].test_name

    data_points = []
    for r in results:
        data_points.append(
            {
                "date": r.recorded_at.isoformat(),
                "value": _to_float(r.value),
                "status": r.status,
            }
        )

    # Calculate basic statistics
    values = [_to_float(r.value) for r in results if r.value is not None]
    stats = {}
    if values:
        stats = {
            "min": min(values),
            "max": max(values),
            "avg": round(sum(values) / len(values), 2),
            "latest": values[-1],
            "trend": "increasing"
            if len(values) >= 2 and values[-1] > values[0]
            else "decreasing"
            if len(values) >= 2 and values[-1] < values[0]
            else "stable",
        }

    return {
        "user_id": str(user_id),
        "test_name": actual_test_name,
        "unit": unit,
        "period_months": months,
        "count": len(data_points),
        "reference_range": {"min": ref_min, "max": ref_max},
        "data_points": data_points,
        "statistics": stats,
    }


def get_symptom_timeline(
    db: Session,
    user_id: UUID,
    symptom_type: str | None = None,
    days: int = 30,
    limit: int = 100,
) -> dict:
    """Get symptom entries over a time period.

    Args:
        db: Database session.
        user_id: User UUID.
        symptom_type: Optional filter by symptom type (exact match).
        days: Number of days to look back (default 30).
        limit: Maximum number of entries.

    Returns:
        Dict with symptom entries and frequency statistics.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        db.query(SymptomEntry)
        .filter(
            SymptomEntry.user_id == user_id,
            SymptomEntry.recorded_at >= cutoff,
        )
        .order_by(SymptomEntry.recorded_at.desc())
    )

    if symptom_type:
        query = query.filter(SymptomEntry.symptom_type == symptom_type)

    results = query.limit(limit).all()

    entries = []
    for s in results:
        entry = {
            "symptom_type": s.symptom_type,
            "severity": s.severity,
            "recorded_at": s.recorded_at.isoformat(),
        }
        if s.notes:
            entry["notes"] = s.notes
        if s.triggers:
            entry["triggers"] = s.triggers
        if s.duration_minutes:
            entry["duration_minutes"] = s.duration_minutes
        entries.append(entry)

    # Frequency statistics per symptom type
    type_counts: dict[str, list[int]] = {}
    for s in results:
        if s.symptom_type not in type_counts:
            type_counts[s.symptom_type] = []
        type_counts[s.symptom_type].append(s.severity)

    frequency = {}
    for stype, severities in type_counts.items():
        frequency[stype] = {
            "count": len(severities),
            "avg_severity": round(sum(severities) / len(severities), 1),
            "max_severity": max(severities),
        }

    return {
        "user_id": str(user_id),
        "period_days": days,
        "count": len(entries),
        "entries": entries,
        "frequency": frequency,
    }


def get_wearable_summary(
    db: Session,
    user_id: UUID,
    metric: str,
    days: int = 30,
) -> dict:
    """Get wearable metric summary over a time period.

    Queries the DataPointSeries table for time-series data (heart rate, steps, etc.)
    and EventRecord for sleep/workout events.

    Args:
        db: Database session.
        user_id: User UUID.
        metric: Metric type code (e.g., 'heart_rate', 'steps', 'sleep', 'workouts').
        days: Number of days to look back (default 30).

    Returns:
        Dict with daily aggregated values and statistics.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    data_source_ids = _get_data_source_for_user(db, user_id)

    if not data_source_ids:
        return {
            "user_id": str(user_id),
            "metric": metric,
            "period_days": days,
            "count": 0,
            "daily_values": [],
            "message": "No connected data sources found for this user.",
        }

    # Handle event-based metrics (sleep, workouts)
    if metric == "sleep":
        return _get_sleep_summary(db, data_source_ids, user_id, cutoff, days)
    if metric in ("workouts", "workout"):
        return _get_workout_summary(db, data_source_ids, user_id, cutoff, days)

    # Handle time-series metrics
    series_type = db.query(SeriesTypeDefinition).filter(SeriesTypeDefinition.code == metric).one_or_none()

    if not series_type:
        # Try common aliases
        aliases = {
            "hr": "heart_rate",
            "heart_rate": "heart_rate",
            "hrv": "heart_rate_variability_sdnn",
            "steps": "steps",
            "resting_hr": "resting_heart_rate",
            "spo2": "blood_oxygen_saturation",
            "weight": "weight",
            "energy": "active_energy_burned",
            "distance": "distance_walking_running",
        }
        resolved = aliases.get(metric)
        if resolved:
            series_type = db.query(SeriesTypeDefinition).filter(SeriesTypeDefinition.code == resolved).one_or_none()

    if not series_type:
        available = [row[0] for row in db.query(SeriesTypeDefinition.code).order_by(SeriesTypeDefinition.code).all()]
        return {
            "user_id": str(user_id),
            "metric": metric,
            "error": f"Unknown metric '{metric}'.",
            "available_metrics": available[:30],
        }

    # Query daily aggregates
    daily = (
        db.query(
            func.date(DataPointSeries.recorded_at).label("day"),
            func.avg(DataPointSeries.value).label("avg_val"),
            func.min(DataPointSeries.value).label("min_val"),
            func.max(DataPointSeries.value).label("max_val"),
            func.count(DataPointSeries.value).label("count"),
        )
        .filter(
            DataPointSeries.data_source_id.in_(data_source_ids),
            DataPointSeries.series_type_definition_id == series_type.id,
            DataPointSeries.recorded_at >= cutoff,
        )
        .group_by(func.date(DataPointSeries.recorded_at))
        .order_by(func.date(DataPointSeries.recorded_at).desc())
        .all()
    )

    daily_values = []
    all_avgs = []
    for row in daily:
        avg_v = _to_float(row.avg_val)
        daily_values.append(
            {
                "date": row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day),
                "avg": round(avg_v, 1) if avg_v else None,
                "min": _to_float(row.min_val),
                "max": _to_float(row.max_val),
                "data_points": row.count,
            }
        )
        if avg_v:
            all_avgs.append(avg_v)

    stats = {}
    if all_avgs:
        stats = {
            "overall_avg": round(sum(all_avgs) / len(all_avgs), 1),
            "overall_min": round(min(all_avgs), 1),
            "overall_max": round(max(all_avgs), 1),
            "days_with_data": len(all_avgs),
        }

    return {
        "user_id": str(user_id),
        "metric": series_type.code,
        "unit": series_type.unit,
        "period_days": days,
        "count": len(daily_values),
        "daily_values": daily_values,
        "statistics": stats,
    }


def _get_sleep_summary(
    db: Session,
    data_source_ids: list[UUID],
    user_id: UUID,
    cutoff: datetime,
    days: int,
) -> dict:
    """Get sleep event summary."""
    events = (
        db.query(EventRecord)
        .filter(
            EventRecord.data_source_id.in_(data_source_ids),
            EventRecord.category == "sleep",
            EventRecord.start_datetime >= cutoff,
        )
        .order_by(EventRecord.start_datetime.desc())
        .all()
    )

    records = []
    durations = []
    for e in events:
        dur = e.duration_seconds // 60 if e.duration_seconds else None
        records.append(
            {
                "date": e.start_datetime.date().isoformat(),
                "start": e.start_datetime.isoformat(),
                "end": e.end_datetime.isoformat(),
                "duration_minutes": dur,
                "source": e.source_name,
            }
        )
        if dur:
            durations.append(dur)

    stats = {}
    if durations:
        stats = {
            "avg_duration_minutes": round(sum(durations) / len(durations)),
            "min_duration_minutes": min(durations),
            "max_duration_minutes": max(durations),
            "nights_tracked": len(durations),
        }

    return {
        "user_id": str(user_id),
        "metric": "sleep",
        "period_days": days,
        "count": len(records),
        "records": records,
        "statistics": stats,
    }


def _get_workout_summary(
    db: Session,
    data_source_ids: list[UUID],
    user_id: UUID,
    cutoff: datetime,
    days: int,
) -> dict:
    """Get workout event summary."""
    events = (
        db.query(EventRecord)
        .filter(
            EventRecord.data_source_id.in_(data_source_ids),
            EventRecord.category == "workout",
            EventRecord.start_datetime >= cutoff,
        )
        .order_by(EventRecord.start_datetime.desc())
        .all()
    )

    records = []
    total_duration = 0
    type_counts: dict[str, int] = {}
    for e in events:
        dur = e.duration_seconds // 60 if e.duration_seconds else None
        workout_type = e.type or "unknown"
        type_counts[workout_type] = type_counts.get(workout_type, 0) + 1
        records.append(
            {
                "date": e.start_datetime.date().isoformat(),
                "type": workout_type,
                "duration_minutes": dur,
                "start": e.start_datetime.isoformat(),
                "end": e.end_datetime.isoformat(),
                "source": e.source_name,
            }
        )
        if dur:
            total_duration += dur

    return {
        "user_id": str(user_id),
        "metric": "workouts",
        "period_days": days,
        "count": len(records),
        "records": records,
        "statistics": {
            "total_workouts": len(records),
            "total_duration_minutes": total_duration,
            "by_type": type_counts,
        },
    }


def get_daily_summary(
    db: Session,
    user_id: UUID,
    target_date: str,
) -> dict:
    """Get a combined daily summary from all data sources for a specific date.

    Args:
        db: Database session.
        user_id: User UUID.
        target_date: Date string in YYYY-MM-DD format.

    Returns:
        Dict with combined data from wearables, labs, and symptoms for that day.
    """
    try:
        dt = date.fromisoformat(target_date)
    except ValueError:
        return {"error": f"Invalid date format: {target_date}. Use YYYY-MM-DD."}

    day_start = datetime.combine(dt, datetime.min.time()).replace(tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    data_source_ids = _get_data_source_for_user(db, user_id)

    summary: dict = {
        "user_id": str(user_id),
        "date": target_date,
    }

    # Lab results for this date
    labs = (
        db.query(LabResult)
        .filter(
            LabResult.user_id == user_id,
            LabResult.recorded_at == dt,
        )
        .all()
    )
    if labs:
        summary["lab_results"] = [
            {
                "test_name": r.test_name,
                "value": _to_float(r.value),
                "unit": r.unit,
                "status": r.status,
            }
            for r in labs
        ]

    # Symptoms for this date
    symptoms = (
        db.query(SymptomEntry)
        .filter(
            SymptomEntry.user_id == user_id,
            SymptomEntry.recorded_at >= day_start,
            SymptomEntry.recorded_at < day_end,
        )
        .all()
    )
    if symptoms:
        summary["symptoms"] = [
            {
                "type": s.symptom_type,
                "severity": s.severity,
                "notes": s.notes,
            }
            for s in symptoms
        ]

    # Wearable data (if data sources exist)
    if data_source_ids:
        # Sleep events ending on this date
        sleep = (
            db.query(EventRecord)
            .filter(
                EventRecord.data_source_id.in_(data_source_ids),
                EventRecord.category == "sleep",
                EventRecord.end_datetime >= day_start,
                EventRecord.end_datetime < day_end,
            )
            .all()
        )
        if sleep:
            summary["sleep"] = [
                {
                    "duration_minutes": e.duration_seconds // 60 if e.duration_seconds else None,
                    "start": e.start_datetime.isoformat(),
                    "end": e.end_datetime.isoformat(),
                }
                for e in sleep
            ]

        # Workouts on this date
        workouts = (
            db.query(EventRecord)
            .filter(
                EventRecord.data_source_id.in_(data_source_ids),
                EventRecord.category == "workout",
                EventRecord.start_datetime >= day_start,
                EventRecord.start_datetime < day_end,
            )
            .all()
        )
        if workouts:
            summary["workouts"] = [
                {
                    "type": e.type or "unknown",
                    "duration_minutes": e.duration_seconds // 60 if e.duration_seconds else None,
                    "start": e.start_datetime.isoformat(),
                }
                for e in workouts
            ]

        # Key time-series aggregates for the day
        key_metrics = ["heart_rate", "steps", "active_energy_burned"]
        series_types = db.query(SeriesTypeDefinition).filter(SeriesTypeDefinition.code.in_(key_metrics)).all()

        metrics = {}
        for st in series_types:
            row = (
                db.query(
                    func.avg(DataPointSeries.value).label("avg"),
                    func.min(DataPointSeries.value).label("min"),
                    func.max(DataPointSeries.value).label("max"),
                    func.sum(DataPointSeries.value).label("sum"),
                    func.count(DataPointSeries.value).label("count"),
                )
                .filter(
                    DataPointSeries.data_source_id.in_(data_source_ids),
                    DataPointSeries.series_type_definition_id == st.id,
                    DataPointSeries.recorded_at >= day_start,
                    DataPointSeries.recorded_at < day_end,
                )
                .one()
            )

            if row.count > 0:
                metric_data: dict = {"unit": st.unit, "data_points": row.count}
                if st.code in ("steps", "active_energy_burned"):
                    metric_data["total"] = _to_float(row.sum)
                else:
                    metric_data["avg"] = round(_to_float(row.avg) or 0, 1)
                    metric_data["min"] = _to_float(row.min)
                    metric_data["max"] = _to_float(row.max)
                metrics[st.code] = metric_data

        if metrics:
            summary["wearable_metrics"] = metrics

    return summary


def correlate_metrics(
    db: Session,
    user_id: UUID,
    metric_a: str,
    metric_b: str,
    days: int = 90,
) -> dict:
    """Find basic correlation between two metrics over a time period.

    Supports comparing any combination of:
    - Wearable metrics (by series type code, e.g., 'heart_rate', 'steps')
    - Symptom types (prefixed with 'symptom:', e.g., 'symptom:migraine')
    - Lab tests (prefixed with 'lab:', e.g., 'lab:HbA1c')

    Args:
        db: Database session.
        user_id: User UUID.
        metric_a: First metric identifier.
        metric_b: Second metric identifier.
        days: Number of days to look back.

    Returns:
        Dict with daily values for both metrics and basic correlation info.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_date = date.today() - timedelta(days=days)

    values_a = _get_metric_daily_values(db, user_id, metric_a, cutoff, cutoff_date)
    values_b = _get_metric_daily_values(db, user_id, metric_b, cutoff, cutoff_date)

    if not values_a or not values_b:
        return {
            "user_id": str(user_id),
            "metric_a": metric_a,
            "metric_b": metric_b,
            "period_days": days,
            "error": "Insufficient data for one or both metrics.",
            "data_a_count": len(values_a),
            "data_b_count": len(values_b),
        }

    # Find overlapping dates
    common_dates = sorted(set(values_a.keys()) & set(values_b.keys()))

    if len(common_dates) < 3:
        return {
            "user_id": str(user_id),
            "metric_a": metric_a,
            "metric_b": metric_b,
            "period_days": days,
            "overlapping_days": len(common_dates),
            "message": "Not enough overlapping data points for meaningful correlation (need at least 3).",
        }

    paired_data = []
    a_vals = []
    b_vals = []
    for d in common_dates:
        a_v = values_a[d]
        b_v = values_b[d]
        paired_data.append(
            {
                "date": d,
                metric_a: a_v,
                metric_b: b_v,
            }
        )
        a_vals.append(a_v)
        b_vals.append(b_v)

    # Calculate Pearson correlation coefficient
    n = len(a_vals)
    mean_a = sum(a_vals) / n
    mean_b = sum(b_vals) / n

    cov = sum((a_vals[i] - mean_a) * (b_vals[i] - mean_b) for i in range(n)) / n
    std_a = (sum((v - mean_a) ** 2 for v in a_vals) / n) ** 0.5
    std_b = (sum((v - mean_b) ** 2 for v in b_vals) / n) ** 0.5

    correlation = None
    interpretation = "insufficient variance"
    if std_a > 0 and std_b > 0:
        correlation = round(cov / (std_a * std_b), 3)
        if abs(correlation) >= 0.7:
            interpretation = "strong positive" if correlation > 0 else "strong negative"
        elif abs(correlation) >= 0.4:
            interpretation = "moderate positive" if correlation > 0 else "moderate negative"
        elif abs(correlation) >= 0.2:
            interpretation = "weak positive" if correlation > 0 else "weak negative"
        else:
            interpretation = "no significant correlation"

    return {
        "user_id": str(user_id),
        "metric_a": metric_a,
        "metric_b": metric_b,
        "period_days": days,
        "overlapping_days": len(common_dates),
        "correlation": correlation,
        "interpretation": interpretation,
        "paired_data": paired_data,
    }


def _get_metric_daily_values(
    db: Session,
    user_id: UUID,
    metric: str,
    cutoff_dt: datetime,
    cutoff_date: date,
) -> dict[str, float]:
    """Get daily values for a metric, returns {date_str: value}."""

    if metric.startswith("symptom:"):
        symptom_type = metric[8:]
        rows = (
            db.query(
                func.date(SymptomEntry.recorded_at).label("day"),
                func.avg(SymptomEntry.severity).label("val"),
            )
            .filter(
                SymptomEntry.user_id == user_id,
                SymptomEntry.symptom_type == symptom_type,
                SymptomEntry.recorded_at >= cutoff_dt,
            )
            .group_by(func.date(SymptomEntry.recorded_at))
            .all()
        )
        return {row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day): float(row.val) for row in rows}

    if metric.startswith("lab:"):
        test_name = metric[4:]
        rows = (
            db.query(
                LabResult.recorded_at.label("day"),
                LabResult.value.label("val"),
            )
            .filter(
                LabResult.user_id == user_id,
                LabResult.test_name.ilike(f"%{test_name}%"),
                LabResult.recorded_at >= cutoff_date,
            )
            .all()
        )
        return {row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day): float(row.val) for row in rows}

    # Wearable time-series metric
    series_type = db.query(SeriesTypeDefinition).filter(SeriesTypeDefinition.code == metric).one_or_none()
    if not series_type:
        return {}

    data_source_ids = _get_data_source_for_user(db, user_id)
    if not data_source_ids:
        return {}

    # For sum-type metrics (steps, energy), use SUM; for others use AVG
    sum_metrics = {"steps", "active_energy_burned", "basal_energy_burned", "distance_walking_running"}
    agg_func = func.sum if metric in sum_metrics else func.avg

    rows = (
        db.query(
            func.date(DataPointSeries.recorded_at).label("day"),
            agg_func(DataPointSeries.value).label("val"),
        )
        .filter(
            DataPointSeries.data_source_id.in_(data_source_ids),
            DataPointSeries.series_type_definition_id == series_type.id,
            DataPointSeries.recorded_at >= cutoff_dt,
        )
        .group_by(func.date(DataPointSeries.recorded_at))
        .all()
    )

    return {row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day): float(row.val) for row in rows}
