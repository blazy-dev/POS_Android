'use client';

import React, { useState } from 'react';
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

export default function ProductsPage() {
  const { session, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [productForm, setProductForm] = useState({
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    purchasePrice: 0,
    salePrice: 0,
    costPrice: 0,
    stock: 0,
    minimumStock: 0,
    unit: 'unit',
  });

  const [categoryName, setCategoryName] = useState('');
  const [formError, setFormError] = useState('');

  // Queries
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

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<
    Category[]
  >({
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

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: typeof productForm) => {
      const res = await fetch(`${API_BASE}/dashboard/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(newProduct),
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
        body: JSON.stringify(data),
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
      if (!res.ok) throw new Error('Error al crear categoría');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryModalOpen(false);
      setCategoryName('');
    },
  });

  // Helpers
  const resetProductForm = () => {
    setProductForm({
      barcode: '',
      name: '',
      description: '',
      categoryId: '',
      purchasePrice: 0,
      salePrice: 0,
      costPrice: 0,
      stock: 0,
      minimumStock: 0,
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
      purchasePrice: Number(product.purchasePrice) || 0,
      salePrice: Number(product.salePrice) || 0,
      costPrice: Number(product.costPrice) || 0,
      stock: Number(product.stock) || 0,
      minimumStock: Number(product.minimumStock) || 0,
      unit: product.unit || 'unit',
    });
    setFormError('');
    setIsProductModalOpen(true);
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!productForm.name) {
      setFormError('El nombre es requerido');
      return;
    }

    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        data: productForm,
      });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = tenant?.currency || 'ARS';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search)),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title / Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Catálogo de Productos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Administra tus artículos de stock, precios y códigos de barra.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setIsCategoryModalOpen(true)}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <FolderPlus className="h-4.5 w-4.5" />
            <span>Crear Categoría</span>
          </Button>

          <Button
            onClick={handleOpenCreateModal}
            variant="default"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Agregar Producto</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center bg-slate-900/40 backdrop-blur-md rounded-xl px-4 py-1.5 max-w-md border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
        <Search className="h-4 w-4 text-slate-500 mr-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código..."
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

      {/* Products Table */}
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
                <TableHead>Categoría</TableHead>
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
                            <Barcode className="h-3 w-3 text-slate-650" />
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
                          Sin categoría
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
                        {isOutOfStock ? (
                          <Badge
                            variant="destructive"
                            className="mt-1 text-[9px] px-1 py-0 border-rose-500/10"
                          >
                            Agotado
                          </Badge>
                        ) : isLowStock ? (
                          <Badge
                            variant="warning"
                            className="mt-1 text-[9px] px-1 py-0 flex items-center gap-0.5 border-amber-500/10"
                          >
                            <AlertTriangle className="h-2 w-2" />
                            <span>Mínimo</span>
                          </Badge>
                        ) : null}
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
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteProduct(product.id)}
                          variant="ghost"
                          size="icon"
                          className="text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                          title="Eliminar"
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
            <h3 className="text-slate-300 font-bold">Catálogo vacío</h3>
            <p className="text-sm mt-1 max-w-xs">
              No hay productos que coincidan con la búsqueda o cargados en el
              inventario.
            </p>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              Introduce los datos del artículo para guardarlo en la base de
              datos de tu tienda.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitProduct} className="space-y-5">
            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Barcode */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Código de Barras (Opcional)
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    value={productForm.barcode}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        barcode: e.target.value,
                      })
                    }
                    placeholder="Escribe o escanea el código..."
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="col-span-2">
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

              {/* Description */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Descripción (Opcional)
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
                  placeholder="Detalles sobre el producto..."
                  className="flex w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4.5 py-2 text-sm text-slate-200 shadow-sm transition-all placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-indigo-500/80 focus-visible:ring-3 focus-visible:ring-indigo-500/15 resize-none"
                />
              </div>

              {/* Category select */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Categoría
                </label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      categoryId: e.target.value,
                    })
                  }
                  className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 bg-slate-900"
                >
                  <option value="">Seleccionar...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit type */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Unidad de Medida
                </label>
                <select
                  value={productForm.unit}
                  onChange={(e) =>
                    setProductForm({ ...productForm, unit: e.target.value })
                  }
                  className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 bg-slate-900"
                >
                  <option value="unit">Unidad (un)</option>
                  <option value="kg">Kilogramo (kg)</option>
                  <option value="pack">Pack / Caja</option>
                  <option value="liter">Litro (L)</option>
                </select>
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Precio de Costo
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.purchasePrice}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      purchasePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Sale Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Precio de Venta
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.salePrice}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      salePrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Stock Actual
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={productForm.stock}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      stock: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Minimum Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Stock Mínimo
                </label>
                <Input
                  type="number"
                  step="0.001"
                  value={productForm.minimumStock}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      minimumStock: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            {/* Action Buttons */}
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
                {createProductMutation.isPending ||
                updateProductMutation.isPending ? (
                  <Spinner
                    size="sm"
                    className="border-white border-t-transparent"
                  />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>
                  {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Creation Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear Categoría</DialogTitle>
            <DialogDescription>
              Define una nueva categoría para agrupar tus artículos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Nombre de la Categoría
              </label>
              <Input
                type="text"
                required
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ej: Bebidas, Lácteos"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-850">
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
                variant="default"
                size="sm"
              >
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
