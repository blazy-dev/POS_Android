from sqlalchemy import Column, String, ForeignKey, Numeric, DateTime
from app.db.base_class import Base, GUID


class CashRegister(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    opened_by = Column(GUID, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    opening_amount = Column(Numeric(12, 2), default=0.0, nullable=False)
    closing_amount = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), default="open", nullable=False)  # open, closed
