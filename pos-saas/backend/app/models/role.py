from sqlalchemy import Column, String, ForeignKey
from app.db.base_class import Base, GUID


class Role(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)  # admin, supervisor, cashier
