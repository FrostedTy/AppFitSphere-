import { apiRequest } from "./api";
import type { AuthResponse, CurrentUserResponse } from "../types/auth";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export function register(input: RegisterInput) {
  return apiRequest<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: input
  });
}

export function login(input: LoginInput) {
  return apiRequest<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: input
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUserResponse>("/api/v1/auth/me", { token });
}
