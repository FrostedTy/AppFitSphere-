import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { getDailyMealHistory } from "../services/nutrition";
import { createBodyWeightEntry, getBodyWeightHistory } from "../services/progress";
import type { AuthUser } from "../types/auth";
import type { DailyMealHistory, NutritionResult } from "../types/nutrition";
import type { BodyWeightEntry } from "../types/progress";

const C = {
  background: "#0B100E", surface: "#131A16", raised: "#19221D", border: "#29352E",
  text: "#F4F7F4", muted: "#9BA99F", green: "#B8F36A", greenDark: "#28351E",
  blue: "#83C9FF", orange: "#FFC46B", red: "#FF8C83"
};

export function DashboardScreen({
  token,
  user,
  onOpenNutrition,
  onOpenWorkouts,
  onOpenReminders,
  onLogout
}: {
  token: string;
  user: AuthUser;
  onOpenNutrition: () => void;
  onOpenWorkouts: () => void;
  onOpenReminders: () => void;
  onLogout: () => void;
}) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const today = useMemo(() => dateKeyAt(new Date(), timeZone), [timeZone]);
  const [daily, setDaily] = useState<DailyMealHistory | null>(null);
  const [weightEntries, setWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [weightLoading, setWeightLoading] = useState(true);
  const [dailyError, setDailyError] = useState("");
  const [weightError, setWeightError] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightMessage, setWeightMessage] = useState("");

  const loadDaily = useCallback(async () => {
    setDailyLoading(true);
    setDailyError("");
    try {
      const history = await getDailyMealHistory(token, today, timeZone);
      setDaily(history);
    } catch (cause) {
      setDailyError(cause instanceof Error ? cause.message : "Não foi possível carregar o resumo alimentar.");
    } finally {
      setDailyLoading(false);
    }
  }, [token, today, timeZone]);

  const loadWeight = useCallback(async () => {
    setWeightLoading(true);
    setWeightError("");
    try {
      const history = await getBodyWeightHistory(token, 30);
      setWeightEntries(history.entries);
    } catch (cause) {
      setWeightError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico de peso.");
    } finally {
      setWeightLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDaily();
    void loadWeight();
  }, [loadDaily, loadWeight]);

  const handleSaveWeight = async () => {
    const weightKg = parseWeight(weightInput);
    if (weightKg === null || weightKg < 20 || weightKg > 500) {
      setWeightMessage("Informe um peso entre 20 e 500 kg, com até duas casas decimais.");
      return;
    }
    setSavingWeight(true);
    setWeightMessage("");
    setWeightError("");
    try {
      const created = await createBodyWeightEntry(token, weightKg);
      setWeightEntries((current) => [...current, created].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt)).slice(-30));
      setWeightInput("");
      setWeightMessage("Pesagem salva no seu histórico.");
    } catch (cause) {
      setWeightMessage(cause instanceof Error ? cause.message : "Não foi possível salvar sua pesagem.");
    } finally {
      setSavingWeight(false);
    }
  };

  const caloriesGoal = numericGoal(user.calorieGoal);
  const consumed = daily?.summary;
  const firstName = user.name.trim().split(/\s+/)[0] || "Olá";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>H</Text></View>
              <View><Text style={styles.brandName}>HIPERTROFIA</Text><Text style={styles.brandSub}>FITNESS & NUTRIÇÃO</Text></View>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={onOpenReminders} style={({ pressed }) => [styles.remindersButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Configurar lembretes de refeições e treinos">
                <Text style={styles.remindersGlyph}>◷</Text><Text style={styles.remindersLabel}>LEMBRETES</Text>
              </Pressable>
              <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]} accessibilityRole="button">
                <Text style={styles.logoutText}>SAIR</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.greetingRow}>
            <View style={styles.greetingCopy}>
              <Text style={styles.kicker}>{formatLongDate(today)}</Text>
              <Text style={styles.greeting}>Vamos evoluir, {firstName}.</Text>
              <Text style={styles.subGreeting}>Consistência hoje. Resultado no longo prazo.</Text>
            </View>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>HOJE</Text></View>
          </View>

          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Nutrição de hoje</Text><Text style={styles.sectionSub}>Ingestão registrada no diário alimentar</Text></View>
            <Pressable onPress={onOpenNutrition} style={styles.textLink}><Text style={styles.textLinkLabel}>Ver diário  ↗</Text></Pressable>
          </View>

          {dailyError ? <ErrorPanel message={dailyError} onRetry={() => void loadDaily()} /> : null}
          <View style={styles.calorieCard}>
            <View style={styles.calorieHeader}>
              <View><Text style={styles.cardEyebrow}>CALORIAS CONSUMIDAS</Text><Text style={styles.calorieValue}>{dailyLoading || dailyError || !daily ? "—" : formatInteger(consumed?.calories ?? 0)}<Text style={styles.calorieUnit}> kcal</Text></Text></View>
              <View style={styles.calorieIcon}><Text style={styles.calorieIconText}>KCAL</Text></View>
            </View>
            <View style={styles.calorieProgressTrack}><View style={[styles.calorieProgressFill, { width: !dailyLoading && !dailyError && caloriesGoal && consumed ? `${Math.min(100, (consumed.calories / caloriesGoal) * 100)}%` : "0%" }]} /></View>
            <View style={styles.calorieFoot}>
              <Text style={styles.calorieFootText}>{dailyLoading || dailyError || !daily ? "Resumo indisponível" : caloriesGoal ? `${formatInteger(Math.max(0, caloriesGoal - (consumed?.calories ?? 0)))} kcal restantes` : "Meta calórica não configurada"}</Text>
              <Text style={styles.calorieTarget}>{caloriesGoal ? `META ${formatInteger(caloriesGoal)} KCAL` : ""}</Text>
            </View>
          </View>

          <View style={styles.macroGrid}>
            <MacroCard label="PROTEÍNA" value={dailyLoading || dailyError || !daily ? null : consumed?.proteinGrams ?? 0} goal={numericGoal(user.proteinGoalG)} accent={C.green} />
            <MacroCard label="CARBOIDRATOS" value={dailyLoading || dailyError || !daily ? null : consumed?.carbohydratesGrams ?? 0} goal={numericGoal(user.carbohydrateGoalG)} accent={C.orange} />
            <MacroCard label="GORDURAS" value={dailyLoading || dailyError || !daily ? null : consumed?.fatGrams ?? 0} goal={numericGoal(user.fatGoalG)} accent={C.blue} />
          </View>
          {!dailyLoading && !dailyError && (daily?.summary.mealCount ?? 0) === 0 ? (
            <Pressable onPress={onOpenNutrition} style={styles.emptyNutrition}>
              <View style={styles.emptyNutritionGlyph}><Text style={styles.emptyNutritionPlus}>＋</Text></View>
              <View style={styles.emptyNutritionCopy}><Text style={styles.emptyNutritionTitle}>Nenhuma refeição registrada</Text><Text style={styles.emptyNutritionSub}>Adicione uma refeição para atualizar seus totais.</Text></View>
              <Text style={styles.textLinkLabel}>↗</Text>
            </Pressable>
          ) : null}

          <View style={[styles.sectionHeading, styles.weightSectionHeading]}>
            <View><Text style={styles.sectionTitle}>Evolução de peso</Text><Text style={styles.sectionSub}>Pesagens registradas no seu histórico</Text></View>
            <View style={styles.weightUnitBadge}><Text style={styles.weightUnitText}>KG</Text></View>
          </View>
          {weightError ? <ErrorPanel message={weightError} onRetry={() => void loadWeight()} /> : null}
          <View style={styles.weightCard}>
            {weightLoading ? <View style={styles.weightLoading}><ActivityIndicator color={C.green} /><Text style={styles.sectionSub}>Carregando seu histórico...</Text></View> : weightEntries.length === 0 ? (
              <View style={styles.noWeightData}>
                <View style={styles.scaleIcon}><Text style={styles.scaleIconText}>↗</Text></View>
                <Text style={styles.noWeightTitle}>Seu gráfico começa na primeira pesagem</Text>
                <Text style={styles.noWeightText}>Registre seu peso para visualizar a evolução ao longo do tempo. Nenhum dado foi estimado.</Text>
              </View>
            ) : (
              <>
                <View style={styles.weightSummary}>
                  <View><Text style={styles.cardEyebrow}>PESO MAIS RECENTE</Text><Text style={styles.latestWeight}>{formatWeight(weightEntries[weightEntries.length - 1].weightKg)}<Text style={styles.latestWeightUnit}> kg</Text></Text><Text style={styles.weightDate}>{formatShortDate(weightEntries[weightEntries.length - 1].measuredAt)}</Text></View>
                  <WeightDelta entries={weightEntries} />
                </View>
                <WeightBarChart entries={weightEntries.slice(-7)} />
                <Text style={styles.chartCaption}>ÚLTIMAS {Math.min(7, weightEntries.length)} PESAGENS · ESCALA AJUSTADA ÀS MEDIÇÕES</Text>
              </>
            )}
          </View>

          <View style={styles.addWeightCard}>
            <View style={styles.addWeightCopy}><Text style={styles.addWeightTitle}>Registrar pesagem</Text><Text style={styles.addWeightSub}>Use uma condição parecida a cada medição.</Text></View>
            <View style={styles.weightInputRow}>
              <View style={styles.weightInputWrap}><TextInput
                value={weightInput}
                onChangeText={(value) => { setWeightInput(value.replace(/[^\d.,]/g, "")); setWeightMessage(""); }}
                placeholder="Ex.: 78,4"
                placeholderTextColor="#718077"
                keyboardType="decimal-pad"
                returnKeyType="done"
                maxLength={6}
                editable={!savingWeight}
                style={styles.weightInput}
                accessibilityLabel="Peso em quilogramas"
              /><Text style={styles.weightInputUnit}>kg</Text></View>
              <Pressable onPress={() => void handleSaveWeight()} disabled={savingWeight} style={({ pressed }) => [styles.saveWeightButton, pressed && styles.pressed, savingWeight && styles.disabled]} accessibilityRole="button">
                {savingWeight ? <ActivityIndicator color={C.background} size="small" /> : <Text style={styles.saveWeightText}>Salvar pesagem</Text>}
              </Pressable>
            </View>
            {weightMessage ? <Text style={[styles.weightMessage, weightMessage.startsWith("Pesagem salva") ? styles.successMessage : styles.errorMessage]}>{weightMessage}</Text> : null}
          </View>

          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Continue no ritmo</Text><Text style={styles.sectionSub}>Acesse seus registros e sessões</Text></View>
          </View>
          <View style={styles.actionsRow}>
            <Pressable onPress={onOpenNutrition} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
              <View style={styles.actionIconNutrition}><Text style={styles.actionIconText}>＋</Text></View>
              <Text style={styles.actionTitle}>Registrar refeição</Text><Text style={styles.actionSub}>Foto ou descrição</Text>
              <Text style={styles.actionArrow}>↗</Text>
            </Pressable>
            <Pressable onPress={onOpenWorkouts} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
              <View style={styles.actionIconWorkout}><Text style={styles.actionIconText}>↗</Text></View>
              <Text style={styles.actionTitle}>Abrir treinos</Text><Text style={styles.actionSub}>Séries e progressão</Text>
              <Text style={styles.actionArrow}>↗</Text>
            </Pressable>
          </View>
          <Text style={styles.footer}>DADOS BASEADOS NOS REGISTROS DA SUA CONTA</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroCard({ label, value, goal, accent }: { label: string; value: number | null; goal: number | null; accent: string }) {
  const progress = value !== null && goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <View style={styles.macroCard}>
      <View style={[styles.macroDot, { backgroundColor: accent }]} />
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{value === null ? "—" : formatWeight(value)}<Text style={styles.macroUnit}> g</Text></Text>
      <View style={styles.macroTrack}><View style={[styles.macroFill, { backgroundColor: accent, width: `${progress}%` }]} /></View>
      <Text style={styles.macroGoal}>{goal ? `META ${formatInteger(goal)} g` : "SEM META"}</Text>
    </View>
  );
}

