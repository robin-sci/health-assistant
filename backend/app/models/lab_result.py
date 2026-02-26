from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped

from app.database import BaseDbModel
from app.mappings import FKMedicalDocument, FKUser, ManyToOne, PrimaryKey, date_col, numeric_10_3, str_50, str_255

if TYPE_CHECKING:
    from app.models.medical_document import MedicalDocument


class LabResult(BaseDbModel):
    """Individual lab test results extracted from medical documents."""

    __tablename__ = "lab_result"
    __table_args__ = (UniqueConstraint("user_id", "test_name", "recorded_at", name="uq_lab_result_user_test_date"),)

    id: Mapped[PrimaryKey[UUID]]
    document_id: Mapped[FKMedicalDocument]
    user_id: Mapped[FKUser]
    test_name: Mapped[str_255]
    test_code: Mapped[str_50 | None]
    value: Mapped[numeric_10_3]
    unit: Mapped[str_50]
    reference_min: Mapped[numeric_10_3 | None]
    reference_max: Mapped[numeric_10_3 | None]
    status: Mapped[str_50 | None]
    recorded_at: Mapped[date_col]

    document: Mapped[ManyToOne["MedicalDocument"]]
