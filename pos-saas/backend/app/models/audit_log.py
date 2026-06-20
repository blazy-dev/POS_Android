from sqlalchemy import Column, String, ForeignKey, JSON
from app.db.base_class import Base, GUID


class AuditLog(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(GUID, ForeignKey("device.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g., create_sale, cancel_sale, update_price
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(GUID, nullable=True)
    
    # Se renombra de 'metadata' a 'metadata_json' para evitar conflicto 
    # con el atributo interno 'metadata' de SQLAlchemy Base.
    metadata_json = Column(JSON, nullable=True)
