from sqlalchemy import Column, String, ForeignKey, Numeric
from app.db.base_class import Base, GUID


class Sale(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    cash_register_id = Column(GUID, ForeignKey("cash_register.id", ondelete="SET NULL"), nullable=True)
    customer_id = Column(GUID, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(GUID, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    total = Column(Numeric(12, 2), default=0.0, nullable=False)
    payment_method = Column(String(50), default="cash", nullable=False)  # cash, transfer
    status = Column(String(20), default="completed", nullable=False)  # completed, canceled
    device_id = Column(GUID, nullable=True)
