import type { MealReminderId, ReminderPlanItem, ReminderSettings } from "../types/reminders";

export const defaultReminderSettings: ReminderSettings = {
  meals: {
    breakfast: { enabled: false, hour: 8, minute: 0 },
    lunch: { enabled: false, hour: 12, minute: 30 },
    dinner: { enabled: false, hour: 19, minute: 0 }
  },
  workouts: { enabled: false, weekdays: [1, 3, 5], hour: 18, minute: 0 }
};

export function cloneDefaultReminderSettings(): ReminderSettings {
  return {
    meals: {
      breakfast: { ...defaultReminderSettings.meals.breakfast },
      lunch: { ...defaultReminderSettings.meals.lunch },
      dinner: { ...defaultReminderSettings.meals.dinner }
    },
    workouts: { ...defaultReminderSettings.workouts, weekdays: [...defaultReminderSettings.workouts.weekdays] }
  };
}

export function buildReminderPlan(settings: ReminderSettings): ReminderPlanItem[] {
  const plan: ReminderPlanItem[] = [];
  for (const id of ["breakfast", "lunch", "dinner"] as const) {
    const meal = settings.meals[id];
    if (meal.enabled) plan.push({ key: `meal-${id}`, kind: "meal", hour: meal.hour, minute: meal.minute });
  }
  if (settings.workouts.enabled) {
    for (const weekday of [...settings.workouts.weekdays].sort((a, b) => a - b)) {
      plan.push({ key: `workout-${weekday}`, kind: "workout", hour: settings.workouts.hour, minute: settings.workouts.minute, weekday });
    }
  }
  return plan;
}

export function validateReminderSettings(value: unknown): value is ReminderSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReminderSettings>;
  const meals = candidate.meals;
  const workouts = candidate.workouts;
  const validTime = (setting: unknown) => {
    if (!setting || typeof setting !== "object") return false;
    const item = setting as { enabled?: unknown; hour?: unknown; minute?: unknown };
    return typeof item.enabled === "boolean" && Number.isInteger(item.hour) && Number(item.hour) >= 0 && Number(item.hour) <= 23 && Number.isInteger(item.minute) && Number(item.minute) >= 0 && Number(item.minute) <= 59;
  };
  if (!meals || !validTime(meals.breakfast) || !validTime(meals.lunch) || !validTime(meals.dinner) || !workouts || !validTime(workouts)) return false;
  return Array.isArray(workouts.weekdays) && workouts.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(workouts.weekdays).size === workouts.weekdays.length;
}

export const mealNotificationContent: Record<MealReminderId, { title: string; body: string }> = {
  breakfast: { title: "Hora de cuidar da alimentação", body: "Registre seu café da manhã no Hipertrofia." },
  lunch: { title: "Lembrete de refeição", body: "Registre seu almoço e acompanhe seus macros." },
  dinner: { title: "Feche o dia com equilíbrio", body: "Registre seu jantar no Hipertrofia." }
};
