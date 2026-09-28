import { apiRequest } from "./api";
import type { ExerciseCatalogItem, ExerciseProgression, Workout, WorkoutExercise, WorkoutSet } from "../types/workouts";

type Page<T> = { items: T[]; page: { limit: number; offset: number; total: number } };

export function getWorkouts(token: string) {
  return apiRequest<Page<Workout>>("/api/v1/workouts?limit=100&offset=0", { token });
}

export function getWorkout(token: string, workoutId: string) {
  return apiRequest<Workout>(`/api/v1/workouts/${encodeURIComponent(workoutId)}`, { token });
}

export function createWorkout(token: string, input: { name: string; split?: string; notes?: string }) {
  return apiRequest<Workout>("/api/v1/workouts", {
    method: "POST", token,
    body: { name: input.name, ...(input.split ? { split: input.split } : {}), ...(input.notes ? { notes: input.notes } : {}) }
  });
}

export function startWorkout(token: string, workoutId: string) {
  return apiRequest<Workout>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/start`, { method: "POST", token, body: {} });
}

export function finishWorkout(token: string, workoutId: string) {
  return apiRequest<Workout>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/finish`, { method: "POST", token, body: {} });
}

export function getExerciseCatalog(token: string, search: string) {
  const searchPart = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
  return apiRequest<Page<ExerciseCatalogItem>>(`/api/v1/exercises?limit=50&offset=0${searchPart}`, { token });
}

export function createExercise(token: string, input: { name: string; muscleGroup?: string }) {
  return apiRequest<ExerciseCatalogItem>("/api/v1/exercises", {
    method: "POST", token,
    body: { name: input.name, ...(input.muscleGroup ? { muscleGroup: input.muscleGroup } : {}) }
  });
}

export function addExerciseToWorkout(token: string, workoutId: string, exerciseId: string, order: number) {
  return apiRequest<WorkoutExercise>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/exercises`, {
    method: "POST", token, body: { exerciseId, order }
  });
}

export function addWorkoutSet(token: string, workoutId: string, workoutExerciseId: string, input: {
  setNumber: number; repetitions: number; weightKg: number; restSeconds: number; completed?: boolean;
}) {
  return apiRequest<WorkoutSet>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/exercises/${encodeURIComponent(workoutExerciseId)}/sets`, {
    method: "POST", token, body: input
  });
}

export function updateWorkoutSet(token: string, workoutId: string, workoutExerciseId: string, setId: string, input: Partial<Pick<WorkoutSet, "repetitions" | "weightKg" | "restSeconds" | "completed">>) {
  return apiRequest<WorkoutSet>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/exercises/${encodeURIComponent(workoutExerciseId)}/sets/${encodeURIComponent(setId)}`, {
    method: "PATCH", token, body: input
  });
}

export function getExerciseProgression(token: string, exerciseId: string) {
  return apiRequest<ExerciseProgression>(`/api/v1/progression/exercises/${encodeURIComponent(exerciseId)}?limit=20`, { token });
}
