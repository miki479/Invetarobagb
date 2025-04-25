import { initializeApp } from "https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js";
import { getMessaging, getToken, onMessage, useServiceWorker } from "https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js";


const firebaseConfig = {
  apiKey: "AIzaSyD2LEAWh-YprhDjKC_jNwAasLDWFhbzPMw",
  authDomain: "inventario-6f07c.firebaseapp.com",
  projectId: "inventario-6f07c",
  storageBucket: "inventario-6f07c.firebasestorage.app",
  messagingSenderId: "612609692422",
  appId: "1:612609692422:web:f49d1d406bd182ec8c4487",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Registrazione service worker
navigator.serviceWorker.register('/firebase-messaging-sw.js').then((registration) => {
  // Configura il service worker con Firebase Messaging
  setBackgroundMessageHandler(messaging, (payload) => {
    console.log('Messaggio in background:', payload);
    // Puoi personalizzare la gestione della notifica qui
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/icons/icon-192.png',
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  // Chiedi permesso per le notifiche
  Notification.requestPermission().then((permission) => {
    if (permission === 'granted') {
      console.log('Permesso notifiche concesso.');
      getToken(messaging, {
        vapidKey: 'bxyYRDwHWuofEpDI428MVD9Is5cB9s8pDUwGDuzc4s8'
      }).then((currentToken) => {
        if (currentToken) {
          console.log('FCM Token:', currentToken);
          // Qui puoi inviare il token a Firestore o al tuo server se necessario
        } else {
          console.warn('Nessun token FCM disponibile.');
        }
      }).catch((err) => {
        console.error('Errore recupero token:', err);
      });
    } else {
      console.warn('Permesso notifiche negato.');
    }
  });
});

// Gestione messaggi in foreground
onMessage(messaging, (payload) => {
  console.log('Messaggio in foreground:', payload);
  alert(`Notifica: ${payload.notification.title} - ${payload.notification.body}`);
});
