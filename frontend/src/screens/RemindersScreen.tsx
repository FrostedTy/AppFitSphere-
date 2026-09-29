import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  getReminderPermissionState,
  getReminderSettings,
  saveReminderSettings
} from "../services/reminders";
import { defaultReminderSettings, validateReminderSettings } from "../utils/reminder-settings";
import type { MealReminderId, ReminderPermissionState, ReminderSettings, TimeOfDay } from "../types/reminders";

const C = {
  background: "#0B100E", surface: "#131A16", raised: "#19221D", border: "#29352E",
  text: "#F4F7F4", muted: "#9BA99F", green: "#B8F36A", greenDark: "#28351E",
  blue: "#83C9FF", red: "#FF8C83"
};

const mealMeta: Array<{ id: MealReminderId; title: string; subtitle: string }> = [
  { id: "breakfast", title: "Café da manhã", subtitle: "Lembrete diário para registrar a primeira refeição" },
  { id: "lunch", title: "Almoço", subtitle: "Acompanhe a refeição do meio do dia" },
  { id: "dinner", title: "Jantar", subtitle: "Feche seu registro alimentar diário" }
];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function RemindersScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({});
  const [permission, setPermission] = useState<ReminderPermissionState>("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getReminderSettings(), getReminderPermissionState()])
      .then(([stored, currentPermission]) => {
        if (!active) return;
        setSettings(stored);
        setTimeDrafts(buildTimeDrafts(stored));
        setPermission(currentPermission);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as preferências."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const updateMeal = (id: MealReminderId, patch: Partial<ReminderSettings["meals"][MealReminderId]>) => {
    setSettings((current) => ({ ...current, meals: { ...current.meals, [id]: { ...current.meals[id], ...patch } } }));
    setMessage("");
  };

  const updateWorkout = (patch: Partial<ReminderSettings["workouts"]>) => {
    setSettings((current) => ({ ...current, workouts: { ...current.workouts, ...patch } }));
    setMessage("");
  };

  const updateTime = (key: string, value: string) => {
    const filtered = value.replace(/[^\d:]/g, "").slice(0, 5);
    setTimeDrafts((current) => ({ ...current, [key]: filtered }));
    setMessage("");
  };

  const toggleWeekday = (day: number) => {
    const selected = settings.workouts.weekdays.includes(day);
    const next = selected ? settings.workouts.weekdays.filter((item) => item !== day) : [...settings.workouts.weekdays, day];
    updateWorkout({ weekdays: next.sort((a, b) => a - b) });
  };

  const handleSave = async () => {
    setError("");
    setMessage("");
    const next: ReminderSettings = {
      meals: {
        breakfast: { ...settings.meals.breakfast },
        lunch: { ...settings.meals.lunch },
        dinner: { ...settings.meals.dinner }
      },
      workouts: { ...settings.workouts, weekdays: [...settings.workouts.weekdays] }
    };
    for (const { id } of mealMeta) {
      const time = parseTime(timeDrafts[id]);
      if (settings.meals[id].enabled && !time) {
        setError(`Confira o horário de ${mealMeta.find((item) => item.id === id)?.title.toLowerCase()} no formato HH:MM.`);
        return;
      }
      if (time) next.meals[id] = { ...next.meals[id], ...time };
    }
    const workoutTime = parseTime(timeDrafts.workout);
    if (settings.workouts.enabled && !workoutTime) {
      setError("Confira o horário do treino no formato HH:MM.");
      return;
    }
    if (workoutTime) next.workouts = { ...next.workouts, ...workoutTime };
    if (next.workouts.enabled && next.workouts.weekdays.length === 0) {
      setError("Selecione pelo menos um dia para o lembrete de treino.");
      return;
    }
    if (!validateReminderSettings(next)) {
      setError("Revise os horários e dias escolhidos.");
      return;
    }
    setSaving(true);
    try {
      const count = await saveReminderSettings(next);
      setSettings(next);
      setTimeDrafts(buildTimeDrafts(next));
      setPermission(await getReminderPermissionState());
      setMessage(count === 0 ? "Lembretes desativados e agendamentos anteriores removidos." : `${count} lembrete${count === 1 ? "" : "s"} local${count === 1 ? "" : "is"} agendado${count === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar os lembretes.");
      setPermission(await getReminderPermissionState().catch((): ReminderPermissionState => "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = mealMeta.filter(({ id }) => settings.meals[id].enabled).length + (settings.workouts.enabled ? settings.workouts.weekdays.length : 0);
  const unsupported = permission === "unsupported";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.nav}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Voltar ao Dashboard"><Text style={styles.backArrow}>‹</Text></Pressable>
            <Text style={styles.navTitle}>LEMBRETES</Text>
            <View style={styles.navBadge}><Text style={styles.navBadgeText}>NO DISPOSITIVO</Text></View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.kicker}>ROTINA COM CONSTÂNCIA</Text>
            <Text style={styles.title}>Lembretes que{ "\n" }cabem no seu dia.</Text>
            <Text style={styles.subtitle}>Escolha quando quer ser lembrado de registrar refeições e começar seus treinos.</Text>
          </View>

          {unsupported ? <View style={styles.infoCard}><Text style={styles.infoTitle}>Instale o app para usar notificações</Text><Text style={styles.infoText}>O preview Web permite revisar as configurações, mas lembretes programados precisam do app nativo em iOS ou Android.</Text></View> : null}
          {permission === "denied" ? <View style={styles.warningCard}><Text style={styles.warningTitle}>Notificações bloqueadas no dispositivo</Text><Text style={styles.warningText}>Você pode liberar os avisos nas configurações do sistema e salvar novamente.</Text><Pressable onPress={() => void Linking.openSettings()} style={styles.settingsLink}><Text style={styles.settingsLinkText}>Abrir configurações do app</Text></Pressable></View> : null}
          {error ? <ErrorCard message={error} /> : null}

          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Horários de refeição</Text><Text style={styles.sectionSubtitle}>Repetem todos os dias</Text></View><Text style={styles.sectionIndex}>01</Text></View>
          <View style={styles.cardGroup}>
            {mealMeta.map((meal, index) => (
              <View key={meal.id} style={[styles.reminderRow, index < mealMeta.length - 1 && styles.rowDivider]}>
                <View style={styles.reminderRowTop}>
                  <View style={styles.mealGlyph}><Text style={styles.mealGlyphText}>{["C", "A", "J"][index]}</Text></View>
                  <View style={styles.reminderCopy}><Text style={styles.reminderTitle}>{meal.title}</Text><Text style={styles.reminderSubtitle}>{meal.subtitle}</Text></View>
                  <Switch value={settings.meals[meal.id].enabled} onValueChange={(enabled) => updateMeal(meal.id, { enabled })} disabled={loading || saving || unsupported} trackColor={{ false: C.border, true: "#506C31" }} thumbColor={settings.meals[meal.id].enabled ? C.green : "#A7B2AA"} accessibilityLabel={`Ativar lembrete de ${meal.title}`} />
                </View>
                <View style={styles.timeRow}><Text style={styles.timeLabel}>LEMBRAR ÀS</Text><TimeInput value={timeDrafts[meal.id] ?? formatTime(settings.meals[meal.id])} onChangeText={(value) => updateTime(meal.id, value)} disabled={loading || saving || unsupported || !settings.meals[meal.id].enabled} /></View>
              </View>
            ))}
          </View>

          <View style={[styles.sectionHeader, styles.workoutHeader]}><View><Text style={styles.sectionTitle}>Horário de treino</Text><Text style={styles.sectionSubtitle}>Escolha os dias e o horário semanal</Text></View><Text style={styles.sectionIndex}>02</Text></View>
          <View style={styles.workoutCard}>
            <View style={styles.reminderRowTop}>
              <View style={styles.workoutGlyph}><Text style={styles.workoutGlyphText}>↗</Text></View>
              <View style={styles.reminderCopy}><Text style={styles.reminderTitle}>Lembrar dos treinos</Text><Text style={styles.reminderSubtitle}>Um aviso em cada dia selecionado</Text></View>
              <Switch value={settings.workouts.enabled} onValueChange={(enabled) => updateWorkout({ enabled })} disabled={loading || saving || unsupported} trackColor={{ false: C.border, true: "#506C31" }} thumbColor={settings.workouts.enabled ? C.green : "#A7B2AA"} accessibilityLabel="Ativar lembretes de treinos" />
            </View>
            <Text style={styles.daysLabel}>DIAS DA SEMANA</Text>
            <View style={styles.daysRow}>{weekdays.map((label, day) => {
              const selected = settings.workouts.weekdays.includes(day);
              return <Pressable key={label} onPress={() => toggleWeekday(day)} disabled={loading || saving || unsupported || !settings.workouts.enabled} style={[styles.dayButton, selected && styles.dayButtonSelected, (loading || saving || unsupported || !settings.workouts.enabled) && styles.controlsDimmed]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Treino ${label}`}><Text style={[styles.dayButtonText, selected && styles.dayButtonTextSelected]}>{label}</Text></Pressable>;
            })}</View>
            <View style={styles.timeRow}><Text style={styles.timeLabel}>LEMBRAR ÀS</Text><TimeInput value={timeDrafts.workout ?? formatTime(settings.workouts)} onChangeText={(value) => updateTime("workout", value)} disabled={loading || saving || unsupported || !settings.workouts.enabled} /></View>
          </View>

          <View style={styles.privacyNote}><View style={styles.privacyGlyph}><Text style={styles.privacyGlyphText}>✓</Text></View><Text style={styles.privacyText}>Os horários ficam salvos neste dispositivo e são executados localmente. Não enviamos seus horários a um serviço externo.</Text></View>

          <Pressable onPress={() => void handleSave()} disabled={loading || saving || unsupported} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (loading || saving || unsupported) && styles.disabled]} accessibilityRole="button">
            {saving ? <ActivityIndicator color={C.background} /> : <Text style={styles.saveButtonText}>{loading ? "Carregando preferências…" : enabledCount ? `Salvar ${enabledCount} lembrete${enabledCount === 1 ? "" : "s"}` : "Salvar e desativar lembretes"}</Text>}
            {!saving ? <Text style={styles.saveArrow}>↗</Text> : null}
          </Pressable>
          {message ? <Text style={styles.successMessage}>{message}</Text> : null}
          <Text style={styles.footnote}>OS HORÁRIOS SEGUEM O FUSO LOCAL DO SEU CELULAR</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TimeInput({ value, onChangeText, disabled }: { value: string; onChangeText: (value: string) => void; disabled: boolean }) {
  return <View style={[styles.timeInputWrap, disabled && styles.controlsDimmed]}><TextInput value={value} onChangeText={onChangeText} placeholder="HH:MM" placeholderTextColor="#718077" keyboardType="numbers-and-punctuation" maxLength={5} editable={!disabled} style={styles.timeInput} accessibilityLabel="Horário no formato hora e minuto" /><Text style={styles.clockGlyph}>◷</Text></View>;
}

