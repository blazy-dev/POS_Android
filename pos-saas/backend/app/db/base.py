# Importar todos los modelos para que la metadata de SQLAlchemy
# los registre antes de que Alembic ejecute la autogeneración.

from app.db.base_class import Base  # noqa
from app.models.tenant import Tenant  # noqa
from app.models.role import Role  # noqa
from app.models.user import User  # noqa
from app.models.category import Category  # noqa
from app.models.product import Product  # noqa
from app.models.customer import Customer  # noqa
from app.models.cash_register import CashRegister  # noqa
from app.models.sale import Sale  # noqa
from app.models.sale_item import SaleItem  # noqa
from app.models.inventory_movement import InventoryMovement  # noqa
from app.models.device import Device  # noqa
from app.models.sync_operation import SyncOperation  # noqa
from app.models.audit_log import AuditLog  # noqa
