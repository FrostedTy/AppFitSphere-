import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  addExerciseToWorkout,
  addWorkoutSet,
  createExercise,
  createWorkout,
  finishWorkout,
  getExerciseCatalog,
  getExerciseProgression,
  getWorkout,
  getWorkouts,
  startWorkout,
  updateWorkoutSet
} from "../services/workouts";
import type { ExerciseCatalogItem, ExerciseProgression, Workout, WorkoutExercise, WorkoutSet } from "../types/workouts";

const C = {
  background: "#0B100E", surface: "#131A16", raised: "#19221D", border: "#29352E",
  text: "#F4F7F4", muted: "#9BA99F", green: "#B8F36A", red: "#FF8C83",
  orange: "#FFC46B", blue: "#83C9FF"
};

type SetDraft = { weight: string; repetitions: string; rest: string };

export function WorkoutsScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSplit, setWorkoutSplit] = useState("");
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>({});
  const [progression, setProgression] = useState<Record<string, ExerciseProgression | null>>({});
  const [progressionLoading, setProgressionLoading] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getWorkouts(token);
      setWorkouts(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar seus treinos.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void loadWorkouts(); }, [loadWorkouts]);

  const openWorkout = async (workout: Workout) => {
    setLoading(true);
    setError("");
    try {
      setSelectedWorkout(await getWorkout(token, workout.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o treino.");
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedWorkout = async (workoutId = selectedWorkout?.id) => {
    if (!workoutId) return;
    const updated = await getWorkout(token, workoutId);
    setSelectedWorkout(updated);
    setWorkouts((current) => current.map((workout) => workout.id === updated.id ? updated : workout));
  };

  const handleCreateWorkout = async () => {
    if (!workoutName.trim()) {
      setError("Dê um nome para o treino, por exemplo: Treino A — Peito.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createWorkout(token, { name: workoutName.trim(), split: workoutSplit.trim() || undefined });
      setWorkoutName("");
      setWorkoutSplit("");
      setShowCreateForm(false);
      setSelectedWorkout(created);
      await loadWorkouts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o treino.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartOrFinish = async () => {
    if (!selectedWorkout) return;
    setSaving(true);
    setError("");
    try {
      const updated = selectedWorkout.startedAt
        ? await finishWorkout(token, selectedWorkout.id)
        : await startWorkout(token, selectedWorkout.id);
      setSelectedWorkout(updated);
      setWorkouts((current) => current.map((workout) => workout.id === updated.id ? updated : workout));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o estado do treino.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddExercise = async (exercise: ExerciseCatalogItem) => {
    if (!selectedWorkout) return;
    setSaving(true);
    setError("");
    try {
      await addExerciseToWorkout(token, selectedWorkout.id, exercise.id, selectedWorkout.exercises.length);
      await refreshSelectedWorkout();
      setShowExercisePicker(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar o exercício.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSet = async (item: WorkoutExercise) => {
    if (!selectedWorkout) return;
    const draft = drafts[item.id] ?? { weight: "", repetitions: "", rest: "90" };
    const weightKg = parseDecimal(draft.weight);
    const repetitions = parseWholeNumber(draft.repetitions);
    const restSeconds = parseWholeNumber(draft.rest);
    if (weightKg === null || repetitions === null || restSeconds === null || weightKg < 0 || repetitions < 0 || restSeconds < 0) {
      setError("Preencha carga, repetições e descanso com valores numéricos válidos.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addWorkoutSet(token, selectedWorkout.id, item.id, {
        setNumber: item.sets.length + 1,
        weightKg,
        repetitions,
        restSeconds,
        completed: false
      });
      setDrafts((current) => ({ ...current, [item.id]: { weight: draft.weight, repetitions: "", rest: draft.rest } }));
      await refreshSelectedWorkout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a série.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSet = async (item: WorkoutExercise, set: WorkoutSet) => {
    if (!selectedWorkout) return;
    setSaving(true);
    setError("");
    try {
      await updateWorkoutSet(token, selectedWorkout.id, item.id, set.id, { completed: !set.completed });
      await refreshSelectedWorkout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a série.");
    } finally {
      setSaving(false);
    }
  };

  const handleProgression = async (exerciseId: string) => {
    setProgressionLoading(exerciseId);
    setError("");
    try {
      const result = await getExerciseProgression(token, exerciseId);
      setProgression((current) => ({ ...current, [exerciseId]: result }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a progressão.");
    } finally {
      setProgressionLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.nav}>
            <Pressable onPress={() => selectedWorkout ? setSelectedWorkout(null) : onBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={selectedWorkout ? "Voltar para lista de treinos" : "Voltar ao menu"}>
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
            <Text style={styles.navTitle}>GESTÃO DE TREINOS</Text>
            <View style={styles.navBadge}><Text style={styles.navBadgeText}>FORÇA</Text></View>
          </View>

          {selectedWorkout ? (
            <WorkoutDetail
              workout={selectedWorkout}
              saving={saving}
              drafts={drafts}
              progression={progression}
              progressionLoading={progressionLoading}
              error={error}
              onStartOrFinish={() => void handleStartOrFinish()}
              onAddExercise={() => setShowExercisePicker(true)}
              onDraftChange={(itemId, key, value) => setDrafts((current) => ({
                ...current,
                [itemId]: { ...(current[itemId] ?? { weight: "", repetitions: "", rest: "90" }), [key]: value }
              }))}
              onAddSet={(item) => void handleAddSet(item)}
              onToggleSet={(item, set) => void handleToggleSet(item, set)}
              onProgression={(exerciseId) => void handleProgression(exerciseId)}
              onDismissError={() => setError("")}
            />
          ) : (
            <>
              <View style={styles.headingBlock}>
                <Text style={styles.kicker}>PROGRESSÃO DE CARGA</Text>
                <Text style={styles.title}>Treino com{ "\n" }intenção.</Text>
                <Text style={styles.subtitle}>Organize sua divisão, registre cada série e acompanhe sua evolução de carga.</Text>
              </View>

              <View style={styles.listHeader}>
                <View><Text style={styles.sectionTitle}>Suas fichas</Text><Text style={styles.sectionSubtitle}>{workouts.length} {workouts.length === 1 ? "treino" : "treinos"} cadastrados</Text></View>
                <Pressable onPress={() => { setShowCreateForm((visible) => !visible); setError(""); }} style={({ pressed }) => [styles.addWorkoutButton, pressed && styles.pressed]} accessibilityRole="button">
                  <Text style={styles.plus}>＋</Text><Text style={styles.addWorkoutText}>Novo treino</Text>
                </Pressable>
              </View>

              {showCreateForm ? (
                <View style={styles.createCard}>
                  <Text style={styles.formTitle}>Monte uma nova ficha</Text>
                  <Field label="NOME DO TREINO" value={workoutName} onChangeText={setWorkoutName} placeholder="Ex.: Peito e tríceps" editable={!saving} />
                  <Field label="DIVISÃO (OPCIONAL)" value={workoutSplit} onChangeText={setWorkoutSplit} placeholder="Ex.: ABCDE / Treino A" editable={!saving} maxLength={20} />
                  <Pressable onPress={() => void handleCreateWorkout()} disabled={saving} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}>
                    {saving ? <ActivityIndicator color={C.background} /> : <Text style={styles.primaryButtonText}>Criar ficha e adicionar exercícios</Text>}
                  </Pressable>
                </View>
              ) : null}

              {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}
              {loading ? <View style={styles.loading}><ActivityIndicator color={C.green} /><Text style={styles.muted}>Carregando treinos...</Text></View> : workouts.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyMark}>＋</Text><Text style={styles.emptyTitle}>Seu próximo treino começa aqui</Text><Text style={styles.emptyCopy}>Crie uma ficha e escolha exercícios do catálogo para começar a acompanhar suas séries.</Text></View>
              ) : (
                <View style={styles.workoutList}>
                  {workouts.map((workout) => <WorkoutListCard key={workout.id} workout={workout} onPress={() => void openWorkout(workout)} />)}
                </View>
              )}
              <Text style={styles.footerNote}>SEU HISTÓRICO FICA VINCULADO À SUA CONTA</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {selectedWorkout ? (
        <ExercisePickerModal
          visible={showExercisePicker}
          token={token}
          adding={saving}
          onClose={() => setShowExercisePicker(false)}
          onAdd={(exercise) => void handleAddExercise(exercise)}
          onCreateAndAdd={async (input) => {
            setSaving(true);
            setError("");
            try {
              const exercise = await createExercise(token, input);
              await handleAddExercise(exercise);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Não foi possível criar o exercício.");
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function WorkoutListCard({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const done = Boolean(workout.finishedAt);
  const active = Boolean(workout.startedAt) && !done;
  const exerciseCount = workout.exercises.length;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.workoutCard, pressed && styles.cardPressed]} accessibilityRole="button">
      <View style={styles.workoutCardTop}>
        <View style={styles.workoutLetter}><Text style={styles.workoutLetterText}>{workout.split?.slice(-1) || "↗"}</Text></View>
        <View style={[styles.statusPill, done ? styles.statusDone : active ? styles.statusActive : styles.statusScheduled]}>
          <View style={[styles.statusDot, done && styles.dotDone, active && styles.dotActive]} />
          <Text style={[styles.statusText, active && styles.activeText]}>{done ? "CONCLUÍDO" : active ? "EM ANDAMENTO" : "PLANEJADO"}</Text>
        </View>
      </View>
      <Text style={styles.workoutName}>{workout.name}</Text>
      <View style={styles.workoutMetaRow}>
        <Text style={styles.workoutMeta}>{workout.split || "DIVISÃO LIVRE"}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.workoutMeta}>{exerciseCount} {exerciseCount === 1 ? "exercício" : "exercícios"}</Text>
      </View>
      <View style={styles.cardBottom}><Text style={styles.openWorkout}>Abrir ficha</Text><Text style={styles.arrow}>↗</Text></View>
    </Pressable>
  );
}

function WorkoutDetail({
  workout,
  saving,
  drafts,
  progression,
  progressionLoading,
  error,
  onStartOrFinish,
  onAddExercise,
  onDraftChange,
  onAddSet,
  onToggleSet,
  onProgression,
  onDismissError
}: {
  workout: Workout;
  saving: boolean;
  drafts: Record<string, SetDraft>;
  progression: Record<string, ExerciseProgression | null>;
  progressionLoading: string | null;
  error: string;
  onStartOrFinish: () => void;
  onAddExercise: () => void;
  onDraftChange: (itemId: string, key: keyof SetDraft, value: string) => void;
  onAddSet: (item: WorkoutExercise) => void;
  onToggleSet: (item: WorkoutExercise, set: WorkoutSet) => void;
  onProgression: (exerciseId: string) => void;
  onDismissError: () => void;
}) {
  const completed = Boolean(workout.finishedAt);
  const started = Boolean(workout.startedAt);
  return (
    <>
      <View style={styles.detailHeading}>
        <Text style={styles.kicker}>{workout.split || "FICHA DE TREINO"}</Text>
        <Text style={styles.detailTitle}>{workout.name}</Text>
        <Text style={styles.subtitle}>{workout.exercises.length} exercícios · {workout.exercises.reduce((sum, item) => sum + item.sets.length, 0)} séries registradas</Text>
      </View>
      <Pressable onPress={onStartOrFinish} disabled={saving || completed} style={({ pressed }) => [styles.sessionButton, completed && styles.sessionButtonDone, pressed && !saving && !completed && styles.pressed, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={completed ? C.green : C.background} /> : <><Text style={[styles.sessionButtonText, completed && styles.sessionButtonDoneText]}>{completed ? "Treino concluído" : started ? "Finalizar treino" : "Iniciar sessão de treino"}</Text><Text style={[styles.sessionButtonArrow, completed && styles.sessionButtonDoneText]}>{completed ? "✓" : started ? "■" : "▶"}</Text></>}
      </Pressable>
      {error ? <ErrorBanner message={error} onDismiss={onDismissError} /> : null}

      <View style={styles.exerciseSectionHeader}>
        <View><Text style={styles.sectionTitle}>Exercícios</Text><Text style={styles.sectionSubtitle}>Registre carga, reps e descanso por série</Text></View>
        <Pressable onPress={onAddExercise} style={styles.addExerciseButton}><Text style={styles.plus}>＋</Text></Pressable>
      </View>

      {workout.exercises.length === 0 ? (
        <View style={styles.emptyExercise}><Text style={styles.emptyTitle}>Adicione o primeiro exercício</Text><Text style={styles.emptyCopy}>Escolha um exercício do catálogo ou crie um novo para esta ficha.</Text><Pressable onPress={onAddExercise} style={styles.inlineLink}><Text style={styles.inlineLinkText}>Abrir catálogo</Text></Pressable></View>
      ) : workout.exercises.map((item, index) => (
        <ExerciseCard
          key={item.id}
          item={item}
          index={index}
          draft={drafts[item.id] ?? { weight: "", repetitions: "", rest: "90" }}
          saving={saving}
          progression={progression[item.exerciseId]}
          progressionLoading={progressionLoading === item.exerciseId}
          onDraftChange={(key, value) => onDraftChange(item.id, key, value)}
          onAddSet={() => onAddSet(item)}
          onToggleSet={(set) => onToggleSet(item, set)}
          onProgression={() => onProgression(item.exerciseId)}
        />
      ))}
      <Text style={styles.footerNote}>MARQUE CADA SÉRIE CONCLUÍDA PARA ACOMPANHAR A PROGRESSÃO</Text>
    </>
  );
}

function ExerciseCard({
  item,
  index,
  draft,
  saving,
  progression,
  progressionLoading,
  onDraftChange,
  onAddSet,
  onToggleSet,
  onProgression
}: {
  item: WorkoutExercise;
  index: number;
  draft: SetDraft;
  saving: boolean;
  progression?: ExerciseProgression | null;
  progressionLoading: boolean;
  onDraftChange: (key: keyof SetDraft, value: string) => void;
  onAddSet: () => void;
  onToggleSet: (set: WorkoutSet) => void;
  onProgression: () => void;
}) {
  const completedCount = item.sets.filter((set) => set.completed).length;
  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseTitleRow}>
        <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>{String(index + 1).padStart(2, "0")}</Text></View>
        <View style={styles.exerciseTitleCopy}><Text style={styles.exerciseName}>{item.exercise.name}</Text><Text style={styles.exerciseMuscle}>{item.exercise.muscleGroup || "Grupo muscular não definido"}</Text></View>
        <Text style={styles.setCounter}>{completedCount}/{item.sets.length}</Text>
      </View>

      {item.sets.length > 0 ? (
        <View style={styles.setList}>
          <View style={styles.setHeader}><Text style={styles.setHeaderText}>SÉRIE</Text><Text style={styles.setHeaderText}>CARGA</Text><Text style={styles.setHeaderText}>REPS</Text><Text style={styles.setHeaderText}>DESCANSO</Text><Text style={styles.setHeaderText}>OK</Text></View>
          {item.sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>S{set.setNumber}</Text>
              <Text style={styles.setValue}>{set.weightKg === null ? "—" : `${formatNumber(Number(set.weightKg))} kg`}</Text>
              <Text style={styles.setValue}>{set.repetitions ?? "—"}</Text>
              <Text style={styles.setValue}>{set.restSeconds === null ? "—" : `${set.restSeconds}s`}</Text>
              <Pressable onPress={() => onToggleSet(set)} disabled={saving} style={[styles.setCheck, set.completed && styles.setCheckDone]} accessibilityRole="checkbox" accessibilityState={{ checked: set.completed }} accessibilityLabel={`Marcar série ${set.setNumber} como ${set.completed ? "não concluída" : "concluída"}`}>
                <Text style={[styles.setCheckText, set.completed && styles.setCheckTextDone]}>{set.completed ? "✓" : ""}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : <Text style={styles.noSetsText}>Nenhuma série registrada ainda.</Text>}

      <Text style={styles.newSetLabel}>NOVA SÉRIE {item.sets.length + 1}</Text>
      <View style={styles.setEntryRow}>
        <MiniField label="CARGA (KG)" value={draft.weight} onChangeText={(value) => onDraftChange("weight", value)} keyboardType="decimal-pad" placeholder="0" editable={!saving} />
        <MiniField label="REPS" value={draft.repetitions} onChangeText={(value) => onDraftChange("repetitions", value)} keyboardType="number-pad" placeholder="8" editable={!saving} />
        <MiniField label="DESC. (S)" value={draft.rest} onChangeText={(value) => onDraftChange("rest", value)} keyboardType="number-pad" placeholder="90" editable={!saving} />
      </View>
      <Pressable onPress={onAddSet} disabled={saving} style={({ pressed }) => [styles.addSetButton, pressed && styles.pressed, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={C.green} size="small" /> : <><Text style={styles.addSetPlus}>＋</Text><Text style={styles.addSetText}>Registrar série</Text></>}
      </Pressable>
      <Pressable onPress={onProgression} disabled={progressionLoading} style={styles.progressionButton}>
        {progressionLoading ? <ActivityIndicator color={C.green} size="small" /> : <><Text style={styles.progressionGlyph}>↗</Text><Text style={styles.progressionText}>{progression ? "Atualizar progressão" : "Ver progressão de carga"}</Text></>}
      </Pressable>
      {progression ? <ProgressionCard progression={progression} /> : null}
    </View>
  );
}

function ProgressionCard({ progression }: { progression: ExerciseProgression }) {
  const latest = progression.progression.latestMaxWeightKg;
  const delta = progression.progression.deltaKg;
  return (
    <View style={styles.progressionCard}>
      <Text style={styles.progressionTitle}>EVOLUÇÃO DE CARGA MÁXIMA</Text>
      {latest === null ? <Text style={styles.progressionEmpty}>Conclua uma sessão com carga registrada para ver sua evolução.</Text> : (
        <View style={styles.progressionValues}>
          <View><Text style={styles.progressionCaption}>CARGA ATUAL</Text><Text style={styles.progressionNumber}>{formatNumber(latest)}<Text style={styles.progressionUnit}> kg</Text></Text></View>
          {delta !== null ? <View style={styles.deltaBox}><Text style={[styles.deltaValue, delta < 0 && styles.deltaNegative]}>{delta > 0 ? "+" : ""}{formatNumber(delta)} kg</Text><Text style={styles.progressionCaption}>{progression.progression.percentChange === null ? "DESDE A SESSÃO ANTERIOR" : `${formatNumber(progression.progression.percentChange)}% VS. ANTERIOR`}</Text></View> : <Text style={styles.progressionEmpty}>Mais uma sessão concluída libera a comparação.</Text>}
        </View>
      )}
      <Text style={styles.progressionSessions}>{progression.sessions.length} {progression.sessions.length === 1 ? "sessão concluída" : "sessões concluídas"} no histórico</Text>
    </View>
  );
}

function ExercisePickerModal({
  visible,
  token,
  adding,
  onClose,
  onAdd,
  onCreateAndAdd
}: {
  visible: boolean;
  token: string;
  adding: boolean;
  onClose: () => void;
  onAdd: (exercise: ExerciseCatalogItem) => void;
  onCreateAndAdd: (input: { name: string; muscleGroup?: string }) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<ExerciseCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("");

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      getExerciseCatalog(token, search)
        .then((result) => { if (active) setExercises(result.items); })
        .catch((cause) => { if (active) setModalError(cause instanceof Error ? cause.message : "Não foi possível buscar exercícios."); })
        .finally(() => { if (active) setLoading(false); });
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [token, search, visible]);

  const create = async () => {
    if (!newName.trim()) {
      setModalError("Informe o nome do exercício.");
      return;
    }
    setModalError("");
    await onCreateAndAdd({ name: newName.trim(), muscleGroup: newMuscle.trim() || undefined });
    setNewName("");
    setNewMuscle("");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <StatusBar barStyle="light-content" backgroundColor={C.background} />
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <View><Text style={styles.kicker}>MONTE SUA FICHA</Text><Text style={styles.modalTitle}>Adicionar exercício</Text></View>
            <Pressable onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>×</Text></Pressable>
          </View>
          <Field label="BUSCAR NO CATÁLOGO" value={search} onChangeText={setSearch} placeholder="Ex.: supino, agachamento..." autoCapitalize="none" />
          {modalError ? <ErrorBanner message={modalError} onDismiss={() => setModalError("")} /> : null}
          {loading ? <View style={styles.loading}><ActivityIndicator color={C.green} /><Text style={styles.muted}>Buscando...</Text></View> : exercises.length === 0 ? <Text style={styles.muted}>Nenhum exercício encontrado. Você pode criar um novo abaixo.</Text> : (
            <View style={styles.catalogList}>
              {exercises.map((exercise) => (
                <Pressable key={exercise.id} onPress={() => onAdd(exercise)} disabled={adding} style={({ pressed }) => [styles.catalogRow, pressed && styles.pressed]}>
                  <View style={styles.catalogIcon}><Text style={styles.catalogIconText}>＋</Text></View>
                  <View style={styles.catalogCopy}><Text style={styles.catalogName}>{exercise.name}</Text><Text style={styles.catalogMuscle}>{exercise.muscleGroup || "Grupo não definido"}</Text></View>
                  <Text style={styles.catalogArrow}>↗</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.createExerciseCard}>
            <Text style={styles.formTitle}>Não achou? Crie um exercício</Text>
            <Field label="NOME" value={newName} onChangeText={setNewName} placeholder="Ex.: Remada unilateral" editable={!adding} />
            <Field label="GRUPO MUSCULAR" value={newMuscle} onChangeText={setNewMuscle} placeholder="Ex.: Costas" editable={!adding} />
            <Pressable onPress={() => void create()} disabled={adding} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed, adding && styles.disabled]}>
              {adding ? <ActivityIndicator color={C.green} /> : <Text style={styles.secondaryActionText}>Criar e adicionar à ficha</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#718077" selectionColor={C.green} autoCorrect={false} /></View>;
}

function MiniField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.miniField}><Text style={styles.miniFieldLabel}>{label}</Text><TextInput {...props} style={styles.miniInput} placeholderTextColor="#718077" selectionColor={C.green} /></View>;
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <Pressable onPress={onDismiss} style={styles.errorBanner} accessibilityRole="button" accessibilityLabel={`Erro: ${message}. Toque para dispensar`}><Text style={styles.errorMark}>!</Text><Text style={styles.errorMessage}>{message}</Text><Text style={styles.errorClose}>×</Text></Pressable>;
}

function parseDecimal(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  backArrow: { color: C.text, fontSize: 24, lineHeight: 28 },
  navTitle: { color: C.muted, fontSize: 12, letterSpacing: 1, fontWeight: "800" },
  navBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#26341D" },
  navBadgeText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  headingBlock: { marginTop: 20, marginBottom: 20 },
  kicker: { color: C.green, fontSize: 11, letterSpacing: 1.2, fontWeight: "800" },
  title: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5, marginTop: 6 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: C.muted, fontSize: 12, marginTop: 2 },
  addWorkoutButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  plus: { color: C.background, fontSize: 18, fontWeight: "900" },
  addWorkoutText: { color: C.background, fontSize: 12, fontWeight: "900" },
  createCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  formTitle: { color: C.text, fontSize: 15, fontWeight: "900", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { color: C.muted, fontSize: 10, letterSpacing: 0.8, fontWeight: "900", marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, color: C.text, paddingHorizontal: 14, fontSize: 14 },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginTop: 6, paddingHorizontal: 14 },
  primaryButtonText: { color: C.background, fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 },
  loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 18 },
  emptyCard: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 20, marginTop: 10 },
  emptyMark: { color: C.green, fontSize: 28 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "900", marginTop: 10, textAlign: "center" },
  emptyCopy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
  workoutList: { gap: 12 },
  workoutCard: { borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  cardPressed: { borderColor: "#576B4A" },
  workoutCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  workoutLetter: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  workoutLetterText: { color: C.background, fontSize: 18, fontWeight: "900" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statusScheduled: { backgroundColor: "#222D26" },
  statusActive: { backgroundColor: "#29381F" },
  statusDone: { backgroundColor: "#1D2D35" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  dotActive: { backgroundColor: C.green },
  dotDone: { backgroundColor: C.blue },
  statusText: { color: C.muted, fontSize: 10, letterSpacing: 0.4, fontWeight: "900" },
  activeText: { color: C.green },
  workoutName: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: "900", marginTop: 12 },
  workoutMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  workoutMeta: { color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green },
  cardBottom: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  openWorkout: { color: C.green, fontSize: 12, fontWeight: "800" },
  arrow: { color: C.green, fontWeight: "900", fontSize: 16 },
  footerNote: { color: "#68766D", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textAlign: "center", marginTop: 24 },
  detailHeading: { marginTop: 20, marginBottom: 16 },
  detailTitle: { color: C.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 6 },
  sessionButton: { minHeight: 50, borderRadius: 12, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  sessionButtonDone: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sessionButtonText: { color: C.background, fontSize: 14, fontWeight: "900" },
  sessionButtonDoneText: { color: C.green },
  sessionButtonArrow: { color: C.background, fontSize: 14, fontWeight: "900" },
  errorBanner: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, backgroundColor: "#321D1D", borderRadius: 10, borderWidth: 1, borderColor: "#663936", marginBottom: 12 },
  errorMark: { color: C.red, fontWeight: "900", fontSize: 14 },
  errorMessage: { color: "#FFC2BD", fontSize: 12, lineHeight: 18, flex: 1 },
  errorClose: { color: "#FFC2BD", fontSize: 18, fontWeight: "900" },
  exerciseSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addExerciseButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  emptyExercise: { padding: 20, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, alignItems: "center" },
  inlineLink: { paddingVertical: 8, paddingHorizontal: 12, marginTop: 4 },
  inlineLinkText: { color: C.green, fontSize: 12, fontWeight: "900" },
  exerciseCard: { padding: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  exerciseTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  exerciseNumber: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#27351E", alignItems: "center", justifyContent: "center" },
  exerciseNumberText: { color: C.green, fontSize: 12, fontWeight: "900" },
  exerciseTitleCopy: { flex: 1 },
  exerciseName: { color: C.text, fontSize: 14, fontWeight: "900" },
  exerciseMuscle: { color: C.muted, fontSize: 11, marginTop: 2 },
  setCounter: { color: C.green, fontSize: 12, fontWeight: "900" },
  setList: { borderRadius: 10, borderWidth: 1, borderColor: C.border, marginTop: 12, overflow: "hidden" },
  setHeader: { minHeight: 32, backgroundColor: C.raised, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 8 },
  setHeaderText: { color: C.muted, fontSize: 10, letterSpacing: 0.3, fontWeight: "900", textAlign: "center", flex: 1 },
  setRow: { minHeight: 44, borderTopWidth: 1, borderTopColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 8 },
  setNumber: { color: C.green, fontSize: 12, fontWeight: "900", textAlign: "center", flex: 1 },
  setValue: { color: C.text, fontSize: 12, textAlign: "center", flex: 1 },
  setCheck: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: "#56645A", alignItems: "center", justifyContent: "center", flex: 1, maxWidth: 30 },
  setCheckDone: { backgroundColor: C.green, borderColor: C.green },
  setCheckText: { color: C.background, fontSize: 14, fontWeight: "900" },
  setCheckTextDone: { color: C.background },
  noSetsText: { color: C.muted, fontSize: 12, marginTop: 10 },
  newSetLabel: { color: C.muted, fontSize: 10, letterSpacing: 0.8, fontWeight: "900", marginTop: 14, marginBottom: 6 },
  setEntryRow: { flexDirection: "row", gap: 8 },
  miniField: { flex: 1 },
  miniFieldLabel: { color: C.muted, fontSize: 9, letterSpacing: 0.2, fontWeight: "900", marginBottom: 4 },
  miniInput: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, color: C.text, paddingHorizontal: 6, textAlign: "center", fontSize: 13 },
  addSetButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: "#42543A", backgroundColor: "#1B2817", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  addSetPlus: { color: C.green, fontSize: 16, fontWeight: "900" },
  addSetText: { color: C.green, fontSize: 12, fontWeight: "900" },
  progressionButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 },
  progressionGlyph: { color: C.blue, fontSize: 14, fontWeight: "900" },
  progressionText: { color: C.blue, fontSize: 11, fontWeight: "800" },
  progressionCard: { padding: 12, borderRadius: 10, backgroundColor: "#17242B", borderWidth: 1, borderColor: "#29414C", marginTop: 8 },
  progressionTitle: { color: C.blue, fontSize: 10, letterSpacing: 0.6, fontWeight: "900" },
  progressionValues: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  progressionCaption: { color: C.muted, fontSize: 9, letterSpacing: 0.4, fontWeight: "800" },
  progressionNumber: { color: C.text, fontSize: 22, fontWeight: "900", marginTop: 2 },
  progressionUnit: { color: C.muted, fontSize: 11 },
  deltaBox: { alignItems: "flex-end" },
  deltaValue: { color: C.green, fontSize: 14, fontWeight: "900", marginBottom: 2 },
  deltaNegative: { color: C.orange },
  progressionEmpty: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  progressionSessions: { color: C.muted, fontSize: 10, marginTop: 8 },
  modalSafe: { flex: 1, backgroundColor: C.background },
  modalContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: "900", marginTop: 4 },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  modalCloseText: { color: C.muted, fontSize: 24, fontWeight: "900" },
  catalogList: { gap: 8, marginTop: 4, marginBottom: 16 },
  catalogRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  catalogIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#27351E", alignItems: "center", justifyContent: "center" },
  catalogIconText: { color: C.green, fontSize: 16, fontWeight: "900" },
  catalogCopy: { flex: 1 },
  catalogName: { color: C.text, fontSize: 13, fontWeight: "800" },
  catalogMuscle: { color: C.muted, fontSize: 10, marginTop: 2 },
  catalogArrow: { color: C.green, fontSize: 14, fontWeight: "900" },
  createExerciseCard: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginTop: 10 },
  secondaryAction: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: "#42543A", alignItems: "center", justifyContent: "center", marginTop: 6 },
  secondaryActionText: { color: C.green, fontSize: 12, fontWeight: "900" }
});
