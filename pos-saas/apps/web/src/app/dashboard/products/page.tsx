'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  FolderPlus,
  X,
  Check,
  Barcode,
  TrendingUp,
  TrendingDown,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { API_BASE } from '@/lib/api';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  category?: Category | null;
  purchasePrice: number;
  salePrice: number;
  costPrice: number;
  stock: number;
  minimumStock: number;
  unit: string;
}

const CATEGORY_PRESETS = [
  'Bebidas',
  'Almacen',
  'Lacteos',
  'Fiambres',
  'Limpieza',
  'Otros',
];

const UNIT_OPTIONS = [
  { value: 'unit', label: 'Unidad (un)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'pack', label: 'Pack / Caja' },
  { value: 'liter', label: 'Litro (L)' },
  { value: 'meter', label: 'Metro (m)' },
  { value: 'gram', label: 'Gramo (g)' },
];

export default function ProductsPage() {
  const { session, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState({
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    categoryName: '',
    purchasePrice: '',
    salePrice: '',
    costPrice: '',
    stock: '',
    minimumStock: '',
    unit: 'unit',
  });

  const [categoryName, setCategoryName] = useState('');
  const [formError, setFormError] = useState('');

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<
    Product[]
  >({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/dashboard/products`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!session,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/dashboard/categories`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    enabled: !!session,
  });

  const categoryOptions = useMemo(() => {
    const merged = [...categories.map((c) => ({ id: c.id, name: c.name }))];
    for (const preset of CATEGORY_PRESETS) {
      if (!merged.find((c) => c.name === preset)) {
        merged.push({ id: preset, name: preset });
      }
    }
    return merged;
  }, [categories]);

  const margin = useMemo(() => {
    const purchase = parseFloat(productForm.purchasePrice) || 0;
    const sale = parseFloat(productForm.salePrice) || 0;
    if (!purchase || !sale) return null;
    return ((sale - purchase) / purchase) * 100;
  }, [productForm.purchasePrice, productForm.salePrice]);

  const createProductMutation = useMutation({
    mutationFn: async (data: typeof productForm) => {
      const res = await fetch(`${API_BASE}/dashboard/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          barcode: data.barcode.trim() || undefined,
          name: data.name,
          description: data.description || undefined,
          categoryId: data.categoryId || undefined,
          purchasePrice: parseFloat(data.purchasePrice) || 0,
          salePrice: parseFloat(data.salePrice) || 0,
          costPrice: parseFloat(data.costPrice) || 0,
          stock: parseFloat(data.stock) || 0,
          minimumStock: parseFloat(data.minimumStock) || 0,
          unit: data.unit,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear producto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setIsProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: typeof productForm;
    }) => {
      const res = await fetch(`${API_BASE}/dashboard/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          barcode: data.barcode.trim() || undefined,
          name: data.name,
          description: data.description || undefined,
          categoryId: data.categoryId || undefined,
          purchasePrice: parseFloat(data.purchasePrice) || 0,
          salePrice: parseFloat(data.salePrice) || 0,
          costPrice: parseFloat(data.costPrice) || 0,
          stock: parseFloat(data.stock) || 0,
          minimumStock: parseFloat(data.minimumStock) || 0,
          unit: data.unit,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al actualizar producto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setIsProductModalOpen(false);
      setEditingProduct(null);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/dashboard/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Error al eliminar producto');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_BASE}/dashboard/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Error al crear categoria');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryModalOpen(false);
      setCategoryName('');
    },
  });

  const resetProductForm = () => {
    setProductForm({
      barcode: '',
      name: '',
      description: '',
      categoryId: '',
      categoryName: '',
      purchasePrice: '',
      salePrice: '',
      costPrice: '',
      stock: '',
      minimumStock: '',
      unit: 'unit',
    });
    setFormError('');
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    resetProductForm();
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      categoryId: product.categoryId || '',
      categoryName: product.category?.name || '',
      purchasePrice: String(product.purchasePrice || ''),
      salePrice: String(product.salePrice || ''),
      costPrice: String(product.costPrice || ''),
      stock: String(product.stock || ''),
      minimumStock: String(product.minimumStock || ''),
      unit: product.unit || 'unit',
    });
    setFormError('');
    setIsProductModalOpen(true);
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!productForm.name.trim()) {
      setFormError('El nombre del producto es requerido');
      return;
    }

    const salePrice = parseFloat(productForm.salePrice) || 0;
    if (salePrice <= 0) {
      setFormError('El precio de venta debe ser mayor a 0');
      return;
    }

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productForm });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Eliminar este producto?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = tenant?.currency || 'ARS';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Catalogo de Productos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Administra tus articulos de stock, precios y codigos de barra.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setIsCategoryModalOpen(true)}
            variant="outline"
            size="sm"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nueva Categoria
          </Button>
          <Button onClick={handleOpenCreateModal} variant="default" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="flex items-center bg-slate-900/40 backdrop-blur-md rounded-xl px-4 py-1.5 max-w-md border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
        <Search className="h-4 w-4 text-slate-500 mr-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o codigo..."
          className="bg-transparent border-none outline-none text-slate-200 text-sm w-full placeholder-slate-500 py-1"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-slate-500 hover:text-slate-350 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        {isLoadingProducts ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Costo / Venta</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Unidad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const isLowStock =
                  Number(product.stock) <= Number(product.minimumStock);
                const isOutOfStock = Number(product.stock) <= 0;

                return (
                  <TableRow key={product.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">
                          {product.name}
                        </p>
                        {product.barcode && (
                          <p className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1 font-mono">
                            <Barcode className="h-3 w-3" />
                            <span>{product.barcode}</span>
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge
                          variant="secondary"
                          className="bg-slate-950/65 text-slate-400 border-slate-850 px-2 py-0.5"
                        >
                          {product.category.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-600 text-xs italic">
                          Sin categoria
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="text-slate-200 font-bold">
                          {formatCurrency(product.salePrice)}
                        </p>
                        <p className="text-[10px] text-slate-550 mt-0.5">
                          Costo: {formatCurrency(product.purchasePrice)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-bold text-sm ${
                            isOutOfStock
                              ? 'text-rose-500'
                              : isLowStock
                                ? 'text-amber-500'
                                : 'text-emerald-500'
                          }`}
                        >
                          {Number(product.stock)}
                        </span>
                        {(isOutOfStock || isLowStock) && (
                          <Badge
                            variant={
                              isOutOfStock ? 'destructive' : 'secondary'
                            }
                            className="mt-1 text-[9px] px-1 py-0"
                          >
                            {isOutOfStock ? 'Agotado' : 'Minimo'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-slate-400 capitalize">
                      {product.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <Button
                          onClick={() => handleOpenEditModal(product)}
                          variant="outline"
                          size="icon"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteProduct(product.id)}
                          variant="ghost"
                          size="icon"
                          className="text-rose-400 hover:text-rose-350 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
            <ShoppingBag className="h-12 w-12 text-slate-700 mb-3" />
            <h3 className="text-slate-300 font-bold">Catalogo vacio</h3>
            <p className="text-sm mt-1 max-w-xs">
              No hay productos. Crea el primero con el boton de arriba.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================
          FORMULARIO DE PRODUCTO (estilo mobile - secciones + chips)
          ============================================================ */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del articulo para guardarlo en el inventario.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitProduct} className="space-y-5">
            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* ── Seccion: Identificacion ── */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Identificacion
                </h3>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Escanea el codigo de barras o ingresa los datos manualmente.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Codigo de Barras
                </label>
                <Input
                  type="text"
                  value={productForm.barcode}
                  onChange={(e) =>
                    setProductForm({ ...productForm, barcode: e.target.value })
                  }
                  placeholder="Ej: 7791234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Nombre del Producto *
                </label>
                <Input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm({ ...productForm, name: e.target.value })
                  }
                  placeholder="Ej: Gaseosa Cola 2.25L"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Categoria
                </label>
                <input
                  type="text"
                  value={productForm.categoryName}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      categoryName: e.target.value,
                      categoryId: e.target.value, // use name as ID for presets
                    })
                  }
                  placeholder="Elegi o escribi una categoria..."
                  className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-indigo-500/80 focus-visible:ring-2 focus-visible:ring-indigo-500/15"
                />

                <div className="flex flex-wrap gap-2 mt-3">
                  {categoryOptions.map((cat) => {
                    const active = productForm.categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setProductForm({
                            ...productForm,
                            categoryId: cat.id,
                            categoryName: cat.name,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          active
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Seccion: Precios ── */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-200">Precios</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Precio de Compra
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.purchasePrice}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        purchasePrice: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Precio de Venta *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.salePrice}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        salePrice: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {margin !== null && (
                <div
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                    margin >= 0
                      ? 'bg-emerald-500/5 border-emerald-500/15'
                      : 'bg-rose-500/5 border-rose-500/15'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400">
                    Margen estimado
                  </span>
                  <div className="flex items-center gap-1.5">
                    {margin >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-400" />
                    )}
                    <span
                      className={`text-lg font-extrabold ${
                        margin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Seccion: Inventario ── */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-200">
                  Inventario
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Stock {editingProduct ? 'Actual' : 'Inicial'}
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    value={productForm.stock}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        stock: e.target.value,
                      })
                    }
                    disabled={!!editingProduct}
                    placeholder="0"
                  />
                  {editingProduct && (
                    <p className="text-[10px] text-slate-600 mt-1">
                      Usa ajustes de inventario para modificar
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                    Stock Minimo
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    value={productForm.minimumStock}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        minimumStock: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Unidad de Medida
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNIT_OPTIONS.map((opt) => {
                    const active = productForm.unit === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setProductForm({ ...productForm, unit: opt.value })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          active
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Descripcion
                </label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Detalles adicionales del producto..."
                  className="flex w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-indigo-500/80 focus-visible:ring-2 focus-visible:ring-indigo-500/15 resize-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <Button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createProductMutation.isPending ||
                  updateProductMutation.isPending
                }
                className="flex items-center space-x-2"
              >
                {(createProductMutation.isPending ||
                  updateProductMutation.isPending) && (
                  <Spinner size="sm" />
                )}
                <Check className="h-4 w-4" />
                <span>
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Categoria ── */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Categoria</DialogTitle>
            <DialogDescription>
              Crea una categoria para agrupar tus productos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Nombre
              </label>
              <Input
                type="text"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ej: Bebidas, Lacteos..."
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                variant="outline"
                size="sm"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (categoryName.trim()) {
                    createCategoryMutation.mutate(categoryName.trim());
                  }
                }}
                disabled={createCategoryMutation.isPending}
                size="sm"
              >
                {createCategoryMutation.isPending ? (
                  <Spinner size="sm" />
                ) : null}
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
