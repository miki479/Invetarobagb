import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Configurazione Firebase
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

// Variabili globali
let collarini = [];
let usageChart = null;

// Funzione toggleSection
function toggleSection(sectionId, forceOpen = false) {
  const section = document.getElementById(sectionId);
  const icon = document.querySelector(`[data-target="${sectionId}"] .toggle-icon`);
  
  if (forceOpen || section.style.display !== 'block') {
    section.style.display = 'block';
    if (icon) icon.textContent = '▲';
    if (sectionId === 'historyContent') loadHistory();
  } else {
    section.style.display = 'none';
    if (icon) icon.textContent = '▼';
  }
}

// Altre funzioni...
async function addCollarino() {
  const name = document.getElementById("newName").value.trim();
  const code = document.getElementById("newCode").value.trim();
  const qty = parseInt(document.getElementById("newQty").value);
  const qrVecchio = document.getElementById("qrVecchio").checked;

  if (!name || !code || isNaN(qty)) {
    alert("Compila tutti i campi correttamente");
    return;
  }

  try {
    const docRef = doc(db, "collarini", code);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      alert("Un collarino con questo codice esiste già");
      return;
    }

    await setDoc(docRef, {
      name,
      code,
      qty,
      qrVecchio,
      lastModifiedBy: localStorage.getItem("nomeUtente"),
      usageCount: 0,
      lastUpdated: serverTimestamp()
    });

    await logAction("add", code, { name, qty, qrVecchio });
    document.getElementById("addCollarinoForm").reset();
    await aggiornaLista();
    await updateDashboard();
  } catch (error) {
    console.error("Errore aggiunta collarino:", error);
    alert("Errore durante l'aggiunta");
  }
}

async function updateQty() {
  const search = document.getElementById("searchCode").value.trim().toLowerCase();
  const amount = parseInt(document.getElementById("adjustQty").value);
  const isSubtract = document.getElementById("adjustSign").value === "minus";

  if (!search || isNaN(amount)) {
    alert("Inserisci nome/codice e quantità valida");
    return;
  }

  try {
    const q = query(collection(db, "collarini"));
    const snapshot = await getDocs(q);
    const matching = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.name.toLowerCase().includes(search) || 
          data.code.toLowerCase().includes(search)) {
        matching.push({ id: docSnap.id, ...data });
      }
    });

    if (matching.length === 0) {
      alert("Nessun collarino trovato");
      return;
    }

    if (matching.length === 1) {
      await processUpdate(matching[0], isSubtract ? -amount : amount);
      return;
    }

    mostraScelte(matching, async (selected) => {
      await processUpdate(selected, isSubtract ? -amount : amount);
    });
  } catch (error) {
    console.error("Errore aggiornamento quantità:", error);
    alert("Errore durante l'aggiornamento");
  }
}

async function processUpdate(collarino, amount) {
  const newQty = collarino.qty + amount;
  if (newQty < 0) {
    alert("La quantità non può essere negativa");
    return;
  }

  await updateDoc(doc(db, "collarini", collarino.id), {
    qty: newQty,
    lastModifiedBy: localStorage.getItem("nomeUtente"),
    usageCount: (collarino.usageCount || 0) + 1,
    lastUpdated: serverTimestamp()
  });

  await logAction("update", collarino.id, {
    oldQty: collarino.qty,
    newQty,
    change: amount
  });

  document.getElementById("updateQtyForm").reset();
  await aggiornaLista();
  await updateDashboard();
}

async function calcolaDaPeso() {
  const search = document.getElementById("calcCode").value.trim().toLowerCase();
  const pesoKg = parseFloat(document.getElementById("weightInput").value);

  if (!search || isNaN(pesoKg)) {
    alert("Inserisci nome/codice e peso validi");
    return;
  }

  const collariniDaAggiungere = Math.floor((pesoKg * 1000) / 3);
  if (collariniDaAggiungere <= 0) {
    alert("Peso insufficiente per generare collarini");
    return;
  }

  try {
    const q = query(collection(db, "collarini"));
    const snapshot = await getDocs(q);
    const matching = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.name.toLowerCase().includes(search) || 
          data.code.toLowerCase().includes(search)) {
        matching.push({ id: docSnap.id, ...data });
      }
    });

    if (matching.length === 0) {
      alert("Nessun collarino trovato");
      return;
    }

    if (matching.length === 1) {
      await processUpdate(matching[0], collariniDaAggiungere);
      document.getElementById("weightForm").reset();
      return;
    }

    mostraScelte(matching, async (selected) => {
      await processUpdate(selected, collariniDaAggiungere);
      document.getElementById("weightForm").reset();
    });
  } catch (error) {
    console.error("Errore calcolo da peso:", error);
    alert("Errore durante l'operazione");
  }
}

