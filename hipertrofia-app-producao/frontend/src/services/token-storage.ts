import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "hipertrofia.access-token";
let browserSessionToken: string | null = null;

export async function getStoredAccessToken(): Promise<string | null> {
  // SecureStore não possui backend web. No browser, manter apenas na memória evita
  // gravar o access token em localStorage, que é legível por JavaScript.
  if (Platform.OS === "web") return browserSessionToken;
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveAccessToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    browserSessionToken = token;
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === "web") {
    browserSessionToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
