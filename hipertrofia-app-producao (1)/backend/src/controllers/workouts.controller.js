import { z } from "zod";
import prisma from "../lib/prisma.js";
import { asyncHandler, HttpError, parseOrThrow, uuidSchema } from "../lib/http.js";

const dateTimeSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));

const workoutCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  split: z.string().trim().max(20).nullable().optional(),
  scheduledAt: dateTimeSchema.nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).strict();

const workoutUpdateSchema = workoutCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar."
);

const exerciseCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().trim().max(80).nullable().optional(),
  instructions: z.string().trim().max(5000).nullable().optional()
}).strict();

const exerciseUpdateSchema = exerciseCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar."
);

const addWorkoutExerciseSchema = z.object({
  exerciseId: z.string().uuid(),
  order: z.number().int().min(0).max(500).optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).strict();

const updateWorkoutExerciseSchema = z.object({
  order: z.number().int().min(0).max(500).optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

const setCreateSchema = z.object({
  setNumber: z.number().int().min(1).max(100),
  repetitions: z.number().int().min(0).max(1000).nullable().optional(),
  weightKg: z.number().finite().min(0).max(2000).nullable().optional(),
  restSeconds: z.number().int().min(0).max(86_400).nullable().optional(),
  completed: z.boolean().optional()
}).strict();

const setUpdateSchema = setCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar."
);

const exerciseListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  muscleGroup: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100_000).default(0)
});

const workoutListQuerySchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  status: z.enum(["scheduled", "in_progress", "completed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0)
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: "O parâmetro from deve ser anterior ou igual a to."
});

const progressionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const workoutInclude = {
  exercises: {
    orderBy: { order: "asc" },
    include: {
      exercise: true,
      sets: { orderBy: { setNumber: "asc" } }
    }
  }
};

const serializeSet = (set) => ({
  ...set,
  weightKg: set.weightKg === null ? null : Number(set.weightKg)
});

const serializeWorkout = (workout) => ({
  ...workout,
  exercises: workout.exercises?.map((item) => ({
    ...item,
    sets: item.sets?.map(serializeSet)
  }))
});

const ensureUser = async (userId) => {
  const id = parseOrThrow(uuidSchema, userId, "userId inválido.");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new HttpError(404, "Usuário não encontrado.");
  return id;
};

const ensureWorkout = async (userId, workoutId) => {
  const id = parseOrThrow(uuidSchema, workoutId, "workoutId inválido.");
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
    select: { id: true, startedAt: true, finishedAt: true }
  });
  if (!workout) throw new HttpError(404, "Treino não encontrado para este usuário.");
  return workout;
};

const ensureWorkoutExercise = async (userId, workoutId, workoutExerciseId) => {
  await ensureWorkout(userId, workoutId);
  const id = parseOrThrow(uuidSchema, workoutExerciseId, "workoutExerciseId inválido.");
  const item = await prisma.workoutExercise.findFirst({
    where: { id, workoutId },
    select: { id: true }
  });
  if (!item) throw new HttpError(404, "Exercício não encontrado neste treino.");
  return item;
};

export const listExercises = asyncHandler(async (req, res) => {
  const query = parseOrThrow(exerciseListQuerySchema, req.query);
  const where = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.muscleGroup ? { muscleGroup: { equals: query.muscleGroup, mode: "insensitive" } } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.exercise.findMany({ where, orderBy: { name: "asc" }, take: query.limit, skip: query.offset }),
    prisma.exercise.count({ where })
  ]);
  res.json({ items, page: { limit: query.limit, offset: query.offset, total } });
});

export const createExercise = asyncHandler(async (req, res) => {
  const data = parseOrThrow(exerciseCreateSchema, req.body);
  const exercise = await prisma.exercise.create({ data });
  res.status(201).json(exercise);
});

export const updateExercise = asyncHandler(async (req, res) => {
  const id = parseOrThrow(uuidSchema, req.params.exerciseId, "exerciseId inválido.");
  const data = parseOrThrow(exerciseUpdateSchema, req.body);
  const existing = await prisma.exercise.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Exercício não encontrado.");
  const exercise = await prisma.exercise.update({ where: { id }, data });
  res.json(exercise);
});

export const deleteExercise = asyncHandler(async (req, res) => {
  const id = parseOrThrow(uuidSchema, req.params.exerciseId, "exerciseId inválido.");
  const existing = await prisma.exercise.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Exercício não encontrado.");
  await prisma.exercise.delete({ where: { id } });
  res.status(204).end();
});

