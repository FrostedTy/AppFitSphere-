export type MealReminderId = "breakfast" | "lunch" | "dinner";

export type TimeOfDay = {
  hour: number;
  minute: number;
};

export type MealReminderSetting = TimeOfDay & {
  enabled: boolean;
};

export type WorkoutReminderSetting = TimeOfDay & {
  enabled: boolean;
  /** Dias locais da semana no padrão JS: domingo=0 até sábado=6. */
  weekdays: number[];
};

export type ReminderSettings = {
  meals: Record<MealReminderId, MealReminderSetting>;
  workouts: WorkoutReminderSetting;
};

export type ReminderPermissionState = "granted" | "denied" | "unknown" | "unsupported";

export type ReminderPlanItem = {
  key: string;
  kind: "meal" | "workout";
  hour: number;
  minute: number;
  weekday?: number;
};
