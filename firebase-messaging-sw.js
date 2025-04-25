importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD2LEAWh-YprhDjKC_jNwAasLDWFhbzPMw",
  authDomain: "inventario-6f07c.firebaseapp.com",
  projectId: "inventario-6f07c",
  storageBucket: "inventario-6f07c.firebasestorage.app",
  messagingSenderId: "612609692422",
  appId: "1:612609692422:web:f49d1d406bd182ec8c4487",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Ricevuto messaggio in background:', payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title, { body });
});