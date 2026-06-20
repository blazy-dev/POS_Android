import type { SQLiteDatabase } from "expo-sqlite";

export interface DailySalesSummary {
  transaction_count: number;
  cash_total: number;
  transfer_total: number;
  sales_total: number;
}

export interface TopProductRecord {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
  total_quantity: number;
  total_amount: number;
}

export interface LowStockProductRecord {
  id: string;
  name: string;
  stock: number;
  unit: string;
  sale_price: number;
}

export interface CashRegisterSessionRecord {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: string;
  opened_by_name: string | null;
}

/**
 * Obtiene el resumen de ventas para el día de hoy (fecha local del dispositivo).
 */
export async function getDailySalesSummary(
  db: SQLiteDatabase,
  tenantId = "local"
): Promise<DailySalesSummary> {
  const row = await db.getFirstAsync<DailySalesSummary>(
    `SELECT 
       COUNT(id) AS transaction_count,
       COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash_total,
       COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0) AS transfer_total,
       COALESCE(SUM(total), 0) AS sales_total
     FROM sales
     WHERE date(created_at, 'localtime') = date('now', 'localtime')
       AND status = 'completed'
       AND tenant_id = $tenant_id`,
    { $tenant_id: tenantId }
  );

  return (
    row ?? {
      transaction_count: 0,
      cash_total: 0,
      transfer_total: 0,
      sales_total: 0,
    }
  );
}

/**
 * Obtiene los productos más vendidos en orden descendente.
 */
export async function getTopSellingProducts(
  db: SQLiteDatabase,
  limit = 5,
  tenantId = "local"
): Promise<TopProductRecord[]> {
  return db.getAllAsync<TopProductRecord>(
    `SELECT 
       p.id,
       p.name,
       p.unit,
       p.sale_price,
       COALESCE(SUM(si.quantity), 0) AS total_quantity,
       COALESCE(SUM(si.subtotal), 0) AS total_amount
     FROM sale_items si
     JOIN products p ON si.product_id = p.id
     JOIN sales s ON si.sale_id = s.id
     WHERE s.status = 'completed'
       AND s.tenant_id = $tenant_id
     GROUP BY p.id
     ORDER BY total_quantity DESC
     LIMIT $limit`,
    { $tenant_id: tenantId, $limit: limit }
  );
}

/**
 * Obtiene los productos activos que tienen un stock menor o igual a un umbral.
 */
export async function getLowStockProducts(
  db: SQLiteDatabase,
  threshold = 5,
  tenantId = "local"
): Promise<LowStockProductRecord[]> {
  return db.getAllAsync<LowStockProductRecord>(
    `SELECT id, name, stock, unit, sale_price
     FROM products
     WHERE stock <= $threshold
       AND is_active = 1
       AND tenant_id = $tenant_id
     ORDER BY stock ASC`,
    { $tenant_id: tenantId, $threshold: threshold }
  );
}

/**
 * Obtiene las últimas sesiones de caja registradas.
 */
export async function getCashRegisterSessions(
  db: SQLiteDatabase,
  limit = 20,
  tenantId = "local"
): Promise<CashRegisterSessionRecord[]> {
  return db.getAllAsync<CashRegisterSessionRecord>(
    `SELECT 
       cr.id,
       cr.opened_at,
       cr.closed_at,
       cr.opening_amount,
       cr.closing_amount,
       cr.status,
       u.name AS opened_by_name
     FROM cash_registers cr
     LEFT JOIN users u ON cr.opened_by = u.id
     WHERE cr.tenant_id = $tenant_id
     ORDER BY cr.opened_at DESC
     LIMIT $limit`,
    { $tenant_id: tenantId, $limit: limit }
  );
}

export interface SaleWithItems {
  id: string;
  total: number;
  payment_method: string;
  created_at: string;
  status: string;
  items: Array<{
    product_name: string;
    product_unit: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

/**
 * Obtiene la lista de ventas de una sesión de caja con sus respectivos detalles/desgloses.
 */
export async function getSessionSalesWithItems(
  db: SQLiteDatabase,
  registerId: string
): Promise<SaleWithItems[]> {
  // 1. Obtener todas las ventas registradas para este turno
  const sales = await db.getAllAsync<{
    id: string;
    total: number;
    payment_method: string;
    created_at: string;
    status: string;
  }>(
    `SELECT id, total, payment_method, created_at, status 
     FROM sales 
     WHERE cash_register_id = $registerId 
     ORDER BY created_at DESC`,
    { $registerId: registerId }
  );

  if (sales.length === 0) return [];

  // 2. Obtener todos los ítems vendidos en este turno
  const items = await db.getAllAsync<{
    sale_id: string;
    product_name: string;
    product_unit: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>(
    `SELECT 
       si.sale_id,
       p.name AS product_name,
       p.unit AS product_unit,
       si.quantity,
       si.unit_price,
       si.subtotal
     FROM sale_items si
     JOIN products p ON si.product_id = p.id
     JOIN sales s ON si.sale_id = s.id
     WHERE s.cash_register_id = $registerId
     ORDER BY si.created_at ASC`,
    { $registerId: registerId }
  );

  // 3. Agrupar ítems por venta en memoria
  return sales.map((sale) => ({
    ...sale,
    items: items.filter((item) => item.sale_id === sale.id),
  }));
}
