import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";

// Config Firebase
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

// 1️⃣ Service Worker per modalità offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker offline registrato'))
    .catch(err => console.error('Errore registrazione SW offline:', err));
}

