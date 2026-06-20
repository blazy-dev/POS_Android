from typing import Optional
from pydantic import BaseModel, Field
from decimal import Decimal
from uuid import UUID


class ProductBase(BaseModel):
    barcode: Optional[str] = None
    name: str
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    purchase_price: Decimal = Field(default=Decimal("0.00"))
    sale_price: Decimal = Field(default=Decimal("0.00"))
    cost_price: Decimal = Field(default=Decimal("0.00"))
    stock: Decimal = Field(default=Decimal("0.000"))
    minimum_stock: Decimal = Field(default=Decimal("0.000"))
    unit: str = "unit"
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    barcode: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    purchase_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    stock: Optional[Decimal] = None
    minimum_stock: Optional[Decimal] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: UUID
    tenant_id: UUID

    class Config:
        from_attributes = True
