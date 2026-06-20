from sqlalchemy import Column, String, ForeignKey
from app.db.base_class import Base, GUID


class Category(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
