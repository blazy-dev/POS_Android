from sqlalchemy import Column, String, Integer, ForeignKey, JSON
from app.db.base_class import Base, GUID


class SyncOperation(Base):
    device_id = Column(GUID, ForeignKey("device.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # product, sale, inventory_movement, cash_register
    entity_id = Column(GUID, nullable=False)
    operation = Column(String(20), nullable=False)  # create, update, delete
    payload = Column(JSON, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending, synced, failed
    retries = Column(Integer, default=0, nullable=False)
