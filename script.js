import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Firebase config
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

// Registriamo il Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registrato con successo:', registration);
      })
      .catch((error) => {
        console.log('Errore nel registrare il Service Worker:', error);
      });
  });
}

if (!localStorage.getItem("nomeUtente")) {
  const nomeUtente = prompt("Inserisci il tuo nome:");
  localStorage.setItem("nomeUtente", nomeUtente || "Anonimo");
}

async function addCollarino() {
  const name = document.getElementById("newName").value.trim();
  const code = document.getElementById("newCode").value.trim();
  const qty = parseInt(document.getElementById("newQty").value);
  const qrVecchio = document.getElementById("qrVecchio").checked;

  if (!name || isNaN(qty)) return alert("Compila tutti i campi correttamente.");

  if (!code) return alert("Il codice è obbligatorio.");

  const esiste = await getDoc(doc(db, "collarini", code));
  if (esiste.exists()) {
    const dati = esiste.data();
    if (dati.name.toLowerCase() === name.toLowerCase()) {
      return alert("Collarino già esistente con stesso nome e codice.");
    }
  }

  await setDoc(doc(db, "collarini", code), {
    name,
    code,
    qty,
    qrVecchio,
    lastModifiedBy: localStorage.getItem("nomeUtente")
  });

  aggiornaLista();
}

async function updateQty() {
  const search = document.getElementById("searchCode").value.trim().toLowerCase();
  const amount = parseInt(document.getElementById("adjustQty").value);
  const sign = document.getElementById("adjustSign").value; // Ottieni il valore del selettore

  if (!search || isNaN(amount)) return alert("Inserisci nome o codice e quantità valida");

  // Se l'utente ha selezionato "-" applica la quantità negativa
  const adjustedAmount = sign === "minus" ? -amount : amount;

  const q = query(collection(db, "collarini"));
  const snapshot = await getDocs(q);
  const matching = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.name.toLowerCase() === search || data.code.toLowerCase() === search) {
      matching.push(data);
    }
  });

  if (matching.length === 0) return alert("Collarino non trovato.");
  if (matching.length === 1) {
    const data = matching[0];
    const newQty = (data.qty || 0) + adjustedAmount; // Usa la quantità aggiustata
    await updateDoc(doc(db, "collarini", data.code), {
      qty: newQty,
      lastModifiedBy: localStorage.getItem("nomeUtente")
    });
    return aggiornaLista();
  }

  mostraScelte(matching, async selected => {
    const newQty = (selected.qty || 0) + adjustedAmount; // Usa la quantità aggiustata
    await updateDoc(doc(db, "collarini", selected.code), {
      qty: newQty,
      lastModifiedBy: localStorage.getItem("nomeUtente")
    });
    aggiornaLista();
  });
}


async function calcolaDaPeso() {
  const search = document.getElementById("calcCode").value.trim().toLowerCase();
  const pesoKg = parseFloat(document.getElementById("weightInput").value);
  if (!search || isNaN(pesoKg)) return alert("Dati non validi");

  const collariniDaAggiungere = Math.floor((pesoKg * 1000) / 3);
  if (collariniDaAggiungere <= 0) return alert("Peso insufficiente per 1 collarino");

  const q = query(collection(db, "collarini"));
  const snapshot = await getDocs(q);
  const matching = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.name.toLowerCase() === search || data.code.toLowerCase() === search) {
      matching.push(data);
    }
  });

  if (matching.length === 0) return alert("Collarino non trovato.");
  if (matching.length === 1) {
    const data = matching[0];
    const newQty = (data.qty || 0) + collariniDaAggiungere;
    await updateDoc(doc(db, "collarini", data.code), {
      qty: newQty,
      lastModifiedBy: localStorage.getItem("nomeUtente")
    });
    return aggiornaLista();
  }

  mostraScelte(matching, async selected => {
    const newQty = (selected.qty || 0) + collariniDaAggiungere;
    await updateDoc(doc(db, "collarini", selected.code), {
      qty: newQty,
      lastModifiedBy: localStorage.getItem("nomeUtente")
    });
    aggiornaLista();
  });
}

async function aggiornaLista() {
  const container = document.getElementById("inventoryList");
  const search = document.getElementById("liveSearch").value.toLowerCase();
  const soloBassoStock = document.getElementById("filtroBassoStock").checked;
  const soloQrVecchio = document.getElementById("filtroQrVecchio").checked;

  const q = query(collection(db, "collarini"));
  const snapshot = await getDocs(q);

  container.innerHTML = "";
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (
      (!search || data.name.toLowerCase().includes(search) || data.code.toLowerCase().includes(search)) &&
      (!soloBassoStock || data.qty < 120) &&
      (!soloQrVecchio || data.qrVecchio)
    ) {
      const item = document.createElement("div");
      item.className = "item";
      item.onclick = () => apriModale(data);
      item.innerHTML = `
        <strong>${data.name}</strong> (${data.code}) - ${data.qty}
        ${data.qrVecchio ? "<span class='tag'>QR Vecchio</span>" : ""}
        ${data.qty < 120 ? "<span class='warning'>Da ordinare</span>" : ""}
        <div class="mod-info">Ultima modifica: ${data.lastModifiedBy || "N/A"}</div>
      `;
      container.appendChild(item);
    }
  });
}




function apriModale(collarino) {
  document.getElementById("editName").value = collarino.name;
  document.getElementById("editCode").value = collarino.code;
  document.getElementById("editQrVecchio").checked = !!collarino.qrVecchio;
  document.getElementById("editModal").setAttribute("data-id", collarino.code);
  document.getElementById("editModal").style.display = "flex";
}

function chiudiModale() {
  document.getElementById("editModal").style.display = "none";
  document.getElementById("selezioneModal").style.display = "none";
}

async function salvaModifiche() {
  const id = document.getElementById("editModal").getAttribute("data-id");
  const newName = document.getElementById("editName").value.trim();
  const newCode = document.getElementById("editCode").value.trim();
  const qrVecchio = document.getElementById("editQrVecchio").checked;

  if (!newName || !newCode) return alert("Nome e codice obbligatori");

  await updateDoc(doc(db, "collarini", id), {
    name: newName,
    code: newCode,
    qrVecchio,
    lastModifiedBy: localStorage.getItem("nomeUtente")
  });

  chiudiModale();
  aggiornaLista();
}

async function eliminaSenzaConferma() {
  const id = document.getElementById("editModal").getAttribute("data-id");
  await deleteDoc(doc(db, "collarini", id));
  chiudiModale();
  aggiornaLista();
}

function mostraScelte(collarini, callback) {
  const container = document.getElementById("scelteDuplicati");
  container.innerHTML = "";

  collarini.forEach(c => {
    const btn = document.createElement("button");
    btn.textContent = `${c.name} (${c.code}) - ${c.qty} ${c.qrVecchio ? "• QR Vecchio" : ""}`;
    btn.onclick = () => {
      chiudiModale();
      callback(c);
    };
    container.appendChild(btn);
  });

  document.getElementById("selezioneModal").style.display = "flex";
}



window.addCollarino = addCollarino;
window.updateQty = updateQty;
window.calcolaDaPeso = calcolaDaPeso;
window.aggiornaLista = aggiornaLista;
window.chiudiModale = chiudiModale;
window.salvaModifiche = salvaModifiche;
window.eliminaSenzaConferma = eliminaSenzaConferma;


window.onload = aggiornaLista;