export const listWorkouts = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const query = parseOrThrow(workoutListQuerySchema, req.query);
  const where = {
    userId,
    ...(query.from || query.to ? {
      scheduledAt: {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {})
      }
    } : {}),
    ...(query.status === "scheduled" ? { startedAt: null, finishedAt: null } : {}),
    ...(query.status === "in_progress" ? { startedAt: { not: null }, finishedAt: null } : {}),
    ...(query.status === "completed" ? { finishedAt: { not: null } } : {})
  };
  const [items, total] = await prisma.$transaction([
    prisma.workout.findMany({
      where,
      include: workoutInclude,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      take: query.limit,
      skip: query.offset
    }),
    prisma.workout.count({ where })
  ]);
  res.json({ items: items.map(serializeWorkout), page: { limit: query.limit, offset: query.offset, total } });
});

export const createWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const data = parseOrThrow(workoutCreateSchema, req.body);
  const workout = await prisma.workout.create({
    data: { ...data, userId },
    include: workoutInclude
  });
  res.status(201).json(serializeWorkout(workout));
});

export const getWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: workoutInclude
  });
  if (!workout) throw new HttpError(404, "Treino não encontrado para este usuário.");
  res.json(serializeWorkout(workout));
});

export const updateWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const data = parseOrThrow(workoutUpdateSchema, req.body);
  const existing = await prisma.workout.findFirst({ where: { id: workoutId, userId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Treino não encontrado para este usuário.");
  const workout = await prisma.workout.update({ where: { id: workoutId }, data, include: workoutInclude });
  res.json(serializeWorkout(workout));
});

export const deleteWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const existing = await prisma.workout.findFirst({ where: { id: workoutId, userId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Treino não encontrado para este usuário.");
  await prisma.workout.delete({ where: { id: workoutId } });
  res.status(204).end();
});

export const startWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const workout = await ensureWorkout(userId, workoutId);
  if (workout.finishedAt) throw new HttpError(409, "Um treino finalizado não pode ser iniciado novamente.");
  if (workout.startedAt) throw new HttpError(409, "O treino já foi iniciado.");
  const transition = await prisma.workout.updateMany({
    where: { id: workoutId, userId, startedAt: null, finishedAt: null },
    data: { startedAt: new Date() },
  });
  if (transition.count !== 1) throw new HttpError(409, "O estado do treino mudou; atualize os dados e tente novamente.");
  const updated = await prisma.workout.findFirst({ where: { id: workoutId, userId }, include: workoutInclude });
  res.json(serializeWorkout(updated));
});

export const finishWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const workout = await ensureWorkout(userId, workoutId);
  if (!workout.startedAt) throw new HttpError(409, "Inicie o treino antes de finalizá-lo.");
  if (workout.finishedAt) throw new HttpError(409, "O treino já foi finalizado.");
  const transition = await prisma.workout.updateMany({
    where: { id: workoutId, userId, startedAt: { not: null }, finishedAt: null },
    data: { finishedAt: new Date() },
  });
  if (transition.count !== 1) throw new HttpError(409, "O estado do treino mudou; atualize os dados e tente novamente.");
  const updated = await prisma.workout.findFirst({ where: { id: workoutId, userId }, include: workoutInclude });
  res.json(serializeWorkout(updated));
});

export const addExerciseToWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  await ensureWorkout(userId, workoutId);
  const data = parseOrThrow(addWorkoutExerciseSchema, req.body);
  const exercise = await prisma.exercise.findUnique({ where: { id: data.exerciseId }, select: { id: true } });
  if (!exercise) throw new HttpError(404, "Exercício do catálogo não encontrado.");

  const order = data.order ?? await prisma.workoutExercise.count({ where: { workoutId } });
  const item = await prisma.workoutExercise.create({
    data: { workoutId, exerciseId: data.exerciseId, order, notes: data.notes },
    include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } }
  });
  res.status(201).json(item);
});

export const updateWorkoutExercise = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const itemId = parseOrThrow(uuidSchema, req.params.workoutExerciseId, "workoutExerciseId inválido.");
  await ensureWorkoutExercise(userId, workoutId, itemId);
  const data = parseOrThrow(updateWorkoutExerciseSchema, req.body);
  const item = await prisma.workoutExercise.update({
    where: { id: itemId }, data, include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } }
  });
  res.json(item);
});

export const removeExerciseFromWorkout = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const itemId = parseOrThrow(uuidSchema, req.params.workoutExerciseId, "workoutExerciseId inválido.");
  await ensureWorkoutExercise(userId, workoutId, itemId);
  await prisma.workoutExercise.delete({ where: { id: itemId } });
  res.status(204).end();
});

