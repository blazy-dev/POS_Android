export type ProductFormValues = {
  barcode: string;
  name: string;
  category: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  unit: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | "form", string>>;

export const PRODUCT_UNITS = [
  { value: "unit", label: "Unidad" },
  { value: "kg", label: "Kilogramo" },
  { value: "g", label: "Gramo" },
  { value: "L", label: "Litro" },
  { value: "ml", label: "Mililitro" },
  { value: "pack", label: "Pack" },
] as const;

export const DEFAULT_PRODUCT_FORM: ProductFormValues = {
  barcode: "",
  name: "",
  category: "",
  purchasePrice: "",
  salePrice: "",
  stock: "",
  unit: "unit",
};

function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const trimmedName = values.name.trim();

  if (!trimmedName) {
    errors.name = "El nombre del producto es obligatorio.";
  }

  const purchasePrice = parseDecimal(values.purchasePrice);
  const salePrice = parseDecimal(values.salePrice);
  const stock = parseDecimal(values.stock);

  if (values.purchasePrice.trim() && purchasePrice === null) {
    errors.purchasePrice = "Ingresá un precio de compra válido.";
  } else if (purchasePrice !== null && purchasePrice < 0) {
    errors.purchasePrice = "El precio de compra no puede ser negativo.";
  }

  if (!values.salePrice.trim()) {
    errors.salePrice = "El precio de venta es obligatorio.";
  } else if (salePrice === null) {
    errors.salePrice = "Ingresá un precio de venta válido.";
  } else if (salePrice < 0) {
    errors.salePrice = "El precio de venta no puede ser negativo.";
  }

  if (purchasePrice !== null && salePrice !== null && salePrice < purchasePrice) {
    errors.salePrice = "El precio de venta no puede ser menor al de compra.";
  }

  if (values.stock.trim() && stock === null) {
    errors.stock = "Ingresá un stock inicial válido.";
  } else if (stock !== null && stock < 0) {
    errors.stock = "El stock inicial no puede ser negativo.";
  }

  return errors;
}

export function parseProductForm(values: ProductFormValues) {
  const purchasePrice = parseDecimal(values.purchasePrice) ?? 0;
  const salePrice = parseDecimal(values.salePrice) ?? 0;
  const stock = parseDecimal(values.stock) ?? 0;

  return {
    barcode: values.barcode.trim() || null,
    name: values.name.trim(),
    categoryId: values.category.trim() || null,
    purchasePrice,
    salePrice,
    stock,
    unit: values.unit.trim() || "unit",
  };
}

export function calculateMargin(purchasePrice: number, salePrice: number) {
  if (salePrice <= 0) {
    return null;
  }

  const margin = ((salePrice - purchasePrice) / salePrice) * 100;
  return Math.round(margin * 10) / 10;
}