function ErrorCard({ message }: { message: string }) {
  return <View style={styles.errorCard}><Text style={styles.errorGlyph}>!</Text><Text style={styles.errorText}>{message}</Text></View>;
}

function buildTimeDrafts(settings: ReminderSettings) {
  return {
    breakfast: formatTime(settings.meals.breakfast),
    lunch: formatTime(settings.meals.lunch),
    dinner: formatTime(settings.meals.dinner),
    workout: formatTime(settings.workouts)
  };
}

function formatTime(time: TimeOfDay) {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function parseTime(value?: string): TimeOfDay | null {
  if (!value || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 35 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  backArrow: { color: C.text, fontSize: 24, lineHeight: 28 },
  navTitle: { color: C.muted, fontSize: 12, letterSpacing: 1, fontWeight: "900" },
  navBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.greenDark },
  navBadgeText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  pressed: { opacity: 0.7 },
  hero: { marginTop: 20, marginBottom: 20 },
  kicker: { color: C.green, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5, marginTop: 6 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  infoCard: { borderRadius: 12, backgroundColor: "#17242B", borderWidth: 1, borderColor: "#294657", padding: 14, marginBottom: 12 },
  infoTitle: { color: C.blue, fontSize: 13, fontWeight: "900" },
  infoText: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  warningCard: { borderRadius: 12, backgroundColor: "#302819", borderWidth: 1, borderColor: "#66542E", padding: 14, marginBottom: 12 },
  warningTitle: { color: "#F2CF83", fontSize: 13, fontWeight: "900" },
  warningText: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  settingsLink: { paddingVertical: 8, alignSelf: "flex-start" },
  settingsLinkText: { color: C.green, fontSize: 12, fontWeight: "900" },
  errorCard: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, backgroundColor: "#321D1D", borderWidth: 1, borderColor: "#663936", marginBottom: 12 },
  errorGlyph: { color: C.red, fontWeight: "900", fontSize: 14 },
  errorText: { flex: 1, color: "#FFC2BD", fontSize: 12, lineHeight: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  sectionSubtitle: { color: C.muted, fontSize: 12, marginTop: 2 },
  sectionIndex: { color: C.green, fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  cardGroup: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  reminderRow: { padding: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  reminderRowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  mealGlyph: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  mealGlyphText: { color: C.green, fontSize: 14, fontWeight: "900" },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  reminderSubtitle: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  timeLabel: { color: C.muted, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
  timeInputWrap: { minWidth: 100, height: 40, flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, paddingHorizontal: 10 },
  timeInput: { flex: 1, minWidth: 60, color: C.text, fontSize: 14, fontWeight: "900", paddingVertical: 0, textAlign: "center" },
  clockGlyph: { color: C.green, fontSize: 14, marginLeft: 6 },
  workoutHeader: { marginTop: 20 },
  workoutCard: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16 },
  workoutGlyph: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#17242B", alignItems: "center", justifyContent: "center" },
  workoutGlyphText: { color: C.blue, fontSize: 16, fontWeight: "900" },
  daysLabel: { color: C.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  daysRow: { flexDirection: "row", gap: 6 },
  dayButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.background },
  dayButtonSelected: { backgroundColor: C.greenDark, borderColor: "#526B34" },
  dayButtonText: { color: C.muted, fontSize: 11, fontWeight: "800" },
  dayButtonTextSelected: { color: C.green },
  controlsDimmed: { opacity: 0.45 },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 20 },
  privacyGlyph: { width: 24, height: 24, borderRadius: 8, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  privacyGlyphText: { color: C.green, fontSize: 12, fontWeight: "900" },
  privacyText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 50, borderRadius: 12, paddingHorizontal: 16, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveButtonText: { color: C.background, fontSize: 14, fontWeight: "900" },
  saveArrow: { color: C.background, fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  successMessage: { color: C.green, fontSize: 12, textAlign: "center", marginTop: 10 },
  footnote: { color: "#68766D", fontSize: 10, letterSpacing: 0.8, fontWeight: "800", textAlign: "center", marginTop: 20 }
});
