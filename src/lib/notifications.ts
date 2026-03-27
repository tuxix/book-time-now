import { supabase } from "@/integrations/supabase/client";

export function notificationsSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

export function getPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(title: string, body: string, options?: NotificationOptions) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", ...options });
    });
  } else {
    new Notification(title, { body, icon: "/icons/icon-192.png", ...options });
  }
}

export async function storePushSubscription(userId: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: undefined,
      }).catch(() => null);
    }
    if (sub) {
      await supabase.from("push_subscriptions").upsert(
        { user_id: userId, subscription: sub.toJSON() as any },
        { onConflict: "user_id" }
      );
    }
  } catch {}
}

export const NOTIFICATION_PROMPT_KEY = "booka-notif-prompted";
