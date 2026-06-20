from sqlalchemy import Column, String, ForeignKey, Numeric
from app.db.base_class import Base, GUID


class InventoryMovement(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(GUID, ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    reference_type = Column(String(50), nullable=True)  # sale, purchase, adjustment, return, initial
    reference_id = Column(GUID, nullable=True)
    movement_type = Column(String(20), nullable=False)  # in, out
    quantity = Column(Numeric(12, 3), default=0.0, nullable=False)
