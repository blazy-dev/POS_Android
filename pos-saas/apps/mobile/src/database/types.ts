// Tipos de operaciones de sincronización que se pueden poner en cola
export type SyncOperationKind = 'create' | 'update' | 'delete';

export type SyncOperationStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type AppMetaValue = string | number | boolean | null;

export type MoneyValue = number;

export interface ProductRecord {
  id: string;
  tenant_id: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  purchase_price: number;
  sale_price: number;
  stock: number;
  unit: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRecord {
  id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerRecord {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Representa una cabecera de venta (transacción) en SQLite.
 * Refleja la tabla 'sales'.
 */
export interface SaleRecord {
  id: string; // UUID identificador único de la venta
  tenant_id: string; // ID de la empresa
  cash_register_id: string | null; // Sesión de caja en la que ocurrió
  customer_id: string | null; // Cliente asociado
  user_id: string | null; // Usuario/Empleado que realizó la venta
  total: number; // Monto total cobrado
  payment_method: string; // Método de pago: 'cash', 'card', 'transfer', etc.
  status: string; // Estado de la venta: 'completed', 'cancelled'
  device_id: string; // ID del dispositivo físico que originó la venta
  created_at: string; // ISO Timestamp de la transacción
  updated_at: string; // ISO Timestamp
}

/**
 * Representa el desglose de productos vendidos (ítems) en una venta.
 * Refleja la tabla 'sale_items'.
 */
export interface SaleItemRecord {
  id: string; // UUID identificador único del detalle
  tenant_id: string; // ID de la empresa
  sale_id: string; // Relación con la tabla sales
  product_id: string | null; // Relación con la tabla products (NULLable)
  product_name: string; // Nombre del producto vendido (inmutable)
  product_unit: string; // Unidad de medida vendida (inmutable)
  quantity: number; // Cantidad vendida (puede ser fraccional, ej: 1.5 kg)
  unit_price: number; // Precio unitario cobrado al momento de la venta
  subtotal: number; // Cantidad * Precio Unitario
  created_at: string;
  updated_at: string;
}

/**
 * Registra cada movimiento de inventario (ingreso, egreso, venta, ajuste).
 * Refleja la tabla 'inventory_movements' para auditoría local e incremental.
 */
export interface InventoryMovementRecord {
  id: string; // UUID identificador único
  tenant_id: string; // ID de la empresa
  product_id: string; // Relación con products
  user_id: string | null; // Usuario que realizó el ajuste
  reference_type: string; // Entidad de origen: 'sale', 'adjustment', 'purchase'
  reference_id: string; // ID de la entidad de origen (ej. sale_id)
  movement_type: string; // Dirección: 'in' (ingreso), 'out' (egreso)
  quantity: number; // Cantidad absoluta del movimiento
  created_at: string;
  updated_at: string;
}

/**
 * Registra metadatos de configuración clave-valor de la aplicación local.
 * Refleja la tabla 'app_meta'.
 */
export interface AppMetaRecord {
  key: string; // Clave única identificadora
  value: string; // Valor serializado en JSON
  updated_at: string; // ISO Timestamp de última actualización
}

/**
 * Representa una operación encolada que debe sincronizarse con el backend global.
 * Refleja la tabla 'sync_operations' (Cola local para Offline-First).
 */
export interface SyncOperationRecord {
  id: string; // UUID identificador único de la operación de sincronización
  entity_type: string; // Nombre de la tabla afectada: 'products', 'sales', etc.
  entity_id: string; // UUID de la entidad local que se modificó
  operation: SyncOperationKind; // Tipo de acción: 'create', 'update', 'delete'
  payload: string; // JSON String con los datos a enviar
  status: SyncOperationStatus; // Estado actual ('pending', 'syncing', 'synced', 'failed')
  retries: number; // Contador de reintentos fallidos ante desconexión
  created_at: string;
  updated_at: string;
}

/**
 * Representa un usuario/empleado en la base de datos local SQLite.
 * Refleja la tabla 'users'.
 */
export interface UserRecord {
  id: string; // UUID del usuario (local o Supabase ID)
  tenant_id: string; // ID del tenant/empresa
  name: string; // Nombre completo del empleado
  email: string; // Correo único del empleado
  pin: string | null; // PIN de 4 dígitos para acceso rápido
  role: string; // Rol del empleado: 'admin', 'supervisor', 'cashier'
  is_active: number; // 1 = Activo, 0 = Inactivo/Desactivado
  created_at: string; // ISO Timestamp de creación
  updated_at: string; // ISO Timestamp de actualización
}
