from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class TenantBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    currency: str = "ARS"
    timezone: str = "America/Argentina/Buenos_Aires"


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None


class TenantResponse(TenantBase):
    id: UUID

    class Config:
        from_attributes = True
        # Soporta carga de datos desde objetos SQLAlchemy (antes orm_mode=True en Pydantic v1)
