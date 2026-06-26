"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ShoppingBag, ShieldCheck, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const { user, loginWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-slate-400 animate-pulse text-sm">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Background gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-700 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-700 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-700 rounded-full filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>

      <div className="relative w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center z-10">
        {/* Left Side: Product Intro */}
        <div className="hidden md:flex flex-col text-slate-100 space-y-6">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              POS SaaS Global v1.0
            </span>
            <h1 className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent">
              Gestiona tu negocio de forma inteligente
            </h1>
            <p className="mt-3 text-lg text-slate-400">
              La plataforma administrativa que te permite centralizar el control de ventas, catálogo y personal desde cualquier lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 flex items-start space-x-3 bg-slate-900/40 border-slate-800">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Catálogo Central</h3>
                <p className="text-xs text-slate-400 mt-1">Sincronización instantánea con dispositivos móviles.</p>
              </div>
            </Card>

            <Card className="p-4 flex items-start space-x-3 bg-slate-900/40 border-slate-800">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Control de Personal</h3>
                <p className="text-xs text-slate-400 mt-1">Gestión de PINs de cajeros, roles y permisos.</p>
              </div>
            </Card>

            <Card className="p-4 flex items-start space-x-3 col-span-2 bg-slate-900/40 border-slate-800">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Métricas de Rendimiento</h3>
                <p className="text-xs text-slate-400 mt-1">Visualiza los ingresos, stock mínimo y métodos de pago más utilizados.</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md mx-auto">
          <Card className="p-8 shadow-2xl relative bg-slate-900/45 border-slate-800">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ShieldCheck className="h-20 w-20 text-indigo-400" />
            </div>

            <CardContent className="p-0">
              <div className="flex flex-col items-center mb-8">
                {/* Logo */}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">Iniciar Sesión</h2>
                <p className="mt-1.5 text-sm text-slate-400 text-center">
                  Ingresa con tu cuenta de administrador de Google para gestionar tu tienda.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <Button
                  onClick={loginWithGoogle}
                  variant="outline"
                  className="flex w-full items-center justify-center space-x-3 rounded-xl bg-white text-slate-900 hover:bg-slate-50 border-transparent h-12 py-3 px-4 font-semibold shadow-sm transition-all"
                >
                  {/* Google Icon SVG */}
                  <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path
                        d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.77 21.56,11.4 21.35,11.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12,20.8c2.43,0 4.47,-0.8 5.96,-2.2l-3.3,-2.58c-0.9,0.6 -2.07,0.97 -3.3,0.97 -2.34,0 -4.33,-1.58 -5.04,-3.7H2.9v2.66c1.49,2.96 4.54,4.85 8.1,4.85z"
                        fill="#34A853"
                      />
                      <path
                        d="M6.96,13.3c-0.18,-0.54 -0.28,-1.12 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7.24H2.9C2.3,8.44 2,9.8 2,11.6c0,1.8 0.3,3.16 0.9,4.36L6.96,13.3z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12,5.26c1.3,0 2.48,0.45 3.4,1.33l2.55,-2.55C16.44,2.67 14.4,1.8 12,1.8 8.44,1.8 5.39,3.69 3.9,6.65L7.96,9.3c0.7,-2.13 2.7,-3.7 5.04,-3.7z"
                        fill="#EA4335"
                      />
                    </g>
                  </svg>
                  <span>Continuar con Google</span>
                </Button>
              </div>

              <div className="mt-8 border-t border-slate-800 pt-6 text-center">
                <p className="text-xs text-slate-500">
                  Al iniciar sesión, aceptas nuestros Términos de Servicio y Políticas de Privacidad.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
