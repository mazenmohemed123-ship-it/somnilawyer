// Somni Lawyer — Firebase Cloud Messaging Service Worker
// Loaded by the browser for background push notifications.
// Uses the compat builds so the SW works without a bundler.
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// These values are public (web push config). Configured for somini-lawyer project.
self.__SOMNI_FCM_CONFIG = self.__SOMNI_FCM_CONFIG || {
  apiKey: 'AIzaSyBTeDZoQrcbX8BnmnwRQXzc-QYR34a3F-w',
  authDomain: 'somini-lawyer.firebaseapp.com',
  projectId: 'somini-lawyer',
  storageBucket: 'somini-lawyer.firebasestorage.app',
  messagingSenderId: '63834223472',
  appId: '1:63834223472:web:438a13851a9f896a3b15b5',
};

try {
  if (self.__SOMNI_FCM_CONFIG.projectId) {
    firebase.initializeApp(self.__SOMNI_FCM_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = (payload.notification && payload.notification.title) || 'Somni Lawyer';
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
