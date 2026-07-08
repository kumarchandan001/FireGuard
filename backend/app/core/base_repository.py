"""
FireGuard AI — Base Repository

Generic repository pattern providing common CRUD operations.
Module-specific repositories extend this base to inherit
standard data access methods while adding domain-specific queries.
"""

from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.base_model import Base

# Generic type variable for ORM model classes
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic base repository with common CRUD operations.

    Usage:
        class IncidentRepository(BaseRepository[Incident]):
            def __init__(self, session: Session):
                super().__init__(Incident, session)

            def find_by_status(self, status: str) -> list[Incident]:
                ...
    """

    def __init__(self, model: type[ModelType], session: Session) -> None:
        self._model = model
        self._session = session

    def get_by_id(self, entity_id: int) -> ModelType | None:
        """Retrieve a single entity by primary key."""
        return self._session.get(self._model, entity_id)

    def get_all(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
        order_by: Any | None = None,
    ) -> Sequence[ModelType]:
        """Retrieve all entities with pagination support."""
        stmt = select(self._model)

        if order_by is not None:
            stmt = stmt.order_by(order_by)

        stmt = stmt.offset(offset).limit(limit)
        result = self._session.execute(stmt)
        return result.scalars().all()

    def count(self) -> int:
        """Return the total count of entities."""
        stmt = select(func.count()).select_from(self._model)
        result = self._session.execute(stmt)
        return result.scalar_one()

    def create(self, entity: ModelType) -> ModelType:
        """Persist a new entity and return it with generated fields."""
        self._session.add(entity)
        self._session.flush()
        self._session.refresh(entity)
        return entity

    def update(self, entity: ModelType) -> ModelType:
        """Update an existing entity. The entity must be attached to the session."""
        self._session.flush()
        self._session.refresh(entity)
        return entity

    def delete(self, entity: ModelType) -> None:
        """Remove an entity from the database."""
        self._session.delete(entity)
        self._session.flush()

    def delete_by_id(self, entity_id: int) -> bool:
        """Delete an entity by primary key. Returns True if found and deleted."""
        entity = self.get_by_id(entity_id)
        if entity is None:
            return False
        self.delete(entity)
        return True

    def commit(self) -> None:
        """Commit the current transaction."""
        self._session.commit()

    def rollback(self) -> None:
        """Rollback the current transaction."""
        self._session.rollback()
