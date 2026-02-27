#!/usr/bin/env python3
"""Seed health assistant data: lab results and symptom entries for existing users."""

import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text

from app.database import SessionLocal
from app.models import LabResult, SymptomEntry

# Realistic lab results with reference ranges
LAB_TESTS: list[dict] = [
    {
        "test_name": "HbA1c",
        "test_code": "4548-4",
        "unit": "%",
        "ref_min": 4.0,
        "ref_max": 5.6,
        "values": [5.2, 5.4, 5.1, 5.3],
    },
    {
        "test_name": "Glucose (fasting)",
        "test_code": "1558-6",
        "unit": "mg/dL",
        "ref_min": 70,
        "ref_max": 100,
        "values": [92, 88, 95, 91],
    },
    {
        "test_name": "Total Cholesterol",
        "test_code": "2093-3",
        "unit": "mg/dL",
        "ref_min": 0,
        "ref_max": 200,
        "values": [195, 188, 201, 192],
    },
    {
        "test_name": "HDL Cholesterol",
        "test_code": "2085-9",
        "unit": "mg/dL",
        "ref_min": 40,
        "ref_max": 999,
        "values": [55, 58, 52, 56],
    },
    {
        "test_name": "LDL Cholesterol",
        "test_code": "2089-1",
        "unit": "mg/dL",
        "ref_min": 0,
        "ref_max": 130,
        "values": [118, 112, 125, 115],
    },
    {
        "test_name": "Triglycerides",
        "test_code": "2571-8",
        "unit": "mg/dL",
        "ref_min": 0,
        "ref_max": 150,
        "values": [120, 135, 110, 125],
    },
    {
        "test_name": "TSH",
        "test_code": "3016-3",
        "unit": "mIU/L",
        "ref_min": 0.4,
        "ref_max": 4.0,
        "values": [2.1, 1.8, 2.3, 2.0],
    },
    {
        "test_name": "Hemoglobin",
        "test_code": "718-7",
        "unit": "g/dL",
        "ref_min": 13.5,
        "ref_max": 17.5,
        "values": [15.2, 14.8, 15.5, 15.0],
    },
    {
        "test_name": "Vitamin D",
        "test_code": "1989-3",
        "unit": "ng/mL",
        "ref_min": 30,
        "ref_max": 100,
        "values": [28, 35, 22, 32],
    },
    {
        "test_name": "Iron",
        "test_code": "2498-4",
        "unit": "µg/dL",
        "ref_min": 60,
        "ref_max": 170,
        "values": [95, 88, 102, 90],
    },
    {
        "test_name": "Ferritin",
        "test_code": "2276-4",
        "unit": "ng/mL",
        "ref_min": 20,
        "ref_max": 250,
        "values": [85, 78, 92, 82],
    },
    {
        "test_name": "Creatinine",
        "test_code": "2160-0",
        "unit": "mg/dL",
        "ref_min": 0.7,
        "ref_max": 1.3,
        "values": [0.95, 0.92, 0.98, 0.94],
    },
    {
        "test_name": "ALT (GPT)",
        "test_code": "1742-6",
        "unit": "U/L",
        "ref_min": 7,
        "ref_max": 56,
        "values": [25, 28, 22, 26],
    },
    {
        "test_name": "AST (GOT)",
        "test_code": "1920-8",
        "unit": "U/L",
        "ref_min": 10,
        "ref_max": 40,
        "values": [22, 24, 20, 23],
    },
    {
        "test_name": "CRP",
        "test_code": "1988-5",
        "unit": "mg/L",
        "ref_min": 0,
        "ref_max": 5.0,
        "values": [1.2, 0.8, 2.1, 1.0],
    },
]

