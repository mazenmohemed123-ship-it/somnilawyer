// مُحكَم — Firebase Cloud Messaging Service Worker
// Loaded by the browser for background push notifications.
// Uses the compat builds so the SW works without a bundler.
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// These values are public (web push config). Replace with your project's.
self.__MOHKAM_FCM_CONFIG = self.__MOHKAM_FCM_CONFIG || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

try {
  if (self.__MOHKAM_FCM_CONFIG.projectId) {
    firebase.initializeApp(self.__MOHKAM_FCM_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'مُحكَم';
      const options = {
        body: (payload.notification && payload.notification.body) || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        data: payload.data || {},
      };
      self.registration.showNotification(title, options);
    });
  }
} catch (e) {
  // Graceful no-op if FCM is not configured.
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(target));
});
