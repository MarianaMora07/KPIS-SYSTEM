"use client";

import { createContext, useContext } from "react";
import type { AppRole } from "@/types/database";
import {
  canManageUsers as checkCanManageUsers,
  hasPermissionInList,
} from "@/lib/auth/role-matrix";

interface PermissionsContextValue {
  permissions: string[];
  rol: AppRole | null;
  isDemoMode: boolean;
  canManageUsers: boolean;
  hasPermission: (codigo: string) => boolean;
  /** true si el permiso está concedido o estamos en modo demo sin Supabase */
  can: (codigo: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: [],
  rol: null,
  isDemoMode: false,
  canManageUsers: false,
  hasPermission: () => false,
  can: () => false,
});

export function PermissionsProvider({
  permissions,
  rol,
  isDemoMode = false,
  children,
}: {
  permissions: string[];
  rol: AppRole | null;
  isDemoMode?: boolean;
  children: React.ReactNode;
}) {
  const canManageUsers = checkCanManageUsers(rol);

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        rol,
        isDemoMode,
        canManageUsers,
        hasPermission: (codigo) => hasPermissionInList(permissions, codigo),
        can: (codigo) =>
          isDemoMode || hasPermissionInList(permissions, codigo),
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
