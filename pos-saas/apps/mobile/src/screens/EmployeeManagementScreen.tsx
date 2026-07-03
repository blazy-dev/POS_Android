import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FormField } from '../components/form/FormField';
import { getAppMeta } from '../database';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import {
  listEmployees,
  saveEmployee,
  deleteEmployee,
  isPinTaken,
  isEmailTaken,
  type EmployeeInput,
} from '../modules/employees';
import type { UserRecord } from '../database/types';

const ROLE_PRESETS = [
  {
    value: 'cashier',
    label: 'Cajero',
    desc: 'Registra ventas y abre/cierra caja.',
  },
  {
    value: 'supervisor',
    label: 'Supervisor',
    desc: 'Gestión de stock e inventario.',
  },
  {
    value: 'admin',
    label: 'Administrador',
    desc: 'Acceso total y configuración.',
  },
];

type EmployeeManagementScreenProps = {
  onBack: () => void;
};

export function EmployeeManagementScreen({
  onBack,
}: EmployeeManagementScreenProps) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const tenantId = user?.tenant_id || 'local';
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);

  // Estados del listado
  const [employees, setEmployees] = useState<UserRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Estados del formulario
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<UserRecord | null>(
    null,
  );
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState('cashier');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar lista de empleados
  const fetchEmployees = async () => {
    try {
      setLoadingList(true);
      const list = await listEmployees(db, tenantId);
      setEmployees(list);
    } catch (err) {
      console.error('Error al listar empleados:', err);
      Alert.alert('Error', 'No se pudieron obtener los empleados locales.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  useEffect(() => {
    async function loadOwnerEmail() {
      try {
        const cached = await getAppMeta<string>(
          db,
          `tenant_owner_email_${tenantId}`,
        );
        setOwnerEmail(cached);
      } catch (err) {
        console.error('Error al cargar el correo principal del tenant:', err);
      }
    }

    void loadOwnerEmail();
  }, [db, tenantId]);

  // Abrir formulario para agregar nuevo
  const handleNewEmployee = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormEmail('');
    setFormPin('');
    setFormRole('cashier');
    setFormError(null);
    setShowForm(true);
  };

  // Abrir formulario para editar
  const handleEditEmployee = (emp: UserRecord) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormPin(emp.pin ?? '');
    setFormRole(emp.role);
    setFormError(null);
    setShowForm(true);
  };

  // Eliminar/desactivar empleado
  const handleDeleteEmployee = (emp: UserRecord) => {
    Alert.alert(
      'Confirmar baja',
      `¿Estás seguro de que querés dar de baja a ${emp.name}? Ya no podrá iniciar sesión.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Dar de baja',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployee(db, emp.id, tenantId);
              await fetchEmployees();
            } catch (err) {
              console.error('Error al eliminar empleado:', err);
              Alert.alert('Error', 'No se pudo realizar la baja del empleado.');
            }
          },
        },
      ],
    );
  };

  // Guardar datos
  const handleSave = async () => {
    setFormError(null);

    const name = formName.trim();
    const email = formEmail.trim();
    const pin = formPin.trim();

    if (!name) {
      setFormError('El nombre completo es obligatorio.');
      return;
    }

    if (!email) {
      setFormError('El correo electrónico es obligatorio.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError('Ingresá un correo electrónico válido.');
      return;
    }

    if (pin && (pin.length !== 4 || isNaN(Number(pin)))) {
      setFormError(
        'El PIN debe ser un código numérico de exactamente 4 dígitos.',
      );
      return;
    }

    try {
      setSaving(true);

      // Verificar unicidad de email
      const emailTaken = await isEmailTaken(
        db,
        email,
        tenantId,
        editingEmployee?.id,
      );
      if (emailTaken) {
        setFormError('Este correo ya esta registrado por otro empleado.');
        setSaving(false);
        return;
      }

      if (pin) {
        const pinTaken = await isPinTaken(
          db,
          pin,
          tenantId,
          editingEmployee?.id,
        );
        if (pinTaken) {
          setFormError(
            'Este PIN ya está siendo utilizado por otro empleado activo.',
          );
          setSaving(false);
          return;
        }
      }

      const input: EmployeeInput = {
        name,
        email,
        pin: pin || null,
        role: formRole,
        tenantId,
      };

      await saveEmployee(db, input, editingEmployee?.id);
      setShowForm(false);
      await fetchEmployees();
    } catch (err) {
      console.error('Error al guardar empleado:', err);
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el empleado.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Formulario de Alta/Edición
  if (showForm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setShowForm(false)}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Cancelar</Text>
          </Pressable>
          <Text style={styles.title}>
            {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
          </Text>
          <Text style={styles.subtitle}>
            {editingEmployee
              ? 'Modificá los datos del miembro del equipo.'
              : 'Registrá un nuevo usuario para operar en el dispositivo.'}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <FormField
              label="Nombre completo *"
              value={formName}
              onChangeText={setFormName}
              placeholder="Juan Pérez"
              required
            />

            <FormField
              label="Correo electrónico *"
              value={formEmail}
              onChangeText={setFormEmail}
              placeholder="juan@comercio.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              required
            />

            <FormField
              label="PIN de acceso rápido (4 dígitos)"
              value={formPin}
              onChangeText={setFormPin}
              placeholder="Ej: 1234"
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry={false}
              hint="PIN numérico opcional para iniciar sesión rápido en la app móvil."
            />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rol en el comercio *</Text>
              <View style={styles.roleContainer}>
                {ROLE_PRESETS.map((role) => {
                  const active = formRole === role.value;
                  return (
                    <Pressable
                      key={role.value}
                      style={[styles.roleCard, active && styles.roleCardActive]}
                      onPress={() => setFormRole(role.value)}
                    >
                      <Text
                        style={[
                          styles.roleLabel,
                          active && styles.roleLabelActive,
                        ]}
                      >
                        {role.label}
                      </Text>
                      <Text style={styles.roleDesc}>{role.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {formError ? (
              <Text style={styles.errorText}>{formError}</Text>
            ) : null}

            <View style={styles.formActions}>
              <Pressable
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar miembro</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Vista del listado principal
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver a Ajustes</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Gestión de Empleados</Text>
            <Text style={styles.subtitle}>
              Administrá los cajeros, supervisores y sus credenciales de acceso
              local.
            </Text>
          </View>
          <Pressable style={styles.newButton} onPress={handleNewEmployee}>
            <Text style={styles.newButtonText}>+ Nuevo</Text>
          </Pressable>
        </View>
      </View>

      {loadingList ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : employees.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No hay empleados registrados además de tu cuenta principal.
          </Text>
          <Pressable
            style={styles.newButtonOutline}
            onPress={handleNewEmployee}
          >
            <Text style={styles.newButtonOutlineText}>
              Registrar primer empleado
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {employees.map((emp) => {
            // No permitir auto-eliminar o auto-editar el admin OAuth activo directamente desde aquí
            const isSelf = emp.email === user?.email;
            const isOwner = ownerEmail !== null && emp.email === ownerEmail;
            return (
              <View key={emp.id} style={styles.employeeCard}>
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>
                    {emp.name}{' '}
                    {isSelf && <Text style={styles.selfTag}>(Tú)</Text>}
                  </Text>
                  <Text style={styles.empEmail}>{emp.email}</Text>
                  <View style={styles.tagsRow}>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>
                        {emp.role === 'admin'
                          ? 'Administrador'
                          : emp.role === 'supervisor'
                            ? 'Supervisor'
                            : 'Cajero'}
                      </Text>
                    </View>
                    {emp.pin ? (
                      <View style={styles.pinTag}>
                        <Text style={styles.pinTagText}>PIN: {emp.pin}</Text>
                      </View>
                    ) : (
                      <View style={styles.noPinTag}>
                        <Text style={styles.noPinTagText}>Sin PIN</Text>
                      </View>
                    )}
                  </View>
                </View>

                {!isSelf && (
                  <View style={styles.empActions}>
                    <Pressable
                      style={styles.editButton}
                      onPress={() => handleEditEmployee(emp)}
                    >
                      <Text style={styles.editButtonText}>Editar</Text>
                    </Pressable>
                    {!isOwner ? (
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDeleteEmployee(emp)}
                      >
                        <Text style={styles.deleteButtonText}>Baja</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.protectedBadge}>
                        <Text style={styles.protectedBadgeText}>Principal</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 6,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    headerTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginTop: 4,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
      gap: 16,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    listContainer: {
      padding: 20,
      gap: 12,
    },
    employeeCard: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    empInfo: {
      flex: 1,
      gap: 4,
    },
    empName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    selfTag: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    empEmail: {
      color: colors.textMuted,
      fontSize: 12,
    },
    tagsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    roleTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.12)'
        : 'rgba(4, 151, 191, 0.08)',
    },
    roleTagText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },
    pinTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.12)'
        : 'rgba(1, 203, 99, 0.08)',
    },
    pinTagText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '700',
    },
    noPinTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(0, 0, 0, 0.04)',
    },
    noPinTagText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    empActions: {
      flexDirection: 'row',
      gap: 8,
    },
    editButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    editButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    deleteButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 77, 77, 0.2)' : 'rgba(211, 47, 47, 0.2)',
      backgroundColor: isDark
        ? 'rgba(255, 77, 77, 0.02)'
        : 'rgba(211, 47, 47, 0.02)',
    },
    deleteButtonText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 12,
      fontWeight: '700',
    },
    protectedBadge: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.18)',
    },
    protectedBadgeText: {
      color: isDark ? '#FBBF24' : '#92400E',
      fontSize: 12,
      fontWeight: '700',
    },
    newButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
    },
    newButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    newButtonOutline: {
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 4,
    },
    newButtonOutlineText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    formContainer: {
      padding: 20,
    },
    card: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    formGroup: {
      gap: spacing.sm,
    },
    label: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    roleContainer: {
      gap: 10,
      marginTop: 4,
    },
    roleCard: {
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
      gap: 4,
    },
    roleCardActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.08)',
    },
    roleLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    roleLabelActive: {
      color: colors.primary,
    },
    roleDesc: {
      color: colors.textMuted,
      fontSize: 12,
    },
    formActions: {
      marginTop: 8,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
  });
