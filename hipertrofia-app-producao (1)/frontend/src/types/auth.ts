export type AuthUser = {
  id: string;
  name: string;
  email: string;
  calorieGoal: number | null;
  proteinGoalG: number | string | null;
  carbohydrateGoalG: number | string | null;
  fatGoalG: number | string | null;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type CurrentUserResponse = {
  user: AuthUser;
};
