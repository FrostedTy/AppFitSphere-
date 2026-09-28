import { Platform } from "react-native";

const developmentFallback = Platform.OS === "android"
  ? "http://10.0.2.2:3333"
  : "http://localhost:3333";

// A URL local só pode ser usada em desenvolvimento. Em builds standalone, ausência de
// configuração deve falhar com mensagem clara em vez de apontar para localhost.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const API_BASE_URL = (configuredApiUrl || (__DEV__ ? developmentFallback : "")).replace(/\/+$/, "");

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL não foi configurada para este build. Defina a URL HTTPS da API no ambiente EAS.");
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new Error(`Não foi possível conectar à API em ${API_BASE_URL}. Verifique se o backend está ativo e se EXPO_PUBLIC_API_URL está correto.`);
  }

  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.message || `A solicitação falhou (HTTP ${response.status}).`);
  }

  return payload as T;
}
