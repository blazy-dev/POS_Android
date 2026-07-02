'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PackageOpen,
  ArrowRight,
  CreditCard,
  Coins,
  History,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ErrorMessage } from '@/components/ui/error-message';
import { API_BASE } from '@/lib/api';

interface MetricResponse {
  totalRevenue: number;
  totalSalesCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  paymentMethods: {
    counts: { [key: string]: number };
    revenue: { [key: string]: number };
  };
  recentSales: Array<{
    id: string;
    total: number;
    paymentMethod: string;
    cashier: string;
    createdAt: string;
  }>;
}

export default function DashboardOverviewPage() {
  const { session, tenant } = useAuth();

  const {
    data: metrics,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<MetricResponse>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/dashboard/metrics`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch metrics: ${res.status}`);
      }

      return res.json();
    },
    enabled: !!session,
  });

  const formatCurrency = (amount: number) => {
    const currency = tenant?.currency || 'ARS';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Spinner size="lg" />
          <p className="text-slate-400 text-sm">
            Cargando estadísticas de la tienda...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto">
        <ErrorMessage
          title="Error al cargar datos"
          message="No pudimos conectar con el servidor. Por favor, asegúrate de que el backend esté ejecutándose."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const lowStock = metrics?.lowStockCount || 0;
  const outOfStock = metrics?.outOfStockCount || 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Panel de Resumen
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Revisa el rendimiento comercial de {tenant?.name} hoy.
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isRefetching}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2 text-xs"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`}
          />
          <span>Actualizar</span>
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <Card className="p-6 relative overflow-hidden group hover:scale-[1.01] transition-all duration-200 bg-slate-900/40 border-slate-800">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-indigo-400 group-hover:scale-105 transition-transform">
            <DollarSign className="h-32 w-32" />
          </div>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <Badge
              variant="success"
              className="bg-emerald-500/10 text-emerald-450 font-semibold border-emerald-500/20"
            >
              Hoy
            </Badge>
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-400">Ingresos Totales</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {formatCurrency(metrics?.totalRevenue || 0)}
            </h3>
          </div>
        </Card>

        {/* Total Sales */}
        <Card className="p-6 relative overflow-hidden group hover:scale-[1.01] transition-all duration-200 bg-slate-900/40 border-slate-800">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-purple-400 group-hover:scale-105 transition-transform">
            <TrendingUp className="h-32 w-32" />
          </div>
          <div className="flex justify-between items-start">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <Badge
              variant="secondary"
              className="bg-purple-500/10 text-purple-450 border-purple-500/20"
            >
              Historial
            </Badge>
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-400">Ventas Registradas</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {metrics?.totalSalesCount || 0}
            </h3>
          </div>
        </Card>

        {/* Low Stock Warning */}
        <Card
          className={`p-6 relative overflow-hidden group hover:scale-[1.01] transition-all duration-200 bg-slate-900/40 border-slate-800 border-l-4 ${lowStock > 0 ? 'border-l-amber-500' : 'border-l-slate-800'}`}
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 text-amber-400 group-hover:scale-105 transition-transform">
            <AlertTriangle className="h-32 w-32" />
          </div>
          <div className="flex justify-between items-start">
            <div
              className={`p-3 rounded-xl ${lowStock > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800/80 text-slate-400'}`}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>
            {lowStock > 0 && (
              <Badge
                variant="warning"
                className="bg-amber-500/10 text-amber-450 border-amber-500/20"
              >
                Alerta
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-400">Stock Mínimo Alcanzado</p>
            <h3 className="text-2xl font-bold text-white mt-1">{lowStock}</h3>
          </div>
        </Card>

        {/* Out of Stock Danger */}
        <Card
          className={`p-6 relative overflow-hidden group hover:scale-[1.01] transition-all duration-200 bg-slate-900/40 border-slate-800 border-l-4 ${outOfStock > 0 ? 'border-l-rose-500' : 'border-l-slate-800'}`}
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-400 group-hover:scale-105 transition-transform">
            <PackageOpen className="h-32 w-32" />
          </div>
          <div className="flex justify-between items-start">
            <div
              className={`p-3 rounded-xl ${outOfStock > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800/80 text-slate-400'}`}
            >
              <PackageOpen className="h-6 w-6" />
            </div>
            {outOfStock > 0 && (
              <Badge
                variant="destructive"
                className="bg-rose-500/10 text-rose-450 border-rose-500/20"
              >
                Crítico
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm text-slate-400">Sin Stock (Agotado)</p>
            <h3 className="text-2xl font-bold text-white mt-1">{outOfStock}</h3>
          </div>
        </Card>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Sales List */}
        <Card className="lg:col-span-2 flex flex-col h-[420px] bg-slate-900/40 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5 text-indigo-400" />
                <span>Últimas Ventas</span>
              </CardTitle>
              <CardDescription>
                Visualiza las últimas transacciones emitidas.
              </CardDescription>
            </div>
            <Button variant="link" size="sm" asChild className="p-0">
              <Link
                href="/dashboard/sales"
                className="text-indigo-400 hover:text-indigo-350 flex items-center space-x-1"
              >
                <span>Ver todo</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto pr-2">
            {metrics?.recentSales && metrics.recentSales.length > 0 ? (
              <div className="divide-y divide-slate-850">
                {metrics.recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="py-4 flex justify-between items-center group"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-lg ${sale.paymentMethod === 'card' ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                      >
                        {sale.paymentMethod === 'card' ? (
                          <CreditCard className="h-4.5 w-4.5" />
                        ) : (
                          <Coins className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {sale.paymentMethod === 'card'
                            ? 'Tarjeta de Débito/Crédito'
                            : 'Efectivo'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Por:{' '}
                          <span className="font-medium text-slate-455">
                            {sale.cashier}
                          </span>{' '}
                          • {formatDate(sale.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {formatCurrency(sale.total)}
                      </p>
                      <Badge
                        variant="success"
                        className="bg-emerald-500/10 text-emerald-450 border-emerald-500/10 mt-1"
                      >
                        Completado
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-500 py-12">
                <History className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-sm">Aún no se han registrado ventas hoy.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods & Quick Actions */}
        <div className="space-y-6 flex flex-col">
          {/* Payment Methods */}
          <Card className="flex-1 flex flex-col bg-slate-900/40 border-slate-800">
            <CardHeader className="pb-4">
              <CardTitle>Distribución de Pagos</CardTitle>
              <CardDescription>
                Volumen monetario según forma de cobro.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col justify-center space-y-6">
              {/* Cash Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Coins className="h-4 w-4 text-emerald-400" />
                    <span>Efectivo</span>
                  </span>
                  <span className="font-bold text-white">
                    {formatCurrency(
                      metrics?.paymentMethods?.revenue?.cash || 0,
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-900">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{
                      width: `${
                        metrics?.totalRevenue
                          ? ((metrics.paymentMethods.revenue.cash || 0) /
                              metrics.totalRevenue) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Card Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <CreditCard className="h-4 w-4 text-purple-400" />
                    <span>Tarjeta</span>
                  </span>
                  <span className="font-bold text-white">
                    {formatCurrency(
                      metrics?.paymentMethods?.revenue?.card || 0,
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-900">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${
                        metrics?.totalRevenue
                          ? ((metrics.paymentMethods.revenue.card || 0) /
                              metrics.totalRevenue) *
                            100
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Accesos Rápidos</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 gap-3">
              <Link href="/dashboard/products" className="w-full">
                <Button
                  variant="outline"
                  className="w-full flex flex-col h-20 rounded-xl justify-center items-center gap-1"
                >
                  <ShoppingBag className="h-5 w-5 text-indigo-400" />
                  <span>Inventario</span>
                </Button>
              </Link>
              <Link href="/dashboard/employees" className="w-full">
                <Button
                  variant="outline"
                  className="w-full flex flex-col h-20 rounded-xl justify-center items-center gap-1"
                >
                  <Users className="h-5 w-5 text-purple-400" />
                  <span>Personal</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
