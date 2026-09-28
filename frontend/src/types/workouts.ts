export type WorkoutSet = {
  id: string;
  setNumber: number;
  repetitions: number | null;
  weightKg: number | string | null;
  restSeconds: number | null;
  completed: boolean;
  createdAt?: string;
};

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  muscleGroup: string | null;
  instructions: string | null;
};

export type WorkoutExercise = {
  id: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  notes: string | null;
  exercise: ExerciseCatalogItem;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  name: string;
  split: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  notes: string | null;
  createdAt: string;
  exercises: WorkoutExercise[];
};

export type ExerciseProgression = {
  exercise: Pick<ExerciseCatalogItem, "id" | "name" | "muscleGroup">;
  sessions: Array<{
    workoutId: string;
    workoutName: string;
    performedAt: string;
    setCount: number;
    totalRepetitions: number;
    maxWeightKg: number | null;
    totalVolumeKg: number;
    sets: Array<Pick<WorkoutSet, "id" | "setNumber" | "repetitions" | "weightKg" | "restSeconds">>;
  }>;
  progression: {
    comparedSessions: number;
    previousMaxWeightKg: number | null;
    latestMaxWeightKg: number | null;
    deltaKg: number | null;
    percentChange: number | null;
  };
};
