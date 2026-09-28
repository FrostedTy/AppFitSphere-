import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { analyzeNutrition, getDailyMealHistory, type MealPhoto } from "../services/nutrition";
import type { DailyMealHistory, MealHistoryItem } from "../types/nutrition";

const C = {
  background: "#0B100E",
  surface: "#131A16",
  raised: "#19221D",
  border: "#29352E",
  text: "#F4F7F4",
  muted: "#9BA99F",
  green: "#B8F36A",
  red: "#FF8C83",
  orange: "#FFC46B",
  blue: "#83C9FF"
};

export function NutritionScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = dateKeyAt(new Date(), timeZone);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<MealPhoto | null>(null);
  const [result, setResult] = useState<MealHistoryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [history, setHistory] = useState<DailyMealHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyReload, setHistoryReload] = useState(0);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    getDailyMealHistory(token, selectedDate, timeZone)
      .then((dailyHistory) => { if (active) setHistory(dailyHistory); })
      .catch((cause) => {
        if (active) setHistoryError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [token, selectedDate, timeZone, historyReload]);

  const selectPhoto = async (source: "camera" | "library") => {
    setError("");
    try {
      const permission = Platform.OS === "web"
        ? { granted: true }
        : source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === "camera"
          ? "Permita o acesso à câmera para fotografar sua refeição."
          : "Permita o acesso às fotos para escolher uma imagem da refeição.");
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.82,
        exif: false
      };
      const selection = source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      setPhoto({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
      setResult(null);
    } catch {
      setError("Não foi possível abrir a câmera ou a galeria. Verifique as permissões do dispositivo.");
    }
  };

  const runAnalysis = async () => {
    if (!photo && !description.trim()) {
      setError("Envie uma foto ou descreva o que você comeu.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const savedMeal = await analyzeNutrition(token, { description, photo });
      setResult(savedMeal);
      setSelectedDate(today);
      setHistoryReload((revision) => revision + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar essa refeição.");
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setDescription("");
    setPhoto(null);
    setResult(null);
    setError("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.nav}>
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar" style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backArrow}>‹</Text>
            </Pressable>
            <Text style={styles.navTitle}>RASTREAMENTO ALIMENTAR</Text>
            <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>IA</Text></View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.kicker}>NUTRIÇÃO COM VISÃO COMPUTACIONAL</Text>
            <Text style={styles.title}>O que tem{ "\n" }no seu prato?</Text>
            <Text style={styles.subtitle}>Fotografe sua refeição ou descreva o que comeu. A IA estima os macros para você.</Text>
          </View>

          {!result ? (
            <>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Adicione uma foto</Text>
                <Text style={styles.optionalLabel}>OPCIONAL</Text>
              </View>

              {photo ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
                  <View style={styles.photoOverlay}>
                    <View style={styles.photoFilePill}><View style={styles.photoDot} /><Text style={styles.photoFileText} numberOfLines={1}>{photo.fileName || "Foto da refeição"}</Text></View>
                    <Pressable disabled={busy} onPress={() => { setPhoto(null); setResult(null); }} accessibilityRole="button" accessibilityLabel="Remover foto" style={styles.removePhoto}>
                      <Text style={styles.removePhotoText}>×</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.photoActions}>
                  <Pressable disabled={busy} onPress={() => void selectPhoto("camera")} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed, busy && styles.buttonDisabled]} accessibilityRole="button">
                    <View style={[styles.photoIcon, styles.cameraIcon]}><Text style={styles.cameraGlyph}>◉</Text></View>
                    <Text style={styles.photoActionTitle}>Tirar foto</Text>
                    <Text style={styles.photoActionCaption}>Use a câmera</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => void selectPhoto("library")} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed, busy && styles.buttonDisabled]} accessibilityRole="button">
                    <View style={[styles.photoIcon, styles.galleryIcon]}><Text style={styles.galleryGlyph}>▧</Text></View>
                    <Text style={styles.photoActionTitle}>Escolher foto</Text>
                    <Text style={styles.photoActionCaption}>Da sua galeria</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.orDivider}><View style={styles.rule} /><Text style={styles.orText}>OU CONTE PRA GENTE</Text><View style={styles.rule} /></View>

              <View style={styles.inputCard}>
                <View style={styles.inputHeader}>
                  <Text style={styles.sectionTitle}>Descreva sua refeição</Text>
                  <Text style={styles.textGlyph}>Aa</Text>
                </View>
                <TextInput
                  value={description}
                  onChangeText={(value) => { setDescription(value); setResult(null); }}
                  placeholder={'Ex.: 200 g de frango, 150 g de arroz e uma concha de feijão'}
                  placeholderTextColor="#718077"
                  style={styles.mealInput}
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                  editable={!busy}
                  autoCorrect
                  accessibilityLabel="Descreva os alimentos e as porções da refeição"
                />
                <Text style={styles.charCount}>{description.length}/2000</Text>
              </View>

              <View style={styles.tipRow}>
                <Text style={styles.tipIcon}>✦</Text>
                <Text style={styles.tipText}>Inclua as porções quando souber. Uma descrição precisa melhora a estimativa.</Text>
              </View>

              {error ? <InlineError message={error} /> : null}

              <Pressable
                onPress={() => void runAnalysis()}
                disabled={busy}
                style={({ pressed }) => [styles.analyzeButton, pressed && !busy && styles.buttonPressed, busy && styles.buttonDisabled]}
                accessibilityRole="button"
              >
                {busy ? <ActivityIndicator color={C.background} /> : (
                  <><Text style={styles.sparkle}>✦</Text><Text style={styles.analyzeButtonText}>Analisar refeição</Text><Text style={styles.buttonArrow}>↗</Text></>
                )}
              </Pressable>
              <Text style={styles.privacyNote}>A foto é enviada ao backend; somente no modo Gemini segue para análise do modelo. O servidor não armazena o arquivo.</Text>
            </>
          ) : (
            <ResultCard result={result} onAgain={startOver} />
          )}

          <DailyHistory
            history={history}
            selectedDate={selectedDate}
            today={today}
            timeZone={timeZone}
            loading={historyLoading}
            error={historyError}
            onPrevious={() => setSelectedDate((date) => shiftDate(date, -1))}
            onNext={() => setSelectedDate((date) => shiftDate(date, 1))}
            onToday={() => setSelectedDate(today)}
            onRetry={() => setHistoryReload((revision) => revision + 1)}
          />

          <View style={styles.footerLine}><View style={styles.rule} /><Text style={styles.footerText}>HIPERTROFIA · NUTRIÇÃO</Text><View style={styles.rule} /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InlineError({ message }: { message: string }) {
  return <View style={styles.errorBox} accessible accessibilityLabel={`Erro: ${message}`}><Text style={styles.errorMark}>!</Text><Text style={styles.errorText}>{message}</Text></View>;
}

