from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from app.db.base_class import Base, GUID


class User(Base):
    tenant_id = Column(GUID, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(GUID, ForeignKey("role.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=True)
    google_id = Column(String(255), nullable=True)
    pin = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
