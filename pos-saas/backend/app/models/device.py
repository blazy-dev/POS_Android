from sqlalchemy import Column, String, ForeignKey, DateTime
from app.db.base_class import Base, GUID


class Device(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    platform = Column(String(20), default="android", nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
