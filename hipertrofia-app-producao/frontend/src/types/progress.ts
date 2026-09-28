export type BodyWeightEntry = {
  id: string;
  weightKg: number;
  measuredAt: string;
  notes: string | null;
  createdAt: string;
};

export type BodyWeightHistory = {
  entries: BodyWeightEntry[];
  limit: number;
};
