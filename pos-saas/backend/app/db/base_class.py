import re
import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import Column, DateTime
from sqlalchemy.orm import as_declarative, declared_attr
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as pgUUID


class GUID(TypeDecorator):
    """
    Tipo GUID independiente de la plataforma.
    Usa el tipo UUID de PostgreSQL de forma nativa, o CHAR(36) para SQLite,
    guardando el valor como string hexadecimal con guiones.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(pgUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            if isinstance(value, str):
                return uuid.UUID(value)
            return value
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(uuid.UUID(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value


@as_declarative()
class Base:
    __allow_unmapped__ = True
    __name__: str

    # Genera automáticamente el nombre de la tabla en snake_case
    @declared_attr
    def __tablename__(cls) -> str:
        return re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower()

    # Campos de auditoría base para todos los modelos
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)
