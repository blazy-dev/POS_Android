"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  CreditCard,
  Coins,
  Search,
  Eye,
  X,
  Calendar,
  AlertTriangle,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

interface Product {
  name: string;
  unit: string;
}

interface SaleItem {
  id: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: Product | null;
}

interface Customer {
  name: string;
}

interface User {
  name: string;
}

interface Sale {
  id: string;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  user?: User | null;
  customer?: Customer | null;
  items: SaleItem[];
}

export default function SalesHistoryPage() {
  const { session, tenant } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

  // Queries
  const { data: sales = [], isLoading, error } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/dashboard/sales`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: !!session,
  });

  const formatCurrency = (amount: number) => {
    const currency = tenant?.currency || "ARS";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    const cashierName = sale.user?.name || "Desconocido";
    const payment = sale.paymentMethod === "card" ? "tarjeta" : "efectivo";
    return (
      cashierName.toLowerCase().includes(search.toLowerCase()) ||
      sale.id.includes(search) ||
      payment.includes(search.toLowerCase())
    );
  });

  if (error) {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-lg mx-auto text-center border-rose-500/20 animate-fade-in">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white">Error al cargar datos</h3>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          No pudimos conectar con el servidor. Por favor, asegúrate de que el backend esté ejecutándose.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Historial de Tickets</h1>
        <p className="text-sm text-slate-400 mt-1">
          Visualiza el historial detallado de todas las ventas emitidas en tus terminales de cobro.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center bg-slate-900/40 backdrop-blur-md rounded-xl px-4 py-1.5 max-w-md border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
        <Search className="h-4 w-4 text-slate-500 mr-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cajero, ticket, método..."
          className="bg-transparent border-none outline-none text-slate-200 text-sm w-full placeholder-slate-500 py-1"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-slate-500 hover:text-slate-350 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          </div>
        ) : filteredSales.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Ticket</TableHead>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Cajero</TableHead>
                <TableHead className="text-center">Método</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id} className="group">
                  <TableCell className="font-mono text-xs text-slate-400 select-all max-w-[120px] truncate">
                    {sale.id}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center space-x-1.5 text-slate-300 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-600" />
                      <span>{formatDate(sale.createdAt)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-200">
                    {sale.user?.name || "Desconocido"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={sale.paymentMethod === "card" ? "secondary" : "success"}
                      className={
                        sale.paymentMethod === "card"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/25 px-2.5 py-1"
                          : "bg-emerald-500/10 text-emerald-450 border-emerald-500/25 px-2.5 py-1"
                      }
                    >
                      {sale.paymentMethod === "card" ? (
                        <CreditCard className="h-3 w-3 mr-1" />
                      ) : (
                        <Coins className="h-3 w-3 mr-1" />
                      )}
                      <span>{sale.paymentMethod === "card" ? "Tarjeta" : "Efectivo"}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-200">
                    {formatCurrency(Number(sale.total))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => setSelectedSale(sale)}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Detalle</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
            <History className="h-12 w-12 text-slate-700 mb-3" />
            <h3 className="text-slate-300 font-bold">No hay registros</h3>
            <p className="text-sm mt-1 max-w-xs">
              No se han emitido tickets de venta que coincidan con los filtros de búsqueda.
            </p>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        {selectedSale && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Receipt className="h-5 w-5 text-indigo-400" />
                <span>Detalle de Ticket</span>
              </DialogTitle>
              <DialogDescription>
                Resumen de cobro e ítems de la transacción.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Ticket Meta */}
              <div className="grid grid-cols-2 gap-y-3.5 text-sm p-4 bg-slate-950/60 border border-slate-900 rounded-xl">
                <div>
                  <p className="text-xs text-slate-500">ID del Ticket</p>
                  <p className="font-mono text-xs text-slate-300 mt-0.5 select-all">{selectedSale.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fecha y Hora</p>
                  <p className="font-medium text-slate-300 mt-0.5">{formatDate(selectedSale.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cajero Responsable</p>
                  <p className="font-medium text-slate-300 mt-0.5">{selectedSale.user?.name || "Desconocido"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Método de Pago</p>
                  <p className="font-medium text-slate-300 mt-0.5 capitalize">{selectedSale.paymentMethod === "card" ? "Tarjeta" : "Efectivo"}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Artículos Vendidos</h3>
                <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2.5 border-b border-slate-800/60 text-xs">
                      <div>
                        <p className="font-semibold text-slate-200">{item.product?.name || "Producto sin nombre"}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {Number(item.quantity)} {item.product?.unit || "un"} x {formatCurrency(Number(item.unitPrice))}
                        </p>
                      </div>
                      <p className="font-bold text-slate-300">{formatCurrency(Number(item.subtotal))}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-400">Total Recaudado</span>
                <span className="text-xl font-extrabold text-indigo-400">
                  {formatCurrency(Number(selectedSale.total))}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setSelectedSale(null)}
                variant="outline"
              >
                Cerrar Detalle
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
