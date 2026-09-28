import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  View,
  type TextInputProps
} from "react-native";
import { getCurrentUser, login, register } from "./src/services/auth";
import { clearAccessToken, getStoredAccessToken, saveAccessToken } from "./src/services/token-storage";
import { NutritionScreen } from "./src/screens/NutritionScreen";
import { WorkoutsScreen } from "./src/screens/WorkoutsScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import type { AuthResponse, AuthUser } from "./src/types/auth";

const C = {
  background: "#0B100E",
  surface: "#131A16",
  surfaceRaised: "#19221D",
  border: "#29352E",
  text: "#F4F7F4",
  muted: "#9BA99F",
  green: "#B8F36A",
  greenDark: "#182311",
  red: "#FF8C83"
};

type AuthMode = "login" | "register";

function utf8ByteLength(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

type FieldProps = TextInputProps & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  rightAction?: ReactNode;
};

export default function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<{ token: string; user: AuthUser } | null>(null);
  const [activeScreen, setActiveScreen] = useState<"dashboard" | "nutrition" | "workouts" | "reminders">("dashboard");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const token = await getStoredAccessToken();
        if (!token) return;
        const { user } = await getCurrentUser(token);
        if (active) setSession({ token, user });
      } catch {
        await clearAccessToken().catch(() => undefined);
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  const handleAuthenticated = async (response: AuthResponse) => {
    await saveAccessToken(response.accessToken);
    setSession({ token: response.accessToken, user: response.user });
    setActiveScreen("dashboard");
  };

  const handleLogout = async () => {
    await clearAccessToken().catch(() => undefined);
    setSession(null);
    setActiveScreen("dashboard");
    setMode("login");
  };

  if (checkingSession) return <LoadingScreen />;
  if (session && activeScreen === "nutrition") {
    return <NutritionScreen token={session.token} onBack={() => setActiveScreen("dashboard")} />;
  }
  if (session && activeScreen === "workouts") {
    return <WorkoutsScreen token={session.token} onBack={() => setActiveScreen("dashboard")} />;
  }
  if (session && activeScreen === "reminders") {
    return <RemindersScreen onBack={() => setActiveScreen("dashboard")} />;
  }
  if (session) {
    return <DashboardScreen
      token={session.token}
      user={session.user}
      onOpenNutrition={() => setActiveScreen("nutrition")}
      onOpenWorkouts={() => setActiveScreen("workouts")}
      onOpenReminders={() => setActiveScreen("reminders")}
      onLogout={handleLogout}
    />;
  }

  return <AuthScreen mode={mode} onModeChange={setMode} onAuthenticated={handleAuthenticated} />;
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <BrandMark size="large" />
      <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
    </SafeAreaView>
  );
}

