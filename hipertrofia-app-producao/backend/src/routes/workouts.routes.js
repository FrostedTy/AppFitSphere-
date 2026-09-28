import { Router } from "express";
import {
  addExerciseToWorkout,
  addSet,
  createExercise,
  createWorkout,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  finishWorkout,
  getExerciseProgression,
  getWorkout,
  listExercises,
  listWorkouts,
  removeExerciseFromWorkout,
  startWorkout,
  updateExercise,
  updateSet,
  updateWorkout,
  updateWorkoutExercise
} from "../controllers/workouts.controller.js";

const router = Router();

// Catálogo global de exercícios (a API inteira já está protegida no app Express).
router.get("/exercises", listExercises);
router.post("/exercises", createExercise);
router.patch("/exercises/:exerciseId", updateExercise);
router.delete("/exercises/:exerciseId", deleteExercise);

// A identidade do dono é req.auth.userId, nunca um userId informado pelo cliente.
router.get("/progression/exercises/:exerciseId", getExerciseProgression);
router.get("/workouts", listWorkouts);
router.post("/workouts", createWorkout);
router.get("/workouts/:workoutId", getWorkout);
router.patch("/workouts/:workoutId", updateWorkout);
router.delete("/workouts/:workoutId", deleteWorkout);
router.post("/workouts/:workoutId/start", startWorkout);
router.post("/workouts/:workoutId/finish", finishWorkout);

router.post("/workouts/:workoutId/exercises", addExerciseToWorkout);
router.patch("/workouts/:workoutId/exercises/:workoutExerciseId", updateWorkoutExercise);
router.delete("/workouts/:workoutId/exercises/:workoutExerciseId", removeExerciseFromWorkout);
router.post("/workouts/:workoutId/exercises/:workoutExerciseId/sets", addSet);
router.patch("/workouts/:workoutId/exercises/:workoutExerciseId/sets/:setId", updateSet);
router.delete("/workouts/:workoutId/exercises/:workoutExerciseId/sets/:setId", deleteSet);

export default router;
