from sqlalchemy import Column, String, ForeignKey, Numeric, Boolean, Text, UniqueConstraint
from app.db.base_class import Base, GUID


class Product(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    barcode = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(GUID, ForeignKey("category.id", ondelete="SET NULL"), nullable=True)
    purchase_price = Column(Numeric(12, 2), default=0.0, nullable=False)
    sale_price = Column(Numeric(12, 2), default=0.0, nullable=False)
    cost_price = Column(Numeric(12, 2), default=0.0, nullable=False)
    stock = Column(Numeric(12, 3), default=0.0, nullable=False)
    minimum_stock = Column(Numeric(12, 3), default=0.0, nullable=False)
    unit = Column(String(20), default="unit", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "barcode", name="uq_product_tenant_barcode"),
    )