function AuthScreen({
  mode,
  onModeChange,
  onAuthenticated
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: (response: AuthResponse) => Promise<void>;
}) {
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const emailLooksValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);

  const switchMode = (nextMode: AuthMode) => {
    setErrorMessage("");
    setPassword("");
    setConfirmation("");
    onModeChange(nextMode);
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    if (isRegister && !name.trim()) return setErrorMessage("Informe seu nome para criar a conta.");
    if (!emailLooksValid) return setErrorMessage("Digite um e-mail válido.");
    if (password.length < 8) return setErrorMessage("A senha precisa ter pelo menos 8 caracteres.");
    const passwordBytes = utf8ByteLength(password);
    if (passwordBytes > 72) return setErrorMessage("A senha pode ter no máximo 72 bytes em UTF-8.");
    if (isRegister && password !== confirmation) return setErrorMessage("As senhas não coincidem.");

    setSubmitting(true);
    try {
      const response = isRegister
        ? await register({ name: name.trim(), email: email.trim().toLowerCase(), password })
        : await login({ email: email.trim().toLowerCase(), password });
      await onAuthenticated(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível autenticar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topLine}>
            <Brand />
            <View style={styles.topBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.topBadgeText} numberOfLines={1}>SEU RITMO. SUA EVOLUÇÃO.</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>FORÇA CONSTRUÍDA UM DIA DE CADA VEZ</Text>
            <Text style={styles.headline}>Mais forte{"\n"}<Text style={styles.headlineAccent}>a cada treino.</Text></Text>
            <Text style={styles.heroCopy}>Treino, alimentação e progresso em um só lugar. Comece com o seu próximo passo.</Text>
          </View>

          <View style={styles.authCard}>
            <View style={styles.modeSwitch} accessibilityRole="tablist">
              <ModeTab label="Entrar" active={!isRegister} onPress={() => switchMode("login")} />
              <ModeTab label="Criar conta" active={isRegister} onPress={() => switchMode("register")} />
            </View>

            <Text style={styles.formTitle}>{isRegister ? "Crie seu espaço" : "Bom ter você de volta"}</Text>
            <Text style={styles.formSubtitle}>{isRegister ? "Seu próximo objetivo começa por aqui." : "Entre para continuar de onde parou."}</Text>

            {isRegister && (
              <FormField
                label="NOME"
                value={name}
                onChangeText={setName}
                placeholder="Como podemos chamar você?"
                autoComplete="name"
                returnKeyType="next"
                editable={!submitting}
              />
            )}

            <FormField
              label="E-MAIL"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
              editable={!submitting}
            />

            <FormField
              label="SENHA"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo de 8 caracteres"
              secureTextEntry={!showPassword}
              autoComplete={isRegister ? "new-password" : "current-password"}
              returnKeyType={isRegister ? "next" : "go"}
              editable={!submitting}
              onSubmitEditing={isRegister ? undefined : handleSubmit}
              rightAction={(
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar senha" : "Exibir senha"}
                  onPress={() => setShowPassword((value) => !value)}
                  hitSlop={10}
                >
                  <Text style={styles.showPassword}>{showPassword ? "OCULTAR" : "EXIBIR"}</Text>
                </Pressable>
              )}
            />

            {isRegister && (
              <FormField
                label="CONFIRMAR SENHA"
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="Digite a senha mais uma vez"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="go"
                editable={!submitting}
                onSubmitEditing={handleSubmit}
              />
            )}

            {!isRegister && (
              <View style={styles.secureNote}>
                <Text style={styles.lockGlyph}>◆</Text>
                <Text style={styles.secureNoteText}>Sua sessão é protegida com criptografia.</Text>
              </View>
            )}

            {errorMessage ? (
              <View style={styles.errorBox} accessible accessibilityLabel={`Erro: ${errorMessage}`}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submitButton, pressed && !submitting && styles.submitPressed, submitting && styles.submitDisabled]}
            >
              {submitting ? <ActivityIndicator color={C.background} /> : (
                <>
                  <Text style={styles.submitText}>{isRegister ? "Criar minha conta" : "Entrar na minha conta"}</Text>
                  <Text style={styles.submitArrow}>↗</Text>
                </>
              )}
            </Pressable>

            <Text style={styles.termsText}>{isRegister ? "Ao continuar, use o app com responsabilidade." : "Ainda não tem uma conta?"}</Text>
            {!isRegister && (
              <Pressable onPress={() => switchMode("register")} style={styles.inlineLink} accessibilityRole="button">
                <Text style={styles.inlineLinkText}>Comece seu cadastro</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerRule} />
            <Text style={styles.footerText}>TREINO INTELIGENTE · PROGRESSO REAL</Text>
            <View style={styles.footerRule} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ label, rightAction, ...inputProps }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {rightAction}
      </View>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor="#708076"
        selectionColor={C.green}
        autoCorrect={false}
        accessible
        accessibilityLabel={label}
      />
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BrandMark({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <Image 
      source={require('./assets/fitsphere-icon.png')} 
      style={size === "large" ? styles.brandMarkLarge : styles.brandMark}
    />
  );
}

function Brand() {
  return (
    <View style={styles.brandRow}>
      <BrandMark />
      <View>
        <Text style={styles.brandName}>FIT SPHERE</Text>
        <Text style={styles.brandSub}>FITNESS & NUTRIÇÃO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: C.background },
  loadingScreen: { flex: 1, backgroundColor: C.background, alignItems: "center", justifyContent: "center" },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 28 },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, borderColor: 'lime', borderWidth: 1.5, overflow: 'hidden' },
  brandMarkLarge: { width: 48, height: 48, borderRadius: 15, borderColor: 'lime', borderWidth: 1.5, overflow: 'hidden' },
  brandName: { color: C.text, letterSpacing: 1.3, fontWeight: "900", fontSize: 12 },
  brandSub: { color: C.muted, letterSpacing: 1.25, fontSize: 8, marginTop: 3 },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 8, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border, flexShrink: 1, maxWidth: 158 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  topBadgeText: { color: C.muted, fontSize: 7, letterSpacing: 0.45, fontWeight: "700", flexShrink: 1 },
  hero: { marginTop: 42, marginBottom: 28 },
  eyebrow: { color: C.green, fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
  headline: { color: C.text, fontSize: 42, fontWeight: "900", lineHeight: 46, letterSpacing: -1.3, marginTop: 13 },
  headlineAccent: { color: C.green },
  heroCopy: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 12, maxWidth: 330 },
  authCard: { backgroundColor: C.surface, borderRadius: 22, borderColor: C.border, borderWidth: 1, padding: 18 },
  modeSwitch: { flexDirection: "row", backgroundColor: C.background, padding: 4, borderRadius: 13, marginBottom: 22 },
  modeTab: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  modeTabActive: { backgroundColor: C.surfaceRaised },
  modeTabText: { color: C.muted, fontSize: 12, fontWeight: "700" },
  modeTabTextActive: { color: C.text },
  formTitle: { color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  formSubtitle: { color: C.muted, fontSize: 12, marginTop: 5, marginBottom: 19 },
  fieldGroup: { marginBottom: 15 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  fieldLabel: { color: "#B5C0B8", fontSize: 9, letterSpacing: 1.2, fontWeight: "800" },
  showPassword: { color: C.green, fontSize: 9, letterSpacing: 0.8, fontWeight: "800" },
  input: { minHeight: 49, borderRadius: 11, borderWidth: 1, borderColor: C.border, backgroundColor: C.background, color: C.text, paddingHorizontal: 14, fontSize: 13 },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 1, marginBottom: 17 },
  lockGlyph: { fontSize: 8, color: C.green },
  secureNoteText: { color: C.muted, fontSize: 10 },
  errorBox: { flexDirection: "row", gap: 9, padding: 11, backgroundColor: "#321D1D", borderRadius: 10, borderWidth: 1, borderColor: "#663936", marginBottom: 14 },
  errorIcon: { color: C.red, fontWeight: "900", fontSize: 12 },
  errorText: { color: "#FFC2BD", fontSize: 11, lineHeight: 16, flex: 1 },
  submitButton: { minHeight: 52, borderRadius: 12, paddingHorizontal: 16, backgroundColor: C.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  submitPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  submitDisabled: { opacity: 0.65 },
  submitText: { color: C.background, fontWeight: "900", fontSize: 13 },
  submitArrow: { color: C.background, fontWeight: "900", fontSize: 18, marginTop: -2 },
  termsText: { color: C.muted, textAlign: "center", fontSize: 10, lineHeight: 15, marginTop: 16 },
  inlineLink: { alignSelf: "center", paddingVertical: 7 },
  inlineLinkText: { color: C.green, fontSize: 11, fontWeight: "800" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24 },
  footerRule: { height: 1, flex: 1, backgroundColor: C.border },
  footerText: { color: "#718077", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
});
