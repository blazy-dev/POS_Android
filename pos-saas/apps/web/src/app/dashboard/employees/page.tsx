'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Shield,
  KeyRound,
  Check,
  AlertTriangle,
  UserCheck,
  UserMinus,
  Edit2,
  CheckCircle2,
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
import { apiFetch } from '@/lib/api';

interface Role {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  pin: string | null;
  isActive: boolean;
  roleId: string | null;
  role: Role | null;
}

export default function EmployeesPage() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: '',
    email: '',
    pin: '',
    roleName: 'cashier',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Check admin rights
  const isAdmin = user?.role === 'admin';

  // Queries
  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () =>
      apiFetch<Employee[]>('/dashboard/employees', {
        token: session?.access_token,
      }),
    enabled: !!session && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: async (newData: typeof form) => {
      return apiFetch('/dashboard/employees', {
        method: 'POST',
        token: session?.access_token,
        body: JSON.stringify(newData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      return apiFetch(`/dashboard/employees/${id}`, {
        method: 'PUT',
        token: session?.access_token,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsModalOpen(false);
      setEditingEmployee(null);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiFetch(`/dashboard/employees/${id}`, {
        method: 'PUT',
        token: session?.access_token,
        body: JSON.stringify({ isActive }),
      });
    },
    onMutate: ({ id }) => {
      setPendingToggleId(id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setNotice(
        variables.isActive
          ? 'Usuario activado correctamente'
          : 'Usuario desactivado correctamente',
      );
    },
    onError: (err: any) => {
      setNotice(`No se pudo cambiar el estado: ${err.message}`);
    },
    onSettled: () => {
      setPendingToggleId(null);
    },
  });

  // Helpers
  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      pin: '',
      roleName: 'cashier',
      isActive: true,
    });
    setFormError('');
  };

  const handleOpenCreateModal = () => {
    setEditingEmployee(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      pin: emp.pin || '',
      roleName: emp.role?.name || 'cashier',
      isActive: emp.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.name || !form.email) {
      setFormError('Nombre y correo son requeridos');
      return;
    }

    if (form.pin && !/^\d{4,6}$/.test(form.pin)) {
      setFormError('El PIN debe tener entre 4 y 6 dígitos numéricos');
      return;
    }

    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee.id, data: form });
    } else {
      createEmployeeMutation.mutate(form);
    }
  };

  const handleToggleStatus = (emp: Employee) => {
    if (emp.id === user?.id) {
      alert('No puedes desactivar tu propia cuenta.');
      return;
    }
    const action = emp.isActive ? 'desactivar' : 'activar';
    if (confirm(`¿Estás seguro de que quieres ${action} a ${emp.name}?`)) {
      toggleStatusMutation.mutate({ id: emp.id, isActive: !emp.isActive });
    }
  };

  if (!isAdmin) {
    return (
      <div className="glass-panel p-8 rounded-2xl max-w-lg mx-auto text-center border-rose-500/20 animate-fade-in">
        <AlertTriangle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white">Acceso Denegado</h3>
        <p className="text-sm text-slate-400 mt-2">
          Solo los usuarios con el rol de Administrador tienen permisos para
          gestionar los empleados de este comercio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-slate-950/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md animate-fade-in">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Confirmado</p>
            <p className="text-xs text-slate-400">{notice}</p>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Gestión de Personal
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Administra los cajeros y supervisores de tus terminales de punto de
            venta.
          </p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          variant="default"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Agregar Empleado</span>
        </Button>
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : employees.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre y Contacto</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">PIN de Acceso</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-200">{emp.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {emp.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        emp.role?.name === 'admin'
                          ? 'default'
                          : emp.role?.name === 'supervisor'
                            ? 'secondary'
                            : 'outline'
                      }
                      className={
                        emp.role?.name === 'admin'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25 px-2 py-0.5'
                          : emp.role?.name === 'supervisor'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/25 px-2 py-0.5'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700/50 px-2 py-0.5'
                      }
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      <span>
                        {emp.role?.name === 'admin'
                          ? 'Administrador'
                          : emp.role?.name === 'supervisor'
                            ? 'Supervisor'
                            : 'Cajero'}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {emp.pin ? (
                      <span className="font-mono bg-slate-950 px-2.5 py-1 rounded text-xs text-slate-450 border border-slate-900 inline-flex items-center space-x-1.5 shadow-sm">
                        <KeyRound className="h-3 w-3 text-slate-650" />
                        <span>{emp.pin}</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs italic">
                        Sin PIN
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={emp.isActive ? 'success' : 'destructive'}>
                      <span>{emp.isActive ? 'Activo' : 'Inactivo'}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <Button
                        onClick={() => handleOpenEditModal(emp)}
                        variant="outline"
                        size="icon"
                        title="Editar Perfil"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => handleToggleStatus(emp)}
                        disabled={emp.id === user?.id || pendingToggleId === emp.id}
                        variant="ghost"
                        size="icon"
                        className={`border border-transparent hover:border-slate-800 ${
                          emp.isActive
                            ? 'text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20'
                            : 'text-emerald-450 hover:text-emerald-450 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                        }`}
                        title={emp.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {pendingToggleId === emp.id ? (
                          <Spinner size="sm" className="border-current border-t-transparent" />
                        ) : emp.isActive ? (
                          <UserMinus className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
            <Users className="h-12 w-12 text-slate-700 mb-3" />
            <h3 className="text-slate-300 font-bold">No hay empleados</h3>
            <p className="text-sm mt-1 max-w-xs">
              Haz clic en Agregar Empleado para crear un usuario en el sistema.
            </p>
          </div>
        )}
      </div>

      {/* Employee Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}
            </DialogTitle>
            <DialogDescription>
              Configura el perfil de acceso y rol de tu personal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Nombre Completo
              </label>
              <Input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Marcelo Galli"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Correo Electrónico
              </label>
              <Input
                type="email"
                required
                disabled={!!editingEmployee}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ejemplo@comercio.com"
                className="disabled:opacity-50 disabled:bg-slate-950"
              />
            </div>

            {/* PIN Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                PIN de Acceso Rápido (4 a 6 dígitos)
              </label>
              <Input
                type="text"
                maxLength={6}
                value={form.pin}
                onChange={(e) =>
                  setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })
                }
                placeholder="Ej: 4821"
                className="font-mono tracking-widest text-left"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Permite ingresar rápido desde dispositivos móviles sin escribir
                el email.
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Rol del Usuario
              </label>
              <select
                value={form.roleName}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                className="flex h-10 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 bg-slate-900"
              >
                <option value="cashier">Cajero</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {/* Active Toggle (only editing) */}
            {editingEmployee && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    Usuario Activo
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Habilita o deshabilita el acceso del empleado.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={editingEmployee.id === user?.id}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4.5 w-4.5 rounded border-slate-800 text-indigo-650 focus:ring-indigo-500 bg-slate-950 cursor-pointer disabled:opacity-50"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <Button
                type="button"
                onClick={() => setIsModalOpen(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createEmployeeMutation.isPending ||
                  updateEmployeeMutation.isPending
                }
              >
                {createEmployeeMutation.isPending ||
                updateEmployeeMutation.isPending ? (
                  <Spinner
                    size="sm"
                    className="border-white border-t-transparent"
                  />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">
                  {editingEmployee ? 'Guardar' : 'Crear'}
                </span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
