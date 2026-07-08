"""
FireGuard AI — Settings ORM Model

Key-value configuration store with typed access.
Each setting has a category for UI grouping and a
value_type for safe casting.
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base


class Setting(Base):
    """
    Application configuration stored as key-value pairs.

    Using a KV store instead of a fixed schema allows adding new
    settings without database migrations.
    """

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="string",
        comment="int | float | bool | string",
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="general",
        comment="detection | alarm | camera | system",
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Setting(key={self.key}, value={self.value}, type={self.value_type})>"
