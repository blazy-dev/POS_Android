from sqlalchemy import Column, ForeignKey, Numeric
from app.db.base_class import Base, GUID


class SaleItem(Base):
    sale_id = Column(GUID, ForeignKey("sale.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(GUID, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Numeric(12, 3), default=0.0, nullable=False)
    unit_price = Column(Numeric(12, 2), default=0.0, nullable=False)
    subtotal = Column(Numeric(12, 2), default=0.0, nullable=False)