async function aggiornaLista() {
  const searchTerm = document.getElementById("liveSearch").value.toLowerCase();
  const soloBassoStock = document.getElementById("filtroBassoStock").checked;
  const soloQrVecchio = document.getElementById("filtroQrVecchio").checked;

  try {
    const q = query(collection(db, "collarini"));
    const snapshot = await getDocs(q);
    collarini = [];
    const container = document.getElementById("inventoryList");
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      collarini.push({ id: docSnap.id, ...data });
    });

    collarini
      .filter(c => 
        (!searchTerm || 
         c.name.toLowerCase().includes(searchTerm) || 
         c.code.toLowerCase().includes(searchTerm)) &&
        (!soloBassoStock || c.qty < 120) &&
        (!soloQrVecchio || c.qrVecchio)
      )
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .forEach(c => {
        const item = document.createElement("div");
        item.className = "item";
        item.onclick = () => apriModale(c);
        
        item.innerHTML = `
          <div class="item-header">
            <span class="item-name">${c.name}</span>
            <span class="item-qty">${c.qty}</span>
          </div>
          <div class="item-code">${c.code}</div>
          <div class="item-tags">
            ${c.qrVecchio ? '<span class="tag tag-info">QR Vecchio</span>' : ''}
            ${c.qty < 120 ? '<span class="tag tag-danger">Da ordinare</span>' : ''}
            ${(c.usageCount || 0) > 10 ? '<span class="tag tag-warning">Frequente</span>' : ''}
          </div>
          <div class="item-meta">
            Ultima modifica: ${c.lastModifiedBy || "N/A"}
            ${c.lastUpdated ? `<br>${c.lastUpdated.toDate().toLocaleString()}` : ''}
          </div>
        `;
        
        container.appendChild(item);
      });
  } catch (error) {
    console.error("Errore caricamento inventario:", error);
  }
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "<div class='history-item'>Caricamento...</div>";
  
  try {
    const q = query(
      collection(db, "audit_log"), 
      orderBy("timestamp", "desc"), 
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    historyList.innerHTML = "";
    
    if (snapshot.empty) {
      historyList.innerHTML = "<div class='history-item'>Nessuna attività recente</div>";
      return;
    }
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = document.createElement("div");
      item.className = "history-item";
      
      const actionMap = {
        add: { text: "Aggiunto", class: "add" },
        update: { text: "Aggiornato", class: "update" },
        delete: { text: "Eliminato", class: "delete" }
      };
      
      const action = actionMap[data.action] || { text: "Azione", class: "" };
      
      item.innerHTML = `
        <div>
          <span class="history-action ${action.class}">${action.text}</span>
          ${data.itemCode}
        </div>
        <div class="history-details">
          ${formatDetails(data.details)}
        </div>
        <div class="history-timestamp">
          ${data.timestamp?.toDate().toLocaleString() || "N/A"} - ${data.user}
        </div>
      `;
      
      historyList.appendChild(item);
    });
  } catch (error) {
    console.error("Errore caricamento cronologia:", error);
    historyList.innerHTML = "<div class='history-item'>Errore nel caricamento</div>";
  }
}

