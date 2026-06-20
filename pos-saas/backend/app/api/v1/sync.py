import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.customer import Customer
from app.models.cash_register import CashRegister
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.inventory_movement import InventoryMovement
from app.schemas.sync import SyncPushRequest, SyncPushResponse, SyncPullResponse

router = APIRouter()


@router.post("/push", response_model=SyncPushResponse)
def sync_push(
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Recibe un lote de operaciones locales registradas por el dispositivo
    y las aplica a la base de datos central PostgreSQL. Resuelve conflictos
    bajo el principio 'Last-Write-Wins'.
    """
    processed = 0
    failed = 0
    tenant_id = current_user.tenant_id

    # Ordenar las operaciones para cumplir la integridad referencial.
    # El orden lógico: categorías -> productos -> clientes -> cajas -> ventas -> movimientos de stock
    order_map = {
        "category": 1,
        "product": 2,
        "customer": 3,
        "cash_register": 4,
        "sale": 5,
        "inventory_movement": 6
    }
    
    sorted_operations = sorted(
        payload.operations,
        key=lambda op: order_map.get(op.entity_type, 10)
    )

    for op in sorted_operations:
        try:
            # Resolver el modelo correspondiente
            model = None
            if op.entity_type == "product":
                model = Product
            elif op.entity_type == "category":
                model = Category
            elif op.entity_type == "customer":
                model = Customer
            elif op.entity_type == "cash_register":
                model = CashRegister
            elif op.entity_type == "sale":
                model = Sale
            elif op.entity_type == "inventory_movement":
                model = InventoryMovement
            else:
                failed += 1
                continue

            # Buscar si el registro ya existe
            existing_record = db.query(model).filter(
                model.id == op.entity_id,
                model.tenant_id == tenant_id
            ).first()

            if op.operation == "delete":
                if existing_record:
                    # Eliminación lógica
                    existing_record.deleted_at = datetime.now(timezone.utc)
                    db.commit()
                processed += 1
                continue

            # Preparar la data
            data = op.payload.copy()
            data["tenant_id"] = tenant_id

            # Convertir fechas a tipo datetime de Python
            for date_field in ["created_at", "updated_at", "deleted_at", "opened_at", "closed_at"]:
                if date_field in data and data[date_field]:
                    try:
                        iso_str = data[date_field].replace("Z", "+00:00")
                        data[date_field] = datetime.fromisoformat(iso_str)
                    except Exception:
                        pass

            if existing_record:
                # Resolver conflicto por Last-Write-Wins
                db_updated_at = existing_record.updated_at
                payload_updated_at = data.get("updated_at")
                
                # Si el registro en la nube es más nuevo que el del cliente, descartar cambio
                if payload_updated_at and db_updated_at and payload_updated_at < db_updated_at:
                    processed += 1
                    continue

                # Extraer items de la venta para no provocar errores de mapeo en Sale
                items_data = data.pop("items", None)

                # Actualizar campos
                for key, value in data.items():
                    if hasattr(existing_record, key):
                        setattr(existing_record, key, value)
                db.commit()

                # Si es una venta, recrear los items asociados
                if op.entity_type == "sale" and items_data:
                    db.query(SaleItem).filter(SaleItem.sale_id == op.entity_id).delete()
                    for item in items_data:
                        sale_item = SaleItem(
                            sale_id=op.entity_id,
                            product_id=item.get("product_id"),
                            quantity=Decimal(str(item.get("quantity"))),
                            unit_price=Decimal(str(item.get("unit_price"))),
                            subtotal=Decimal(str(item.get("subtotal", item.get("quantity") * item.get("unit_price"))))
                        )
                        db.add(sale_item)
                    db.commit()
            else:
                # Crear nuevo registro
                items_data = data.pop("items", None)
                data["id"] = op.entity_id

                new_record = model(**data)
                db.add(new_record)
                db.commit()

                # Si es venta, insertar items
                if op.entity_type == "sale" and items_data:
                    for item in items_data:
                        sale_item = SaleItem(
                            sale_id=op.entity_id,
                            product_id=item.get("product_id"),
                            quantity=Decimal(str(item.get("quantity"))),
                            unit_price=Decimal(str(item.get("unit_price"))),
                            subtotal=Decimal(str(item.get("subtotal", item.get("quantity") * item.get("unit_price"))))
                        )
                        db.add(sale_item)
                    db.commit()

            processed += 1

        except Exception as e:
            db.rollback()
            failed += 1

    return {"processed": processed, "failed": failed}


@router.get("/pull", response_model=SyncPullResponse)
def sync_pull(
    last_sync_at: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Envía los cambios nuevos originados en la nube o en otros dispositivos
    que ocurrieron después de 'last_sync_at' para el tenant actual.
    """
    tenant_id = current_user.tenant_id
    changes = []
    server_time = datetime.now(timezone.utc)

    since_date = None
    if last_sync_at:
        try:
            iso_str = last_sync_at.replace("Z", "+00:00")
            since_date = datetime.fromisoformat(iso_str)
        except Exception:
            pass

    # Modelos a verificar
    models_to_check = [
        ("category", Category),
        ("product", Product),
        ("customer", Customer),
        ("cash_register", CashRegister),
        ("sale", Sale),
        ("inventory_movement", InventoryMovement)
    ]

    change_idx = 1
    for entity_name, model in models_to_check:
        query = db.query(model).filter(model.tenant_id == tenant_id)
        if since_date:
            query = query.filter(model.updated_at > since_date)
            
        records = query.all()
        for record in records:
            # Detectar si fue creado, actualizado o eliminado
            op = "create"
            if record.deleted_at is not None:
                op = "delete"
            elif record.updated_at > record.created_at:
                op = "update"

            # Mapear columnas a JSON
            payload = {}
            for col in record.__table__.columns:
                val = getattr(record, col.name)
                if isinstance(val, datetime):
                    payload[col.name] = val.isoformat()
                elif isinstance(val, (int, float, Decimal)):
                    payload[col.name] = float(val) if isinstance(val, Decimal) else val
                elif isinstance(val, uuid.UUID):
                    payload[col.name] = str(val)
                else:
                    payload[col.name] = val

            # Si es Venta, adjuntar detalle de productos (SaleItems)
            if entity_name == "sale":
                items = db.query(SaleItem).filter(SaleItem.sale_id == record.id).all()
                payload["items"] = [
                    {
                        "product_id": str(item.product_id),
                        "quantity": float(item.quantity),
                        "unit_price": float(item.unit_price),
                        "subtotal": float(item.subtotal)
                    }
                    for item in items
                ]

            changes.append({
                "id": f"change-{entity_name}-{record.id}-{change_idx}",
                "entity_type": entity_name,
                "entity_id": record.id,
                "operation": op,
                "payload": payload,
                "created_at": record.updated_at
            })
            change_idx += 1

    return {
        "changes": changes,
        "server_time": server_time
    }
