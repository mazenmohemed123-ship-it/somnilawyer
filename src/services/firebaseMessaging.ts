import { supabase } from './supabase';

// Requests an FCM token and stores it on the profile. Fully graceful: if Firebase
// env vars are missing or the browser denies permission, it resolves with null.
export async function enablePushNotifications(userId: string): Promise<string | null> {
  try {
    const cfg = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!cfg.projectId || !vapidKey || !('serviceWorker' in navigator)) return null;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    // Dynamic import keeps Firebase out of the main bundle when unused.
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = initializeApp(cfg as any);
    const messaging = getMessaging(app);

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (token) {
      await supabase.from('profiles').update({ fcm_token: token }).eq('id', userId);
    }
    return token ?? null;
  } catch {
    return null;
  }
}
