from sqlalchemy import Column, String
from app.db.base_class import Base


class Tenant(Base):
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    currency = Column(String(10), default="ARS", nullable=False)
    timezone = Column(String(50), default="America/Argentina/Buenos_Aires", nullable=False)