function DailyHistory({
  history,
  selectedDate,
  today,
  timeZone,
  loading,
  error,
  onPrevious,
  onNext,
  onToday,
  onRetry
}: {
  history: DailyMealHistory | null;
  selectedDate: string;
  today: string;
  timeZone: string;
  loading: boolean;
  error: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onRetry: () => void;
}) {
  return (
    <View style={styles.historySection}>
      <View style={styles.historySectionHeader}>
        <View><Text style={styles.kicker}>INGESTÃO REGISTRADA</Text><Text style={styles.historyTitle}>Seu dia</Text></View>
        <View style={styles.historyCount}><Text style={styles.historyCountText}>{history?.summary.mealCount ?? 0}</Text></View>
      </View>

      <View style={styles.dateNavigator}>
        <Pressable onPress={onPrevious} style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Dia anterior">
          <Text style={styles.dateArrowText}>‹</Text>
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.selectedDateText}>{formatCalendarDate(selectedDate)}</Text>
          {selectedDate === today ? <Text style={styles.todayTag}>HOJE</Text> : null}
        </View>
        {selectedDate === today ? (
          <View style={[styles.dateArrow, styles.dateArrowDisabled]}><Text style={styles.dateArrowMuted}>›</Text></View>
        ) : (
          <Pressable onPress={onNext} style={({ pressed }) => [styles.dateArrow, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Próximo dia">
            <Text style={styles.dateArrowText}>›</Text>
          </Pressable>
        )}
      </View>

      {selectedDate !== today ? <Pressable onPress={onToday} style={styles.todayButton}><Text style={styles.todayButtonText}>Voltar para hoje</Text></Pressable> : null}

      {loading ? (
        <View style={styles.historyLoading}><ActivityIndicator color={C.green} /><Text style={styles.historyMuted}>Carregando seu histórico...</Text></View>
      ) : error ? (
        <View><InlineError message={error} /><Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>
      ) : history ? (
        <>
          <View style={styles.dailyCalories}>
            <View><Text style={styles.dailyCaloriesLabel}>TOTAL DO DIA</Text><Text style={styles.dailyCaloriesValue}>{formatMacro(history.summary.calories)}<Text style={styles.dailyCaloriesUnit}> kcal</Text></Text></View>
            <View style={styles.dailyMealCountBadge}><Text style={styles.dailyMealCountNumber}>{history.summary.mealCount}</Text><Text style={styles.dailyMealCountLabel}>{history.summary.mealCount === 1 ? "REFEIÇÃO" : "REFEIÇÕES"}</Text></View>
          </View>
          <View style={styles.historyMacroGrid}>
            <MacroCard label="PROTEÍNA" value={history.summary.proteinGrams} unit="g" color={C.green} />
            <MacroCard label="CARBO" value={history.summary.carbohydratesGrams} unit="g" color={C.orange} />
            <MacroCard label="GORDURA" value={history.summary.fatGrams} unit="g" color={C.blue} />
          </View>

          {history.meals.length === 0 ? (
            <View style={styles.emptyHistory}><Text style={styles.emptyHistoryIcon}>◷</Text><Text style={styles.emptyHistoryTitle}>Nenhuma refeição ainda</Text><Text style={styles.emptyHistoryText}>As refeições analisadas aparecerão aqui.</Text></View>
          ) : (
            <View style={styles.mealList}>
              {history.meals.map((meal) => (
                <View key={meal.id} style={styles.mealRow}>
                  <View style={styles.mealRowTop}>
                    <View style={styles.mealRowTitleGroup}>
                      <View style={[styles.mealSourceMark, meal.source === "IMAGE" && styles.mealSourceImage]}><Text style={styles.mealSourceGlyph}>{meal.source === "IMAGE" ? "▧" : "Aa"}</Text></View>
                      <View style={styles.mealRowCopy}>
                        <Text style={styles.mealDescription} numberOfLines={2}>{meal.description || "Refeição analisada por foto"}</Text>
                        <Text style={styles.mealTime}>{formatMealTime(meal.consumedAt, timeZone)} · {meal.source === "IMAGE" ? "FOTO" : "TEXTO"}</Text>
                      </View>
                    </View>
                    <Text style={styles.mealCalories}>{formatMacro(meal.calories)}<Text style={styles.mealCaloriesUnit}> kcal</Text></Text>
                  </View>
                  <View style={styles.mealMacroLine}>
                    <Text style={styles.mealMacroText}><Text style={{ color: C.green }}>P </Text>{formatMacro(meal.proteinGrams)} g</Text>
                    <Text style={styles.mealMacroText}><Text style={{ color: C.orange }}>C </Text>{formatMacro(meal.carbohydratesGrams)} g</Text>
                    <Text style={styles.mealMacroText}><Text style={{ color: C.blue }}>G </Text>{formatMacro(meal.fatGrams)} g</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

function dateKeyAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function formatMealTime(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(date));
}

function ResultCard({ result, onAgain }: { result: MealHistoryItem; onAgain: () => void }) {
  return (
    <View style={styles.resultWrap}>
      <View style={styles.resultHeader}>
        <View><Text style={styles.kicker}>SALVA NO SEU HISTÓRICO</Text><Text style={styles.resultTitle}>Análise pronta</Text></View>
        <View style={styles.resultCheck}><Text style={styles.resultCheckText}>✓</Text></View>
      </View>

      {result.analysisMode === "mock" ? (
        <View style={styles.mockNotice}><Text style={styles.mockNoticeTitle}>MODO SIMULADO — E2E</Text><Text style={styles.mockNoticeText}>Macros fixos para teste; não representam análise nutricional real.</Text></View>
      ) : null}

      <View style={styles.calorieCard}>
        <View><Text style={styles.macroLabel}>ENERGIA ESTIMADA</Text><Text style={styles.calorieValue}>{formatMacro(result.calories)}<Text style={styles.calorieUnit}> kcal</Text></Text></View>
        <View style={styles.flameBadge}><Text style={styles.flameText}>KCAL</Text></View>
      </View>

      <Text style={styles.macrosHeading}>Macronutrientes</Text>
      <View style={styles.macroGrid}>
        <MacroCard label="PROTEÍNA" value={result.proteinGrams} unit="g" color={C.green} />
        <MacroCard label="CARBOIDRATO" value={result.carbohydratesGrams} unit="g" color={C.orange} />
        <MacroCard label="GORDURA" value={result.fatGrams} unit="g" color={C.blue} />
      </View>

      <View style={styles.estimateNote}><Text style={styles.noteStar}>✦</Text><Text style={styles.estimateText}>Os valores são estimativas da IA e podem variar conforme o preparo e o tamanho real das porções.</Text></View>
      <Pressable onPress={onAgain} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>Registrar outra refeição</Text><Text style={styles.secondaryArrow}>↗</Text>
      </Pressable>
    </View>
  );
}

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.macroCard}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{formatMacro(value)}<Text style={styles.macroUnit}> {unit}</Text></Text>
    </View>
  );
}

function formatMacro(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.background },
  content: { flexGrow: 1, paddingHorizontal: 23, paddingTop: 10, paddingBottom: 28 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  backArrow: { color: C.text, fontSize: 31, lineHeight: 34, marginTop: -3 },
  navTitle: { color: C.muted, fontSize: 9, letterSpacing: 1.1, fontWeight: "800" },
  aiBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  aiBadgeText: { color: C.background, fontSize: 12, fontWeight: "900" },
  headingBlock: { marginTop: 30, marginBottom: 27 },
  kicker: { color: C.green, fontSize: 9, letterSpacing: 1.35, fontWeight: "800" },
  title: { color: C.text, fontSize: 35, lineHeight: 38, fontWeight: "900", letterSpacing: -1, marginTop: 10 },
  subtitle: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 11, maxWidth: 360 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  optionalLabel: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: "800" },
  photoActions: { flexDirection: "row", gap: 11 },
  photoAction: { flex: 1, minHeight: 123, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: "flex-start", justifyContent: "center" },
  pressed: { opacity: 0.72 },
  photoIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cameraIcon: { backgroundColor: "#27351E" },
  galleryIcon: { backgroundColor: "#1E2E35" },
  cameraGlyph: { color: C.green, fontSize: 21, lineHeight: 24 },
  galleryGlyph: { color: C.blue, fontSize: 21, lineHeight: 24 },
  photoActionTitle: { color: C.text, fontSize: 12, fontWeight: "800" },
  photoActionCaption: { color: C.muted, fontSize: 10, marginTop: 4 },
  photoPreview: { height: 205, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden", backgroundColor: C.surface },
  previewImage: { width: "100%", height: "100%" },
  photoOverlay: { position: "absolute", left: 11, right: 11, bottom: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoFilePill: { flexDirection: "row", gap: 7, alignItems: "center", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(11,16,14,0.88)", maxWidth: "82%" },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  photoFileText: { color: C.text, fontSize: 10, flexShrink: 1 },
  removePhoto: { width: 31, height: 31, borderRadius: 16, backgroundColor: "rgba(11,16,14,0.88)", alignItems: "center", justifyContent: "center" },
  removePhotoText: { color: C.text, fontSize: 23, lineHeight: 25, marginTop: -2 },
  orDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 23, marginBottom: 14 },
  rule: { height: 1, flex: 1, backgroundColor: C.border },
  orText: { color: "#78867D", fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  inputCard: { borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, borderRadius: 15, padding: 14 },
  inputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  textGlyph: { color: C.green, fontSize: 14, fontWeight: "900" },
  mealInput: { minHeight: 92, color: C.text, fontSize: 13, lineHeight: 20, marginTop: 9, paddingTop: 2 },
  charCount: { color: "#738078", fontSize: 9, textAlign: "right", marginTop: 5 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  tipIcon: { color: C.green, fontSize: 12 },
  tipText: { color: C.muted, fontSize: 10, lineHeight: 15, flex: 1 },
  errorBox: { flexDirection: "row", gap: 9, padding: 11, backgroundColor: "#321D1D", borderRadius: 10, borderWidth: 1, borderColor: "#663936", marginTop: 14 },
  errorMark: { color: C.red, fontWeight: "900", fontSize: 12 },
  errorText: { color: "#FFC2BD", fontSize: 11, lineHeight: 16, flex: 1 },
  analyzeButton: { minHeight: 53, borderRadius: 13, paddingHorizontal: 16, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, marginTop: 19 },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  buttonDisabled: { opacity: 0.65 },
  sparkle: { color: C.background, fontSize: 15 },
  analyzeButtonText: { color: C.background, fontWeight: "900", fontSize: 13 },
  buttonArrow: { color: C.background, fontSize: 18, fontWeight: "900" },
  privacyNote: { color: "#76837A", fontSize: 9, textAlign: "center", marginTop: 12 },
  footerLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 27 },
  footerText: { color: "#68766D", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  resultWrap: { marginTop: 4 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  resultTitle: { color: C.text, fontSize: 24, fontWeight: "900", marginTop: 5 },
  resultCheck: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#1B2B16", borderWidth: 1, borderColor: C.green, alignItems: "center", justifyContent: "center" },
  resultCheckText: { color: C.green, fontSize: 18, fontWeight: "900" },
  mockNotice: { padding: 12, marginBottom: 13, borderRadius: 12, borderWidth: 1, borderColor: C.orange, backgroundColor: "#302819" },
  mockNoticeTitle: { color: C.orange, fontSize: 9, letterSpacing: 0.8, fontWeight: "900" },
  mockNoticeText: { color: C.text, fontSize: 10, lineHeight: 15, marginTop: 5 },
  calorieCard: { minHeight: 121, borderRadius: 17, padding: 17, backgroundColor: C.green, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  macroLabel: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: "800" },
  calorieValue: { color: C.background, fontSize: 38, fontWeight: "900", letterSpacing: -1.1, marginTop: 6 },
  calorieUnit: { color: "#35442A", fontSize: 13, fontWeight: "800", letterSpacing: 0 },
  flameBadge: { borderRadius: 10, backgroundColor: "rgba(11,16,14,0.12)", paddingHorizontal: 10, paddingVertical: 7 },
  flameText: { color: C.background, fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  macrosHeading: { color: C.text, fontSize: 14, fontWeight: "800", marginTop: 24, marginBottom: 11 },
  macroGrid: { flexDirection: "row", gap: 9 },
  macroCard: { flex: 1, minHeight: 100, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, padding: 11, justifyContent: "center" },
  macroDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 9 },
  macroValue: { color: C.text, fontSize: 19, fontWeight: "900", marginTop: 8 },
  macroUnit: { color: C.muted, fontSize: 10, fontWeight: "700" },
  estimateNote: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 12, padding: 12, marginTop: 17, backgroundColor: C.surface },
  noteStar: { color: C.green, fontSize: 11 },
  estimateText: { color: C.muted, fontSize: 10, lineHeight: 16, flex: 1 },
  secondaryButton: { minHeight: 49, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 17 },
  secondaryButtonText: { color: C.text, fontSize: 12, fontWeight: "800" },
  secondaryArrow: { color: C.green, fontWeight: "900", fontSize: 16 },
  historySection: { marginTop: 31, paddingTop: 23, borderTopWidth: 1, borderTopColor: C.border },
  historySectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 15 },
  historyTitle: { color: C.text, fontSize: 22, fontWeight: "900", marginTop: 5 },
  historyCount: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  historyCountText: { color: C.green, fontSize: 12, fontWeight: "900" },
  dateNavigator: { minHeight: 52, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  dateArrowText: { color: C.text, fontSize: 24, lineHeight: 26, marginTop: -3 },
  dateArrowDisabled: { opacity: 0.4 },
  dateArrowMuted: { color: C.muted, fontSize: 24, lineHeight: 26, marginTop: -3 },
  dateCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectedDateText: { color: C.text, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  todayTag: { color: C.green, backgroundColor: "#26341D", overflow: "hidden", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, fontSize: 7, letterSpacing: 0.6, fontWeight: "900" },
  todayButton: { alignSelf: "center", paddingVertical: 9, paddingHorizontal: 12 },
  todayButtonText: { color: C.green, fontSize: 10, fontWeight: "800" },
  historyLoading: { minHeight: 118, alignItems: "center", justifyContent: "center", gap: 9 },
  historyMuted: { color: C.muted, fontSize: 10 },
  retryButton: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9 },
  retryText: { color: C.green, fontSize: 10, fontWeight: "800" },
  dailyCalories: { minHeight: 94, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 13, marginTop: 14, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dailyCaloriesLabel: { color: "#35442A", fontSize: 8, letterSpacing: 1, fontWeight: "900" },
  dailyCaloriesValue: { color: C.background, fontSize: 30, fontWeight: "900", letterSpacing: -0.8, marginTop: 5 },
  dailyCaloriesUnit: { color: "#35442A", fontSize: 11, fontWeight: "800", letterSpacing: 0 },
  dailyMealCountBadge: { alignItems: "center", justifyContent: "center", minWidth: 58, minHeight: 52, paddingHorizontal: 7, borderRadius: 11, backgroundColor: "rgba(11,16,14,0.12)" },
  dailyMealCountNumber: { color: C.background, fontSize: 19, fontWeight: "900" },
  dailyMealCountLabel: { color: "#35442A", fontSize: 6, fontWeight: "900", letterSpacing: 0.5, marginTop: 2 },
  historyMacroGrid: { flexDirection: "row", gap: 8, marginTop: 9 },
  emptyHistory: { minHeight: 142, marginTop: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 16 },
  emptyHistoryIcon: { color: C.green, fontSize: 22 },
  emptyHistoryTitle: { color: C.text, fontSize: 12, fontWeight: "800", marginTop: 9 },
  emptyHistoryText: { color: C.muted, fontSize: 10, marginTop: 5, textAlign: "center" },
  mealList: { gap: 9, marginTop: 12 },
  mealRow: { padding: 13, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 13 },
  mealRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  mealRowTitleGroup: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  mealSourceMark: { width: 33, height: 33, borderRadius: 10, backgroundColor: "#1E2E35", alignItems: "center", justifyContent: "center" },
  mealSourceImage: { backgroundColor: "#27351E" },
  mealSourceGlyph: { color: C.green, fontSize: 11, fontWeight: "900" },
  mealRowCopy: { flex: 1 },
  mealDescription: { color: C.text, fontSize: 11, fontWeight: "800", lineHeight: 15 },
  mealTime: { color: C.muted, fontSize: 8, marginTop: 4, letterSpacing: 0.3 },
  mealCalories: { color: C.text, fontSize: 14, fontWeight: "900" },
  mealCaloriesUnit: { color: C.muted, fontSize: 8, fontWeight: "700" },
  mealMacroLine: { flexDirection: "row", gap: 15, borderTopWidth: 1, borderTopColor: C.border, marginTop: 10, paddingTop: 9 },
  mealMacroText: { color: C.muted, fontSize: 9, fontWeight: "700" }
});
