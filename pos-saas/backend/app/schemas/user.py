from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    is_active: bool = True


class UserCreate(UserBase):
    tenant_id: UUID
    role_id: Optional[UUID] = None
    password: Optional[str] = None
    pin: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    role_id: Optional[UUID] = None
    password: Optional[str] = None
    pin: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    role_id: Optional[UUID] = None
    google_id: Optional[str] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True