export const addSet = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const itemId = parseOrThrow(uuidSchema, req.params.workoutExerciseId, "workoutExerciseId inválido.");
  await ensureWorkoutExercise(userId, workoutId, itemId);
  const data = parseOrThrow(setCreateSchema, req.body);
  const set = await prisma.workoutSet.create({ data: { ...data, workoutExerciseId: itemId } });
  res.status(201).json(set);
});

export const updateSet = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const itemId = parseOrThrow(uuidSchema, req.params.workoutExerciseId, "workoutExerciseId inválido.");
  const setId = parseOrThrow(uuidSchema, req.params.setId, "setId inválido.");
  await ensureWorkoutExercise(userId, workoutId, itemId);
  const existing = await prisma.workoutSet.findFirst({ where: { id: setId, workoutExerciseId: itemId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Série não encontrada neste exercício.");
  const data = parseOrThrow(setUpdateSchema, req.body);
  const set = await prisma.workoutSet.update({ where: { id: setId }, data });
  res.json(set);
});

export const deleteSet = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const workoutId = parseOrThrow(uuidSchema, req.params.workoutId, "workoutId inválido.");
  const itemId = parseOrThrow(uuidSchema, req.params.workoutExerciseId, "workoutExerciseId inválido.");
  const setId = parseOrThrow(uuidSchema, req.params.setId, "setId inválido.");
  await ensureWorkoutExercise(userId, workoutId, itemId);
  const existing = await prisma.workoutSet.findFirst({ where: { id: setId, workoutExerciseId: itemId }, select: { id: true } });
  if (!existing) throw new HttpError(404, "Série não encontrada neste exercício.");
  await prisma.workoutSet.delete({ where: { id: setId } });
  res.status(204).end();
});

/**
 * Histórico por sessão: volume = soma(carga x reps) das séries concluídas.
 * A comparação entre as duas sessões mais recentes mostra a variação da carga máxima.
 */
export const getExerciseProgression = asyncHandler(async (req, res) => {
  const userId = await ensureUser(req.auth.userId);
  const exerciseId = parseOrThrow(uuidSchema, req.params.exerciseId, "exerciseId inválido.");
  const query = parseOrThrow(progressionQuerySchema, req.query);
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) throw new HttpError(404, "Exercício não encontrado.");

  const workouts = await prisma.workout.findMany({
    where: {
      userId,
      finishedAt: { not: null },
      exercises: {
        some: {
          exerciseId,
          sets: { some: { completed: true } }
        }
      }
    },
    orderBy: [{ finishedAt: "desc" }, { startedAt: "desc" }, { createdAt: "desc" }],
    take: query.limit,
    include: {
      exercises: {
        where: { exerciseId },
        include: {
          sets: {
            where: { completed: true },
            orderBy: { setNumber: "asc" }
          }
        }
      }
    }
  });

  const sessions = workouts.map((workout) => {
    const sets = workout.exercises.flatMap((item) => item.sets).map((set) => ({
      id: set.id,
      setNumber: set.setNumber,
      repetitions: set.repetitions,
      weightKg: set.weightKg === null ? null : Number(set.weightKg),
      restSeconds: set.restSeconds
    }));
    const weightedSets = sets.filter((set) => set.weightKg !== null);
    const maxWeightKg = weightedSets.length ? Math.max(...weightedSets.map((set) => set.weightKg)) : null;
    const totalVolumeKg = sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.repetitions ?? 0), 0);
    const totalRepetitions = sets.reduce((sum, set) => sum + (set.repetitions ?? 0), 0);

    return {
      workoutId: workout.id,
      workoutName: workout.name,
      performedAt: workout.finishedAt ?? workout.startedAt ?? workout.createdAt,
      setCount: sets.length,
      totalRepetitions,
      maxWeightKg,
      totalVolumeKg: Number(totalVolumeKg.toFixed(2)),
      sets
    };
  }).reverse();

  const previous = sessions.at(-2);
  const latest = sessions.at(-1);
  const deltaKg = previous?.maxWeightKg !== null && latest?.maxWeightKg !== null && previous && latest
    ? Number((latest.maxWeightKg - previous.maxWeightKg).toFixed(2))
    : null;
  const percentChange = previous?.maxWeightKg > 0 && latest?.maxWeightKg !== null
    ? Number((((latest.maxWeightKg - previous.maxWeightKg) / previous.maxWeightKg) * 100).toFixed(2))
    : null;

  res.json({
    exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup },
    sessions,
    progression: {
      comparedSessions: previous && latest ? 2 : sessions.length,
      previousMaxWeightKg: previous?.maxWeightKg ?? null,
      latestMaxWeightKg: latest?.maxWeightKg ?? null,
      deltaKg,
      percentChange
    }
  });
});
