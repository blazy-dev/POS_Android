'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  ShoppingBag,
  Users,
  BarChart3,
  LogOut,
  LayoutDashboard,
  Store,
  ChevronRight,
  User as UserIcon,
  FolderOpen,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, tenant, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-slate-400 animate-pulse text-sm">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      name: 'Resumen',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'supervisor', 'cashier'],
    },
    {
      name: 'Catálogo',
      href: '/dashboard/products',
      icon: ShoppingBag,
      roles: ['admin', 'supervisor'],
    },
    {
      name: 'Personal',
      href: '/dashboard/employees',
      icon: Users,
      roles: ['admin'],
    },
    {
      name: 'Ventas',
      href: '/dashboard/sales',
      icon: BarChart3,
      roles: ['admin', 'supervisor'],
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col z-20 shrink-0">
        {/* Brand / Logo */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-none bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              POS Global
            </h1>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
              Management
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            // Check if user has permission
            if (!item.roles.includes(user.role)) return null;

            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-indigo-300 border-l-4 border-indigo-500 pl-3'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`h-5 w-5 transition-colors duration-200 ${
                      isActive
                        ? 'text-indigo-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                <ChevronRight
                  className={`h-4 w-4 opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 ${
                    isActive ? 'text-indigo-400 opacity-100' : 'text-slate-600'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* User Footer Section */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserIcon className="h-4.5 w-4.5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-slate-500 truncate capitalize font-medium">
                {user.role === 'admin'
                  ? 'Administrador'
                  : user.role === 'supervisor'
                    ? 'Supervisor'
                    : 'Cajero'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto h-screen">
        {/* Top Header */}
        <header className="h-16 glass-panel border-b border-slate-800 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <Store className="h-5 w-5 text-indigo-400" />
            <span className="text-sm text-slate-400">Comercio Activo:</span>
            <span className="text-sm font-bold text-slate-200 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{tenant?.name}</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-xs text-slate-500 flex items-center space-x-1">
              <FolderOpen className="h-4.5 w-4.5 text-slate-600" />
              <span>ID:</span>
              <span className="font-mono text-[10px] select-all bg-slate-900 px-2 py-0.5 rounded text-slate-400">
                {tenant?.id}
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
