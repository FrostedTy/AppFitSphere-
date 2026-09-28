export type NutritionResult = {
  calories: number;
  proteinGrams: number;
  carbohydratesGrams: number;
  fatGrams: number;
};

export type MealHistoryItem = NutritionResult & {
  id: string;
  source: "TEXT" | "IMAGE";
  description: string | null;
  analysisMode?: "gemini" | "mock";
  consumedAt: string;
  createdAt: string;
};

export type DailyMealHistory = {
  date: string;
  timeZone: string;
  summary: NutritionResult & { mealCount: number };
  meals: MealHistoryItem[];
};
