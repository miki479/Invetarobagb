// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2LEAWh-YprhDjKC_jNwAasLDWFhbzPMw",
  authDomain: "inventario-6f07c.firebaseapp.com",
  databaseURL: "https://inventario-6f07c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "inventario-6f07c",
  storageBucket: "inventario-6f07c.appspot.com",
  messagingSenderId: "612609692422",
  appId: "1:612609692422:web:f49d1d406bd182ec8c4487",
  measurementId: "G-1E9Z6B0FFR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };