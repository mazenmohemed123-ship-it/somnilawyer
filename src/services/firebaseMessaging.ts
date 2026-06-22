import { doc, updateDoc } from 'firebase/firestore';
import { app, db } from '@/services/firebase';

export async function enablePushNotifications(userId: string): Promise<string | null> {
  try {
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey || !('serviceWorker' in navigator)) return null;

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return null;

    const { getMessaging, getToken } = await import('firebase/messaging');
    const messaging = getMessaging(app);

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcm_token: token });
    }
    return token ?? null;
  } catch {
    return null;
  }
}