# Symptom types and their typical patterns
SYMPTOM_PATTERNS: list[dict] = [
    {
        "type": "headache",
        "frequency": 0.15,
        "severity_range": (3, 7),
        "duration_range": (30, 240),
        "triggers": ["Stress", "Screen time", "Dehydration"],
    },
    {
        "type": "migraine",
        "frequency": 0.05,
        "severity_range": (6, 9),
        "duration_range": (120, 720),
        "triggers": ["Weather change", "Sleep deficit", "Stress"],
    },
    {
        "type": "back_pain",
        "frequency": 0.1,
        "severity_range": (2, 6),
        "duration_range": (60, 480),
        "triggers": ["Sitting", "Exercise", "Poor posture"],
    },
    {
        "type": "fatigue",
        "frequency": 0.2,
        "severity_range": (3, 7),
        "duration_range": (120, 480),
        "triggers": ["Poor sleep", "Stress", "Overwork"],
    },
    {
        "type": "mood_low",
        "frequency": 0.08,
        "severity_range": (3, 6),
        "duration_range": (240, 720),
        "triggers": ["Stress", "Weather", "Isolation"],
    },
    {
        "type": "energy_high",
        "frequency": 0.25,
        "severity_range": (7, 10),
        "duration_range": None,
        "triggers": ["Good sleep", "Exercise", "Sunshine"],
    },
]


def _get_lab_status(value: float, ref_min: float, ref_max: float) -> str:
    """Determine lab result status based on reference range."""
    if value < ref_min:
        return "low"
    if value > ref_max:
        return "high"
    return "normal"


def seed_lab_results(db, user_id, num_checkups: int = 4) -> int:
    """Create lab results across multiple checkup dates for a user."""
    count = 0
    base_date = date.today() - timedelta(days=365)

    for i in range(num_checkups):
        checkup_date = base_date + timedelta(days=i * 90)

        for test in LAB_TESTS:
            value = test["values"][i % len(test["values"])]
            noise = random.uniform(-0.05, 0.05) * value
            final_value = round(value + noise, 3)

            lab = LabResult(
                id=uuid4(),
                document_id=None,
                user_id=user_id,
                test_name=test["test_name"],
                test_code=test["test_code"],
                value=Decimal(str(final_value)),
                unit=test["unit"],
                reference_min=Decimal(str(test["ref_min"])),
                reference_max=Decimal(str(test["ref_max"])),
                status=_get_lab_status(final_value, test["ref_min"], test["ref_max"]),
                recorded_at=checkup_date,
            )
            db.add(lab)
            count += 1

    db.commit()
    return count


def seed_symptoms(db, user_id, days: int = 90) -> int:
    """Create symptom entries over a period for a user."""
    count = 0
    base_dt = datetime.now(timezone.utc) - timedelta(days=days)

    for day_offset in range(days):
        day_dt = base_dt + timedelta(days=day_offset)

        for pattern in SYMPTOM_PATTERNS:
            if random.random() > pattern["frequency"]:
                continue

            hour = random.randint(7, 22)
            recorded = day_dt.replace(hour=hour, minute=random.randint(0, 59))
            sev_min, sev_max = pattern["severity_range"]

            duration = None
            if pattern["duration_range"]:
                dur_min, dur_max = pattern["duration_range"]
                duration = random.randint(dur_min, dur_max)

            num_triggers = random.randint(0, min(2, len(pattern["triggers"])))
            triggers = random.sample(pattern["triggers"], num_triggers) if num_triggers > 0 else None

            symptom = SymptomEntry(
                id=uuid4(),
                user_id=user_id,
                symptom_type=pattern["type"],
                severity=random.randint(sev_min, sev_max),
                notes=None,
                recorded_at=recorded,
                duration_minutes=duration,
                triggers=triggers,
            )
            db.add(symptom)
            count += 1

    db.commit()
    return count


def main() -> None:
    """Seed health data for all existing users."""
    db = SessionLocal()
    try:
        result = db.execute(text('SELECT id FROM "user"'))
        user_ids = [row[0] for row in result.fetchall()]

        if not user_ids:
            print("No users found. Run 'make seed' first.")
            return

        for i, user_id in enumerate(user_ids):
            lab_count = seed_lab_results(db, user_id)
            print(f"  \u2713 Created {lab_count} lab results for user {i + 1}")

            symptom_count = seed_symptoms(db, user_id)
            print(f"  \u2713 Created {symptom_count} symptom entries for user {i + 1}")

        print(f"\n\u2713 Successfully seeded health data for {len(user_ids)} users")
    finally:
        db.close()


if __name__ == "__main__":
    main()
