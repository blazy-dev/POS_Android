import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 text-slate-300">
      <div className="max-w-3xl mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Política de Privacidad
          </h1>
          <p className="mt-2 text-sm text-indigo-400">
            Última actualización: Julio de 2026
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed">
          <p>
            En <strong>Ventu</strong> (en adelante, &quot;la Aplicación&quot; o &quot;nuestro Servicio&quot;), entendemos la importancia de proteger la información de nuestros usuarios. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y protegemos los datos que se procesan al utilizar nuestro sistema de Punto de Venta (POS) móvil y su plataforma web asociada.
          </p>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              1. Información que Recopilamos
            </h2>
            <p className="mb-2">
              Para poder ofrecer el servicio de sincronización y acceso a tu cuenta, recopilamos los siguientes datos:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Información de la Cuenta:</strong> Dirección de correo electrónico y nombre (si es proporcionado) para el registro e inicio de sesión a través de nuestro proveedor de autenticación (Supabase Auth).
              </li>
              <li>
                <strong>Datos Operativos y de Negocio (Punto de Venta):</strong> Catálogo de productos, registros de inventario, transacciones de ventas y registros de turnos de caja. Estos datos se almacenan localmente en tu dispositivo en una base de datos SQLite y se sincronizan de forma segura con nuestros servidores PostgreSQL en la nube.
              </li>
              <li>
                <strong>Identificadores de Dispositivo:</strong> Información técnica básica del dispositivo móvil para la gestión de sesiones activas.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              2. Cómo Utilizamos la Información
            </h2>
            <p className="mb-2">La información recopilada se utiliza exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Permitir el acceso y seguridad de tu cuenta.</li>
              <li>Mantener tus datos sincronizados entre múltiples dispositivos.</li>
              <li>Brindarte reportes estadísticos y métricas del rendimiento de tu negocio.</li>
              <li>Proporcionar soporte técnico y resolver incidencias operativas.</li>
            </ul>
            <p className="mt-2 text-amber-400">
              <strong>Nota Importante:</strong> No vendemos, alquilamos ni compartimos tus datos comerciales ni tu información personal con terceros bajo ningún concepto.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              3. Seguridad y Almacenamiento de los Datos
            </h2>
            <p>
              Toda la comunicación entre tu dispositivo móvil (app de Expo) y nuestros servidores (API y base de datos) se realiza a través de canales cifrados utilizando protocolos seguros de transferencia de hipertexto (HTTPS).
            </p>
            <p className="mt-2">
              Los datos en la nube están alojados en infraestructuras de base de datos seguras provistas por Supabase y protegidas mediante estrictos controles de seguridad de base de datos a nivel de fila (Row Level Security - RLS).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              4. Retención de Datos y Derechos del Usuario (Eliminación)
            </h2>
            <p>
              Conservamos tu información durante el tiempo que tu cuenta permanezca activa en nuestro servicio. Como usuario, tienes derecho a acceder, rectificar o solicitar la eliminación total de tus datos personales e información comercial almacenada.
            </p>
            <p className="mt-2 font-medium text-white">
              Para solicitar la eliminación definitiva de tu cuenta y todos los datos asociados, por favor envíanos un correo a:
            </p>
            <p className="text-indigo-400 font-mono mt-1">
              tecno.juy.ar@gmail.com
            </p>
            <p className="mt-2">
              Procesaremos tu solicitud de eliminación dentro de un plazo máximo de 7 días hábiles, eliminando de forma definitiva todos tus registros de nuestra base de datos activa y respaldos.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              5. Cambios a esta Política de Privacidad
            </h2>
            <p>
              Podemos actualizar nuestra Política de Privacidad de vez en cuando. Te notificaremos de cualquier cambio publicando la nueva Política de Privacidad en esta misma página web. Se te aconseja revisar esta Política de Privacidad periódicamente para estar al tanto de cualquier cambio.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">
              6. Contacto
            </h2>
            <p>
              Si tienes preguntas o inquietudes sobre esta Política de Privacidad, no dudes en contactarnos en:
            </p>
            <p className="text-indigo-400 font-mono mt-1">
              tecno.juy.ar@gmail.com
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} Ventu POS. Todos los derechos reservados.</span>
          <Link href="/login" className="text-indigo-400 hover:underline">
            Volver al Login
          </Link>
        </div>
      </div>
    </div>
  );
}
