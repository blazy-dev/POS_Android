import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { apiConfig } from "./client";

// Adaptador de almacenamiento seguro para Supabase usando Expo SecureStore
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      // ignorar error en caso de fallo de escritura
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      // ignorar
    }
  },
};

export const supabase = createClient(apiConfig.supabaseUrl, apiConfig.supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
