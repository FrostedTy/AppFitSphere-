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
            const barHeight = 40 + relative * 90;
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
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: C.background, fontSize: 22, fontWeight: "900", fontStyle: "italic" },
  brandName: { color: C.text, fontSize: 13, letterSpacing: 1, fontWeight: "900" },
  brandSub: { color: C.muted, fontSize: 10, letterSpacing: 0.8, marginTop: 2 },
  logoutButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  logoutText: { color: C.muted, fontSize: 11, letterSpacing: 0.6, fontWeight: "900" },
  remindersButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  remindersGlyph: { color: C.green, fontSize: 14, fontWeight: "900" },
  remindersLabel: { color: C.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
  greetingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 24, marginBottom: 20 },
  greetingCopy: { flex: 1, paddingRight: 8 },
  kicker: { color: C.green, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  greeting: { color: C.text, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, fontWeight: "900", marginTop: 6 },
  subGreeting: { color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E2B18", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  liveText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  sectionSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  textLink: { paddingVertical: 6, paddingLeft: 8 },
  textLinkLabel: { color: C.green, fontSize: 12, fontWeight: "900" },
  calorieCard: { backgroundColor: C.green, borderRadius: 16, padding: 18 },
  calorieHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardEyebrow: { color: "#394A2C", fontSize: 10, letterSpacing: 1, fontWeight: "900" },
  calorieValue: { color: C.background, fontSize: 36, fontWeight: "900", letterSpacing: -0.8, marginTop: 6 },
  calorieUnit: { fontSize: 13, letterSpacing: 0, fontWeight: "800" },
  calorieIcon: { borderRadius: 10, borderWidth: 1, borderColor: "#7B9F4D", paddingHorizontal: 10, paddingVertical: 6 },
  calorieIconText: { color: "#304326", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  calorieProgressTrack: { height: 6, backgroundColor: "#98C65C", borderRadius: 3, marginTop: 14, overflow: "hidden" },
  calorieProgressFill: { height: 6, borderRadius: 3, backgroundColor: C.background },
  calorieFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  calorieFootText: { color: "#35442A", fontSize: 11, fontWeight: "800" },
  calorieTarget: { color: "#35442A", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  macroGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  macroCard: { flex: 1, minWidth: 0, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12 },
  macroDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 8 },
  macroLabel: { color: C.muted, fontSize: 9, letterSpacing: 0.4, fontWeight: "900" },
  macroValue: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 6 },
  macroUnit: { color: C.muted, fontSize: 11, fontWeight: "700" },
  macroTrack: { height: 4, backgroundColor: C.raised, borderRadius: 2, marginTop: 10, overflow: "hidden" },
  macroFill: { height: 4, borderRadius: 2 },
  macroGoal: { color: C.muted, fontSize: 9, fontWeight: "800", marginTop: 6 },
  emptyNutrition: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, marginTop: 10 },
  emptyNutritionGlyph: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  emptyNutritionPlus: { color: C.green, fontSize: 18, fontWeight: "800" },
  emptyNutritionCopy: { flex: 1 },
  emptyNutritionTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  emptyNutritionSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  weightSectionHeading: { marginTop: 24 },
  weightUnitBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#17242B" },
  weightUnitText: { color: C.blue, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  weightCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  weightLoading: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 10 },
  noWeightData: { alignItems: "center", paddingVertical: 16, paddingHorizontal: 12 },
  scaleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#17242B", alignItems: "center", justifyContent: "center" },
  scaleIconText: { color: C.blue, fontSize: 18, fontWeight: "900" },
  noWeightTitle: { color: C.text, fontSize: 14, textAlign: "center", fontWeight: "900", marginTop: 12 },
  noWeightText: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: "center", maxWidth: 280, marginTop: 6 },
  weightSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  latestWeight: { color: C.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.5, marginTop: 4 },
  latestWeightUnit: { color: C.muted, fontSize: 12, letterSpacing: 0 },
  weightDate: { color: C.muted, fontSize: 11, marginTop: 3 },
  deltaPill: { alignItems: "flex-end", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#202E1A" },
  deltaPillDown: { backgroundColor: "#192932" },
  deltaPillText: { color: C.green, fontSize: 12, fontWeight: "900" },
  deltaTextDown: { color: C.blue },
  deltaCaption: { color: C.muted, fontSize: 9, letterSpacing: 0.4, fontWeight: "800", marginTop: 3 },
  chartScroll: { minWidth: "100%" },
  chartArea: { minWidth: "100%", flexDirection: "row", height: 170, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  chartScale: { width: 48, height: 125, justifyContent: "space-between", paddingBottom: 2 },
  scaleLabel: { color: C.muted, fontSize: 10 },
  scaleRule: { position: "absolute", left: 0, right: -600, top: 62, borderTopWidth: 1, borderStyle: "dashed", borderColor: C.border },
  chartBars: { flexDirection: "row", flex: 1, minWidth: 0, justifyContent: "space-around", alignItems: "flex-end", height: 150, paddingBottom: 15 },
  chartItem: { width: 42, height: 150, alignItems: "center", justifyContent: "flex-end" },
  chartValue: { color: C.muted, fontSize: 10, fontWeight: "800", marginBottom: 4 },
  chartValueLatest: { color: C.green },
  barSpace: { height: 122, justifyContent: "flex-end", alignItems: "center" },
  weightBar: { width: 16, borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 8 },
  chartDate: { color: C.muted, fontSize: 9, marginTop: 6 },
  chartDateLatest: { color: C.green, fontWeight: "900" },
  chartCaption: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.5, textAlign: "center", marginTop: 6 },
  addWeightCard: { padding: 16, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginTop: 12, marginBottom: 24 },
  addWeightCopy: { marginBottom: 12 },
  addWeightTitle: { color: C.text, fontSize: 14, fontWeight: "900" },
  addWeightSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  weightInputRow: { flexDirection: "row", gap: 10 },
  weightInputWrap: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.background, borderRadius: 10, paddingHorizontal: 12 },
  weightInput: { flex: 1, minHeight: 46, color: C.text, fontSize: 15 },
  weightInputUnit: { color: C.muted, fontSize: 12, fontWeight: "800" },
  saveWeightButton: { minWidth: 120, paddingHorizontal: 14, minHeight: 48, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  saveWeightText: { color: C.background, fontSize: 12, fontWeight: "900" },
  weightMessage: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  successMessage: { color: C.green },
  errorMessage: { color: C.red },
  errorPanel: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#663936", backgroundColor: "#321D1D", marginBottom: 10 },
  errorPanelText: { color: "#FFC2BD", fontSize: 11, lineHeight: 16 },
  retryText: { color: C.green, fontSize: 11, fontWeight: "900", marginTop: 6 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionCard: { flex: 1, minHeight: 120, padding: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  actionIconNutrition: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.greenDark, alignItems: "center", justifyContent: "center" },
  actionIconWorkout: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#17242B", alignItems: "center", justifyContent: "center" },
  actionIconText: { color: C.green, fontSize: 16, fontWeight: "900" },
  actionTitle: { color: C.text, fontSize: 13, fontWeight: "900", marginTop: 12 },
  actionSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  actionArrow: { position: "absolute", right: 12, bottom: 12, color: C.green, fontSize: 14, fontWeight: "900" },
  footer: { color: "#68766D", fontSize: 9, fontWeight: "800", letterSpacing: 0.7, textAlign: "center", marginTop: 24 }
});