function formatDetails(details) {
  if (!details) return "";
  
  return Object.entries(details)
    .map(([key, value]) => {
      if (key === 'oldQty' || key === 'newQty') {
        return `${key}: ${value}`;
      }
      if (typeof value === 'object') {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    })
    .join('<br>');
}

async function logAction(action, itemCode, details = {}) {
  try {
    await setDoc(doc(db, "audit_log", Date.now().toString()), {
      action,
      itemCode,
      user: localStorage.getItem("nomeUtente"),
      timestamp: serverTimestamp(),
      details
    });
  } catch (error) {
    console.error("Errore log azione:", error);
  }
}

async function updateDashboard() {
  try {
    // Totale collarini
    const totalSnapshot = await getDocs(collection(db, "collarini"));
    document.getElementById("totalItems").textContent = totalSnapshot.size;
    
    // Scorte basse
    const lowStockQuery = query(
      collection(db, "collarini"), 
      where("qty", "<", 120)
    );
    const lowStockSnapshot = await getDocs(lowStockQuery);
    document.getElementById("lowStockItems").textContent = lowStockSnapshot.size;
    
    // QR vecchi
    const oldQrQuery = query(
      collection(db, "collarini"), 
      where("qrVecchio", "==", true)
    );
    const oldQrSnapshot = await getDocs(oldQrQuery);
    document.getElementById("oldQrItems").textContent = oldQrSnapshot.size;
    
    // Collarini più usati (usageCount > 5)
    const activeQuery = query(
      collection(db, "collarini"), 
      where("usageCount", ">", 5)
    );
    const activeSnapshot = await getDocs(activeQuery);
    document.getElementById("activeItems").textContent = activeSnapshot.size;
    
    // Aggiorna grafico utilizzo
    updateUsageChart();
  } catch (error) {
    console.error("Errore aggiornamento dashboard:", error);
  }
}

function initCharts() {
  const ctx = document.getElementById('usageChart').getContext('2d');
  usageChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Utilizzi',
        data: [],
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function updateUsageChart() {
  if (!usageChart) return;
  
  // Prendi i top 5 collarini per usageCount
  const topUsed = [...collarini]
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 5);
  
  usageChart.data.labels = topUsed.map(c => c.name);
  usageChart.data.datasets[0].data = topUsed.map(c => c.usageCount || 0);
  usageChart.update();
}

function apriModale(collarino) {
  document.getElementById("editName").value = collarino.name;
  document.getElementById("editCode").value = collarino.code;
  document.getElementById("editQrVecchio").checked = !!collarino.qrVecchio;
  document.getElementById("editModal").setAttribute("data-id", collarino.id);
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

  if (!newName || !newCode) {
    alert("Nome e codice sono obbligatori");
    return;
  }

  try {
    const currentDoc = await getDoc(doc(db, "collarini", id));
    const currentData = currentDoc.data();
    
    await updateDoc(doc(db, "collarini", id), {
      name: newName,
      code: newCode,
      qrVecchio,
      lastModifiedBy: localStorage.getItem("nomeUtente"),
      lastUpdated: serverTimestamp()
    });

    await logAction("update", id, {
      oldName: currentData.name,
      newName,
      oldCode: currentData.code,
      newCode,
      qrVecchio
    });

    chiudiModale();
    await aggiornaLista();
    await updateDashboard();
  } catch (error) {
    console.error("Errore salvataggio modifiche:", error);
    alert("Errore durante il salvataggio");
  }
}

async function eliminaConConferma() {
  if (!confirm("Sei sicuro di voler eliminare questo collarino?")) return;
  
  const id = document.getElementById("editModal").getAttribute("data-id");
  
  try {
    const docSnap = await getDoc(doc(db, "collarini", id));
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    await logAction("delete", id, data);
    await deleteDoc(doc(db, "collarini", id));
    
    chiudiModale();
    await aggiornaLista();
    await updateDashboard();
  } catch (error) {
    console.error("Errore eliminazione:", error);
    alert("Errore durante l'eliminazione");
  }
}

function mostraScelte(items, callback) {
  const container = document.getElementById("scelteDuplicati");
  container.innerHTML = "";

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "selection-item";
    btn.innerHTML = `
      <div>${item.name} (${item.code})</div>
      <div class="selection-details">
        <span>Quantità: ${item.qty}</span>
        ${item.usageCount ? `<span>Usi: ${item.usageCount}</span>` : ''}
      </div>
    `;
    btn.onclick = () => {
      chiudiModale();
      callback(item);
    };
    container.appendChild(btn);
  });

  document.getElementById("selezioneModal").style.display = "flex";
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
  // Setup event listeners
  document.querySelectorAll('.section-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
      const sectionId = this.getAttribute('data-target');
      toggleSection(sectionId);
    });
  });

  document.getElementById("addButton").addEventListener('click', addCollarino);
  document.getElementById("updateButton").addEventListener('click', updateQty);
  document.getElementById("weightButton").addEventListener('click', calcolaDaPeso);
  document.getElementById("saveButton").addEventListener('click', salvaModifiche);
  document.getElementById("deleteButton").addEventListener('click', eliminaConConferma);
  document.getElementById("closeModal").addEventListener('click', chiudiModale);
  document.getElementById("liveSearch").addEventListener('input', aggiornaLista);
  document.getElementById("filtroBassoStock").addEventListener('change', aggiornaLista);
  document.getElementById("filtroQrVecchio").addEventListener('change', aggiornaLista);
  document.getElementById("historySearch").addEventListener('input', filterHistory);

  // Inizializzazione utente
  if (!localStorage.getItem("nomeUtente")) {
    const nomeUtente = prompt("Inserisci il tuo nome:") || "Anonimo";
    localStorage.setItem("nomeUtente", nomeUtente);
  }
  document.getElementById("userBadge").textContent = localStorage.getItem("nomeUtente");

  // Inizializzazione grafici
  initCharts();

  // Caricamento iniziale
  toggleSection('dashboardContent', true);
  aggiornaLista();
});

// Funzione filterHistory (se non già presente)
function filterHistory() {
  const searchTerm = document.getElementById("historySearch").value.toLowerCase();
  const items = document.querySelectorAll(".history-item");
  
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(searchTerm) ? "block" : "none";
  });
}