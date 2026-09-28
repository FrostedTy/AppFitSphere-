import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { MealReminderId, ReminderPermissionState, ReminderSettings } from "../types/reminders";
import { buildReminderPlan, cloneDefaultReminderSettings, mealNotificationContent, validateReminderSettings } from "../utils/reminder-settings";

const STORAGE_KEY = "hipertrofia.reminders.v1";
const APP_TAG = "hipertrofia-local-reminder";
const ANDROID_CHANNEL_ID = "fitness-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

function permissionIsGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  if (status.granted) return true;
  if (Platform.OS !== "ios" || status.ios?.status === undefined) return false;
  return [
    Notifications.IosAuthorizationStatus.AUTHORIZED,
    Notifications.IosAuthorizationStatus.PROVISIONAL,
    Notifications.IosAuthorizationStatus.EPHEMERAL
  ].includes(status.ios.status);
}

export async function getReminderPermissionState(): Promise<ReminderPermissionState> {
  if (Platform.OS === "web") return "unsupported";
  const status = await Notifications.getPermissionsAsync();
  return permissionIsGranted(status) ? "granted" : status.status === "undetermined" ? "unknown" : "denied";
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneDefaultReminderSettings();
  try {
    const value: unknown = JSON.parse(stored);
    return validateReminderSettings(value) ? value : cloneDefaultReminderSettings();
  } catch {
    return cloneDefaultReminderSettings();
  }
}

async function ensurePermission(): Promise<void> {
  if (Platform.OS === "web") throw new Error("Lembretes locais estão disponíveis no app instalado para iOS e Android.");
  // Android 13+ exige um canal criado antes de exibir o prompt do sistema.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Lembretes de refeições e treinos",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#B8F36A"
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (permissionIsGranted(current)) return;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true }
  });
  if (!permissionIsGranted(requested)) {
    throw new Error("Permissão para notificações não concedida. Ative os avisos do Hipertrofia nas configurações do dispositivo.");
  }
}

async function cancelAppReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.content.data?.reminderSource === APP_TAG)
    .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

async function scheduleSettings(settings: ReminderSettings): Promise<void> {
  const plan = buildReminderPlan(settings);
  await Promise.all(plan.map((item) => {
    const isWorkout = item.kind === "workout";
    const mealId = item.key.replace("meal-", "") as MealReminderId;
    const content = isWorkout
      ? { title: "Horário do seu treino", body: "Sua sessão está prevista para agora. Abra o Hipertrofia e acompanhe suas séries." }
      : mealNotificationContent[mealId];
    const trigger: Notifications.NotificationTriggerInput = isWorkout
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: (item.weekday ?? 0) + 1,
          hour: item.hour,
          minute: item.minute,
          ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {})
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: item.hour,
          minute: item.minute,
          ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {})
        };
    return Notifications.scheduleNotificationAsync({
      content: { ...content, sound: "default", data: { reminderSource: APP_TAG, reminderKey: item.key } },
      trigger
    });
  }));
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<number> {
  if (!validateReminderSettings(settings)) throw new Error("Revise os horários e dias escolhidos para os lembretes.");
  const plan = buildReminderPlan(settings);
  if (plan.length > 0) await ensurePermission();

  const previous = await getReminderSettings();
  try {
    await cancelAppReminders();
    await scheduleSettings(settings);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Se o agendamento falhar no meio, desfaz parcialmente e restaura o conjunto anterior.
    await cancelAppReminders().catch(() => undefined);
    if (buildReminderPlan(previous).length > 0) await scheduleSettings(previous).catch(() => undefined);
    throw error;
  }
  return plan.length;
}

export { buildReminderPlan, validateReminderSettings };
