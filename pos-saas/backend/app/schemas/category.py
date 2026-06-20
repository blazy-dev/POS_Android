from typing import Optional
from pydantic import BaseModel
from uuid import UUID


class CategoryBase(BaseModel):
    name: str


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: UUID
    tenant_id: UUID

    class Config:
        from_attributes = True