function WeightDelta({ entries }: { entries: BodyWeightEntry[] }) {
  if (entries.length < 2) return <View style={styles.deltaPill}><Text style={styles.deltaPillText}>1ª PESAGEM</Text></View>;
  const delta = entries[entries.length - 1].weightKg - entries[0].weightKg;
  return <View style={[styles.deltaPill, delta < 0 && styles.deltaPillDown]}><Text style={[styles.deltaPillText, delta < 0 && styles.deltaTextDown]}>{delta > 0 ? "+" : ""}{formatWeight(delta)} kg</Text><Text style={styles.deltaCaption}>VS. 1ª MEDIÇÃO</Text></View>;
}

function WeightBarChart({ entries }: { entries: BodyWeightEntry[] }) {
  const weights = entries.map((entry) => entry.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || Math.max(1, min * 0.015);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
      <View style={styles.chartArea}>
        <View style={styles.chartScale}><Text style={styles.scaleLabel}>{formatWeight(max)} kg</Text><View style={styles.scaleRule} /><Text style={styles.scaleLabel}>{formatWeight(min)} kg</Text></View>
        <View style={styles.chartBars}>
          {entries.map((entry, index) => {
            const relative = max === min ? 0.5 : (entry.weightKg - min) / range;
            const barHeight = 35 + relative * 82;
            const isLatest = index === entries.length - 1;
            return (
              <View key={entry.id} style={styles.chartItem}>
                <Text style={[styles.chartValue, isLatest && styles.chartValueLatest]}>{formatWeight(entry.weightKg)}</Text>
                <View style={styles.barSpace}><View style={[styles.weightBar, { height: barHeight, backgroundColor: isLatest ? C.green : "#43513F" }]} /></View>
                <Text style={[styles.chartDate, isLatest && styles.chartDateLatest]}>{formatChartDate(entry.measuredAt)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.errorPanel}><Text style={styles.errorPanelText}>{message}</Text><Pressable onPress={onRetry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>;
}

function numericGoal(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseWeight(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) ? weight : null;
}

function dateKeyAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`)).toUpperCase();
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatWeight(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: C.background, fontSize: 21, fontWeight: "900", fontStyle: "italic" },
  brandName: { color: C.text, fontSize: 11, letterSpacing: 1.1, fontWeight: "900" },
  brandSub: { color: C.muted, fontSize: 7, letterSpacing: 1, marginTop: 3 },
  logoutButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: C.border },
  logoutText: { color: C.muted, fontSize: 8, letterSpacing: 0.7, fontWeight: "900" },
  remindersButton: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  remindersGlyph: { color: C.green, fontSize: 12, fontWeight: "900" },
  remindersLabel: { color: C.text, fontSize: 6, fontWeight: "900", letterSpacing: 0.45 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
  greetingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 29, marginBottom: 24 },
  greetingCopy: { flex: 1, paddingRight: 8 },
  kicker: { color: C.green, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  greeting: { color: C.text, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, fontWeight: "900", marginTop: 7 },
  subGreeting: { color: C.muted, fontSize: 10, marginTop: 4 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1E2B18", borderRadius: 15, paddingHorizontal: 8, paddingVertical: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  liveText: { color: C.green, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: "900" },
  sectionSub: { color: C.muted, fontSize: 8, marginTop: 4 },
  textLink: { paddingVertical: 6, paddingLeft: 7 },
  textLinkLabel: { color: C.green, fontSize: 8, fontWeight: "900" },
  calorieCard: { backgroundColor: C.green, borderRadius: 16, padding: 16 },
  calorieHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardEyebrow: { color: "#394A2C", fontSize: 7, letterSpacing: 1, fontWeight: "900" },
  calorieValue: { color: C.background, fontSize: 34, fontWeight: "900", letterSpacing: -0.8, marginTop: 6 },
  calorieUnit: { fontSize: 11, letterSpacing: 0, fontWeight: "800" },
  calorieIcon: { borderRadius: 9, borderWidth: 1, borderColor: "#7B9F4D", paddingHorizontal: 8, paddingVertical: 6 },
  calorieIconText: { color: "#304326", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  calorieProgressTrack: { height: 5, backgroundColor: "#98C65C", borderRadius: 3, marginTop: 12, overflow: "hidden" },
  calorieProgressFill: { height: 5, borderRadius: 3, backgroundColor: C.background },
  calorieFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  calorieFootText: { color: "#35442A", fontSize: 8, fontWeight: "800" },
  calorieTarget: { color: "#35442A", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  macroGrid: { flexDirection: "row", gap: 8, marginTop: 9 },
  macroCard: { flex: 1, minWidth: 0, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 10 },
  macroDot: { width: 5, height: 5, borderRadius: 3, marginBottom: 7 },
  macroLabel: { color: C.muted, fontSize: 6, letterSpacing: 0.35, fontWeight: "900" },
  macroValue: { color: C.text, fontSize: 16, fontWeight: "900", marginTop: 5 },
  macroUnit: { color: C.muted, fontSize: 8, fontWeight: "700" },
  macroTrack: { height: 3, backgroundColor: C.raised, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  macroFill: { height: 3, borderRadius: 2 },
  macroGoal: { color: C.muted, fontSize: 6, fontWeight: "800", marginTop: 5 },
  emptyNutrition: { flexDirection: "row", alignItems: "center", gap: 9, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginTop: 9 },
  emptyNutritionGlyph: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  emptyNutritionPlus: { color: C.green, fontSize: 17, fontWeight: "800" },
  emptyNutritionCopy: { flex: 1 },
  emptyNutritionTitle: { color: C.text, fontSize: 9, fontWeight: "800" },
  emptyNutritionSub: { color: C.muted, fontSize: 7, marginTop: 3 },
  weightSectionHeading: { marginTop: 25 },
  weightUnitBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: "#17242B" },
  weightUnitText: { color: C.blue, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  weightCard: { backgroundColor: C.surface, borderRadius: 15, borderWidth: 1, borderColor: C.border, padding: 14 },
  weightLoading: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 9 },
  noWeightData: { alignItems: "center", paddingVertical: 14, paddingHorizontal: 12 },
  scaleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#17242B", alignItems: "center", justifyContent: "center" },
  scaleIconText: { color: C.blue, fontSize: 17, fontWeight: "900" },
  noWeightTitle: { color: C.text, fontSize: 11, textAlign: "center", fontWeight: "900", marginTop: 11 },
  noWeightText: { color: C.muted, fontSize: 8, lineHeight: 13, textAlign: "center", maxWidth: 250, marginTop: 5 },
  weightSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  latestWeight: { color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.7, marginTop: 3 },
  latestWeightUnit: { color: C.muted, fontSize: 10, letterSpacing: 0 },
  weightDate: { color: C.muted, fontSize: 8, marginTop: 2 },
  deltaPill: { alignItems: "flex-end", paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: "#202E1A" },
  deltaPillDown: { backgroundColor: "#192932" },
  deltaPillText: { color: C.green, fontSize: 10, fontWeight: "900" },
  deltaTextDown: { color: C.blue },
  deltaCaption: { color: C.muted, fontSize: 5, letterSpacing: 0.4, fontWeight: "800", marginTop: 3 },
  chartScroll: { minWidth: "100%" },
  chartArea: { minWidth: "100%", flexDirection: "row", height: 161, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9 },
  chartScale: { width: 42, height: 119, justifyContent: "space-between", paddingBottom: 2 },
  scaleLabel: { color: C.muted, fontSize: 6 },
  scaleRule: { position: "absolute", left: 0, right: -600, top: 59, borderTopWidth: 1, borderStyle: "dashed", borderColor: C.border },
  chartBars: { flexDirection: "row", flex: 1, minWidth: 0, justifyContent: "space-around", alignItems: "flex-end", height: 145, paddingBottom: 15 },
  chartItem: { width: 39, height: 145, alignItems: "center", justifyContent: "flex-end" },
  chartValue: { color: C.muted, fontSize: 7, fontWeight: "800", marginBottom: 4 },
  chartValueLatest: { color: C.green },
  barSpace: { height: 118, justifyContent: "flex-end", alignItems: "center" },
  weightBar: { width: 15, borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 8 },
  chartDate: { color: C.muted, fontSize: 6, marginTop: 5 },
  chartDateLatest: { color: C.green, fontWeight: "900" },
  chartCaption: { color: C.muted, fontSize: 6, fontWeight: "800", letterSpacing: 0.5, textAlign: "center", marginTop: 3 },
  addWeightCard: { padding: 14, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 10, marginBottom: 25 },
  addWeightCopy: { marginBottom: 11 },
  addWeightTitle: { color: C.text, fontSize: 11, fontWeight: "900" },
  addWeightSub: { color: C.muted, fontSize: 8, marginTop: 4 },
  weightInputRow: { flexDirection: "row", gap: 8 },
  weightInputWrap: { flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.background, borderRadius: 9, paddingHorizontal: 10 },
  weightInput: { flex: 1, minHeight: 40, color: C.text, fontSize: 12 },
  weightInputUnit: { color: C.muted, fontSize: 9, fontWeight: "800" },
  saveWeightButton: { minWidth: 112, paddingHorizontal: 12, minHeight: 42, borderRadius: 9, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  saveWeightText: { color: C.background, fontSize: 9, fontWeight: "900" },
  weightMessage: { fontSize: 8, lineHeight: 13, marginTop: 8 },
  successMessage: { color: C.green },
  errorMessage: { color: C.red },
  errorPanel: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#663936", backgroundColor: "#321D1D", marginBottom: 8 },
  errorPanelText: { color: "#FFC2BD", fontSize: 8, lineHeight: 13 },
  retryText: { color: C.green, fontSize: 8, fontWeight: "900", marginTop: 7 },
  actionsRow: { flexDirection: "row", gap: 9 },
  actionCard: { flex: 1, minHeight: 116, padding: 12, borderRadius: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  actionIconNutrition: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  actionIconWorkout: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#17242B", alignItems: "center", justifyContent: "center" },
  actionIconText: { color: C.green, fontSize: 15, fontWeight: "900" },
  actionTitle: { color: C.text, fontSize: 9, fontWeight: "900", marginTop: 12 },
  actionSub: { color: C.muted, fontSize: 7, marginTop: 3 },
  actionArrow: { position: "absolute", right: 11, bottom: 10, color: C.green, fontSize: 12, fontWeight: "900" },
  footer: { color: "#68766D", fontSize: 6, fontWeight: "800", letterSpacing: 0.7, textAlign: "center", marginTop: 24 }
});
