import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, serverTimestamp, onSnapshot
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
let collarini = [], recentModified = [], usageChart = null;

// Elementi DOM
const DOM = {
  loader: document.getElementById('loader'),
  menuToggle: document.getElementById('menuToggle'),
  sidebar: document.querySelector('.sidebar'),
  mainContent: document.querySelector('.main-content'),
  userBadge: document.getElementById('userBadge'),
  currentSectionTitle: document.getElementById('currentSectionTitle')
 };

// Utility
const utils = {
  showLoader: () => DOM.loader.style.display = 'block',
  hideLoader: () => DOM.loader.style.display = 'none',
  showSuccess: () => {
    const success = document.getElementById('success-animation');
    success.style.display = 'block';
    setTimeout(() => success.style.display = 'none', 2000);
  },
  updateSectionTitle: (sectionId) => {
    const titles = {
      'inventory-section': 'Inventario',
      'dashboard-section': 'Dashboard',
      'history-section': 'Cronologia',
      'add-section': 'Aggiungi Collarino',
      'update-section': 'Aggiorna Quantità',
      'weight-section': 'Aggiungi da Peso'
    };
    DOM.currentSectionTitle.textContent = titles[sectionId] || 'Inventario';
  }
};

utils.showToast = function(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000); // Sparisce dopo 3 secondi
};


// Gestione Menu
const setupMenu = () => {
  DOM.menuToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('active');
    DOM.mainContent.classList.toggle('menu-open');
  });

  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const sectionId = item.getAttribute('data-section');
      changeSection(sectionId);
      if (window.innerWidth <= 768) {
        DOM.sidebar.classList.remove('active');
        DOM.mainContent.classList.remove('menu-open');
      }
    });
  });
};

// Sezioni
// Debug per verificare se la sezione viene cambiata correttamente
const changeSection = (sectionId) => {
  console.log("Cambio sezione a:", sectionId); // Log per monitorare la sezione
  document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
  document.getElementById(sectionId).style.display = 'block';
  document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.menu-item[data-section="${sectionId}"]`).classList.add('active');
  utils.updateSectionTitle(sectionId);

  if (sectionId === 'inventory-section') {
    console.log("Caricamento inventario..."); // Log per verificare la sezione inventario
    aggiornaLista();
  } else if (sectionId === 'history-section') {
    console.log("Caricamento cronologia..."); // Log per verificare la sezione cronologia
    loadHistory();
  } else if (sectionId === 'dashboard-section') {
    console.log("Caricamento dashboard..."); // Log per verificare la sezione dashboard
    updateDashboard();
  } else if (sectionId === 'resoconto-section') {
    console.log("Caricamento resoconto..."); // Log per verificare quando si entra nella sezione resoconto
    loadResoconto();
  }
};

// Operazioni Database
const dbOperations = {
  async addCollarino() {
  utils.showLoader();
  const name = document.getElementById("newName").value.trim();
  const code = document.getElementById("newCode").value.trim().toUpperCase();
  const qty = parseInt(document.getElementById("newQty").value);
  const qrVecchio = document.getElementById("qrVecchio").checked;

  if (!name || !code || isNaN(qty)) {
    utils.hideLoader();
    return alert("Compila tutti i campi correttamente");
  }

  try {
    const docRef = doc(db, "collarini", code);
    if ((await getDoc(docRef)).exists()) {
      utils.hideLoader();
      return alert("Un collarino con questo codice esiste già");
    }

    const collarinoData = {
      name,
      code,
      qty,
      qrVecchio,
      lastModifiedBy: localStorage.getItem("nomeUtente"),
      usageCount: 0,
      lastUpdated: serverTimestamp()
    };

    await setDoc(docRef, collarinoData);
    await logAction("add", code, collarinoData);
    
    recentModified.unshift({ 
      id: code, 
      name, 
      code,
      qty, 
      qrVecchio,
      lastModifiedBy: localStorage.getItem("nomeUtente"),
      usageCount: 0
    });
    
    if (recentModified.length > 5) recentModified.pop();

    document.getElementById("newName").value = "";
    document.getElementById("newCode").value = "";
    document.getElementById("newQty").value = "";
    document.getElementById("qrVecchio").checked = false;

    await aggiornaLista();
    await updateDashboard();
    utils.showSuccess();
  } catch (error) {
    alert("Errore durante l'aggiunta: " + error.message);
  } finally {
    utils.hideLoader();
  }
},

  async updateQty() {
    utils.showLoader();
    const search = document.getElementById("searchCode").value.trim().toLowerCase();
    const amount = parseInt(document.getElementById("adjustQty").value);
    const isSubtract = document.getElementById("adjustSign").value === "minus";

    if (!search || isNaN(amount)) {
      utils.hideLoader();
      return alert("Inserisci nome/codice e quantità valida");
    }

    try {
      const matching = [];
      (await getDocs(query(collection(db, "collarini")))).forEach(docSnap => {
        const data = docSnap.data();
        if (data.name.toLowerCase().includes(search) || data.code.toLowerCase().includes(search)) {
          matching.push({ id: docSnap.id, ...data });
        }
      });

      if (matching.length === 0) return alert("Nessun collarino trovato");
      if (matching.length === 1) return await processUpdate(matching[0], isSubtract ? -amount : amount);

      mostraScelte(matching, async (selected) => {
        await processUpdate(selected, isSubtract ? -amount : amount);
        document.getElementById("searchCode").value = "";
        document.getElementById("adjustQty").value = "";
      });
    } catch (error) {
      alert("Errore durante l'aggiornamento: " + error.message);
    } finally {
      utils.hideLoader();
    }
  },

  async calcolaDaPeso() {
    utils.showLoader();
    const search = document.getElementById("calcCode").value.trim().toLowerCase();
    const pesoKg = parseFloat(document.getElementById("weightInput").value);
  
    if (!search || isNaN(pesoKg)) {
      utils.hideLoader();
      return alert("Inserisci nome/codice e peso validi");
    }
  
    // Prendi il tipo selezionato
    const selectedType = document.querySelector('input[name="collarinoType"]:checked');
    if (!selectedType) {
      utils.hideLoader();
      return alert("Seleziona un tipo di collarino");
    }
  
    const pesoSingoloCollarino = parseFloat(selectedType.value); // esempio: 3.27
    if (isNaN(pesoSingoloCollarino) || pesoSingoloCollarino <= 0) {
      utils.hideLoader();
      return alert("Peso tipo collarino non valido");
    }
  
    const pesoTotaleGr = pesoKg * 1000; // converto da kg a grammi
    const collariniDaAggiungere = Math.floor(pesoTotaleGr / pesoSingoloCollarino);
  
    if (collariniDaAggiungere <= 0) {
      utils.hideLoader();
      return alert("Peso insufficiente per generare collarini");
    }
  
    try {
      const matching = [];
      (await getDocs(query(collection(db, "collarini")))).forEach(docSnap => {
        const data = docSnap.data();
        if (data.name.toLowerCase().includes(search) || data.code.toLowerCase().includes(search)) {
          matching.push({ id: docSnap.id, ...data });
        }
      });
  
      if (matching.length === 0) {
        alert("Nessun collarino trovato");
      } else if (matching.length === 1) {
        await processUpdate(matching[0], collariniDaAggiungere);
      } else {
        mostraScelte(matching, async (selected) => {
          await processUpdate(selected, collariniDaAggiungere);
          document.getElementById("calcCode").value = "";
          document.getElementById("weightInput").value = "";
          // Se vuoi puoi anche deselezionare il tipo:
          document.querySelectorAll('input[name="collarinoType"]').forEach(r => r.checked = false);
        });
      }
    } catch (error) {
      alert("Errore durante l'operazione: " + error.message);
    } finally {
      utils.hideLoader();
    }
  }
};

// Funzioni principali
// Funzione per processare un aggiornamento in tempo reale
async function processUpdate(collarino, amount) {
  let newQty = collarino.qty + amount;

  if (newQty < 0) {
    newQty = 0;
    utils.showToast("Tipo di collarino terminato");
  }

  // Aggiorna il documento in Firestore
  await updateDoc(doc(db, "collarini", collarino.id), {
    qty: newQty,
    lastModifiedBy: localStorage.getItem("nomeUtente"),
    usageCount: (collarino.usageCount || 0) + 1,
    lastUpdated: serverTimestamp()
  });

  await logAction("update", collarino.id, { oldQty: collarino.qty, newQty, change: amount });

  recentModified = recentModified.filter(c => c.id !== collarino.id);
  recentModified.unshift({ ...collarino, qty: newQty });
  if (recentModified.length > 5) recentModified.pop();

  // Aggiorna la lista e dashboard in tempo reale
  await aggiornaLista();
  await updateDashboard();
  utils.showSuccess();
}

// Funzione aggiornata per caricare e monitorare l'inventario in tempo reale
async function aggiornaLista() {
  utils.showLoader();
  const searchTerm = document.getElementById("liveSearch")?.value.toLowerCase() || "";
  const soloBassoStock = document.getElementById("filtroBassoStock")?.checked || false;
  const soloQrVecchio = document.getElementById("filtroQrVecchio")?.checked || false;

  try {
    collarini = [];
    const container = document.getElementById("inventoryList");
    container.innerHTML = "";

    // Aggiungi la sezione per gli articoli modificati recentemente
    if (recentModified.length > 0) {
      const recentSection = document.createElement('div');
      recentSection.className = 'recent-section';
      recentSection.innerHTML = '<h3>Modificati di recente</h3><div class="recent-container"></div>';
      recentModified.forEach(c => {
        recentSection.querySelector('.recent-container').appendChild(createCollarinoItem(c));
      });
      container.appendChild(recentSection);
    }

    // Recupera tutti i dati dal database in tempo reale
    const collariniRef = collection(db, "collarini");
    const q = query(collariniRef, orderBy("name")); // Puoi anche applicare filtri se necessario

    // Usa `onSnapshot` per ottenere gli aggiornamenti in tempo reale
    onSnapshot(q, (snapshot) => {
      // Pulisce la lista
      container.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!recentModified.some(c => c.id === docSnap.id)) collarini.push({ id: docSnap.id, ...data });
      });

      // Filtra i dati
      const filtered = collarini
        .filter(c => (!searchTerm || c.name.toLowerCase().includes(searchTerm) || c.code.toLowerCase().includes(searchTerm)) &&
          (!soloBassoStock || c.qty < 120) &&
          (!soloQrVecchio || c.qrVecchio))
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

      // Mostra gli articoli filtrati
      if (filtered.length > 0) {
        const otherSection = document.createElement('div');
        otherSection.className = 'other-section';
        otherSection.innerHTML = '<h3>Tutti i collarini</h3>';
        filtered.forEach(c => otherSection.appendChild(createCollarinoItem(c)));
        container.appendChild(otherSection);
      }

      // Mostra messaggio se non ci sono risultati
      if (recentModified.length === 0 && filtered.length === 0) {
        container.innerHTML = '<div class="no-results">Nessun collarino trovato</div>';
      }
    });

  } catch (error) {
    console.error("Errore caricamento inventario:", error);
  } finally {
    utils.hideLoader();
  }
}

// Funzione per creare l'elemento di un collarino
function createCollarinoItem(c) {
  const translations = {
    usageCount: 'Utilizzi',
    name: 'Nome',
    code: 'Codice',
    qty: 'Quantità',
    lastModifiedBy: 'Modificato da',
    lastUpdated: 'Data modifica'
  };

  const item = document.createElement("div");
  item.className = "item";
  item.onclick = () => apriModale(c);
  
  item.innerHTML = `
    <div class="item-header">
      <span class="item-name">${c.name}</span>
      <span class="item-qty">${c.qty}</span>
      ${c.qty < 120 ? `<span class="add-to-order" onclick="event.stopPropagation(); addToOrder('${c.code}')">+</span>` : ''}
    </div>
    <div class="item-code">${c.code}</div>
    <div class="item-tags">
      ${c.qrVecchio ? '<span class="tag tag-info">QR Vecchio</span>' : ''}
      ${c.qty < 120 ? '<span class="tag tag-danger">Da ordinare</span>' : ''}
      ${(c.usageCount || 0) > 10 ? '<span class="tag tag-warning">Frequente</span>' : ''}
    </div>
    <div class="item-meta">
      ${translations.lastModifiedBy}: ${c.lastModifiedBy || "N/A"}
      ${c.lastUpdated ? `<br>${translations.lastUpdated}: ${c.lastUpdated.toDate().toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}` : ''}
    </div>
  `;
  
  return item;
}

// Mostra il resoconto in tempo reale
function loadResoconto() {
  console.log("Caricamento del resoconto in tempo reale...");

  const container = document.getElementById("resocontoList");
  if (!container) {
    console.error("Elemento 'resocontoList' non trovato.");
    return;
  }

  utils.showLoader(); // Mostra il loader
  try {
    console.log("Inizio recupero dei dati da Firestore...");

    container.innerHTML = ""; // Pulisce prima di caricare i nuovi dati

    // Recupera i dati da Firestore in tempo reale con onSnapshot
    const collariniRef = collection(db, "collarini");

    // Listener in tempo reale per i cambiamenti nella collezione "collarini"
    onSnapshot(collariniRef, (snapshot) => {
      console.log("Dati aggiornati in tempo reale:", snapshot);

      if (snapshot.empty) {
        console.warn("Nessun documento trovato nel resoconto.");
      }

      container.innerHTML = ""; // Pulisce prima di caricare i nuovi dati

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log("Dati del collarino:", data);

        const qty = data.qty || 0;
        const minQty = data.minQty || 0; // Valore minimo dai dati
        const maxQty = data.maxQty || 1500; // Valore massimo dai dati, default a 1500
        const percent = Math.min((qty / maxQty) * 100, 100); // Calcola la percentuale di completamento

        const item = document.createElement("div");
        item.className = "collarino-item";

        const name = document.createElement("span");
        name.className = "collarino-name";
        name.textContent = data.name;

        if (qty <= 100) {
          const asterisk = document.createElement("span");
          asterisk.className = "collarino-asterisk";
          asterisk.textContent = "*";
          name.appendChild(asterisk);
        }

        const barContainer = document.createElement("div");
        barContainer.className = "collarino-bar-container";

        // Crea le etichette MIN e MAX dinamicamente
        const barLabels = document.createElement("div");
        barLabels.className = "collarino-bar-labels";
        barLabels.innerHTML = `
          <span class="collarino-min-label">${minQty}</span> <!-- Etichetta MIN dinamica -->
          <span class="collarino-max-label">${maxQty}</span> <!-- Etichetta MAX dinamica -->
        `;

        const bar = document.createElement("div");
        bar.className = "collarino-bar";
        bar.style.width = percent + "%"; // Imposta la larghezza della barra

        // Cambia colore della barra in base alla quantità
        if (qty > 1000) {
          bar.style.backgroundColor = "green";
        } else if (qty > 500) {
          bar.style.backgroundColor = "orange";
        } else {
          bar.style.backgroundColor = "red";
        }

        barContainer.appendChild(barLabels);
        barContainer.appendChild(bar);

        item.appendChild(name);
        item.appendChild(barContainer);

        container.appendChild(item);
      });
    });

    console.log("Ascoltatore in tempo reale attivato!");
  } catch (error) {
    console.error("Errore durante il caricamento del resoconto:", error);
    alert("Errore durante il caricamento del resoconto: " + error.message);
  } finally {
    utils.hideLoader(); // Nascondi il loader
  }
}








// Modali
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

// Funzione per salvare le modifiche in tempo reale
async function salvaModifiche() {
  utils.showLoader();
  const id = document.getElementById("editModal").getAttribute("data-id");
  const newName = document.getElementById("editName").value.trim();
  const newCode = document.getElementById("editCode").value.trim();
  const qrVecchio = document.getElementById("editQrVecchio").checked;

  if (!newName || !newCode) {
    utils.hideLoader();
    return alert("Nome e codice sono obbligatori");
  }

  try {
    const currentDoc = await getDoc(doc(db, "collarini", id));
    const currentData = currentDoc.data();
    
    // Aggiorna il documento in Firestore
    await updateDoc(doc(db, "collarini", id), {
      name: newName,
      code: newCode,
      qrVecchio,
      lastModifiedBy: localStorage.getItem("nomeUtente"),
      lastUpdated: serverTimestamp()
    });

    // Registra l'azione di modifica
    await logAction("update", id, {
      oldName: currentData.name,
      newName,
      oldCode: currentData.code,
      newCode,
      qrVecchio
    });

    // Aggiorna il recente modificato
    const index = recentModified.findIndex(c => c.id === id);
    if (index !== -1) {
      recentModified[index] = { ...recentModified[index], name: newName, code: newCode, qrVecchio };
    }

    // Chiudi il modale
    chiudiModale();

    // Ricarica la lista in tempo reale
    await aggiornaLista();
    await updateDashboard();

    utils.showSuccess();
  } catch (error) {
    alert("Errore durante il salvataggio: " + error.message);
  } finally {
    utils.hideLoader();
  }
}

// Funzione per eliminare il collarino con conferma in tempo reale
async function eliminaConConferma() {
  console.log("[DEBUG] Inizio funzione eliminaConConferma");
  
  if (!confirm("Sei sicuro di voler eliminare questo collarino?")) {
    console.log("[DEBUG] Eliminazione annullata dall'utente");
    return;
  }

  const id = document.getElementById("editModal").getAttribute("data-id");
  console.log("[DEBUG] ID da eliminare:", id);

  if (!id) {
    alert("Errore: ID non valido");
    console.error("[DEBUG] ID mancante");
    return;
  }

  try {
    utils.showLoader();
    const docRef = doc(db, "collarini", id);
    console.log("[DEBUG] Document reference creato");

    const docSnap = await getDoc(docRef);
    console.log("[DEBUG] Snapshot ottenuto", docSnap.exists());

    if (!docSnap.exists()) {
      alert("Il collarino non esiste più");
      console.warn("[DEBUG] Documento non trovato");
      return;
    }

    console.log("[DEBUG] Tentativo di eliminazione...");
    await deleteDoc(docRef);
    console.log("[DEBUG] Documento eliminato con successo");

    // Registra l'azione di eliminazione
    await logAction("delete", id, docSnap.data());
    
    // Rimuovi il collarino dalla lista modificata recentemente
    recentModified = recentModified.filter(c => c.id !== id);
    
    // Chiudi il modale
    chiudiModale();

    // Ricarica la lista in tempo reale
    await aggiornaLista();
    await updateDashboard();

    utils.showSuccess();
  } catch (error) {
    console.error("[DEBUG] Errore completo:", error);
    alert(`Errore durante l'eliminazione: ${error.message}`);
  } finally {
    utils.hideLoader();
    console.log("[DEBUG] Operazione completata");
  }
}

function mostraScelte(items, callback) {
  const container = document.getElementById("scelteDuplicati");
  container.innerHTML = "";

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "selection-item";
    btn.innerHTML = `
      <div>
        <strong>${item.name}</strong> (${item.code})
        ${item.qrVecchio ? '<span class="tag tag-info">QR VECCHIO</span>' : ''}
      </div>
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

// Dashboard e Cronologia
async function updateDashboard() {
  utils.showLoader();
  try {
    const [total, lowStock, oldQr, active] = await Promise.all([
      getDocs(collection(db, "collarini")),
      getDocs(query(collection(db, "collarini"), where("qty", "<", 120))),
      getDocs(query(collection(db, "collarini"), where("qrVecchio", "==", true))),
      getDocs(query(collection(db, "collarini"), where("usageCount", ">", 5)))
    ]);

    document.getElementById("totalItems").textContent = total.size;
    document.getElementById("lowStockItems").textContent = lowStock.size;
    document.getElementById("oldQrItems").textContent = oldQr.size;
    document.getElementById("activeItems").textContent = active.size;
    
    updateUsageChart();
  } catch (error) {
    console.error("Errore aggiornamento dashboard:", error);
  } finally {
    utils.hideLoader();
  }
}

function initCharts() {
  const ctx = document.getElementById('usageChart').getContext('2d');
  usageChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{
      label: 'Utilizzi',
      data: [],
      backgroundColor: '#3498db',
      borderColor: '#2980b9',
      borderWidth: 1
    }]},
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function updateUsageChart() {
  if (!usageChart) return;
  const topUsed = [...collarini].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5);
  usageChart.data.labels = topUsed.map(c => c.name);
  usageChart.data.datasets[0].data = topUsed.map(c => c.usageCount || 0);
  usageChart.update();
}

async function loadHistory() {
  utils.showLoader();
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "<div class='history-item'>Caricamento...</div>";
  
  try {
    const snapshot = await getDocs(query(
      collection(db, "audit_log"), 
      orderBy("timestamp", "desc"), 
      limit(50)
    ));
    
    historyList.innerHTML = snapshot.empty 
      ? "<div class='history-item'>Nessuna attività recente</div>"
      : "";
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const action = { add: "Aggiunto", update: "Aggiornato", delete: "Eliminato" }[data.action] || "Azione";
      const actionClass = { add: "add", update: "update", delete: "delete" }[data.action] || "";
      
      // Traduzioni per i dettagli
      const translations = {
        'oldQty': 'Quantità precedente',
        'newQty': 'Nuova quantità',
        'change': 'Variazione',
        'oldName': 'Nome precedente',
        'newName': 'Nuovo nome',
        'oldCode': 'Codice precedente',
        'newCode': 'Nuovo codice',
        'qrVecchio': 'QR Vecchio',
        'usageCount': 'Utilizzi',
        'name': 'Nome',
        'code': 'Codice',
        'qty': 'Quantità',
        'lastModifiedBy': 'Modificato da',
        'lastUpdated': 'Data modifica'
      };
      
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        <div>
          <span class="history-action ${actionClass}">${action}</span>
          ${data.itemCode}
        </div>
        <div class="history-details">
          ${data.details ? Object.entries(data.details).map(([key, value]) => {
            if (key === 'lastUpdated' && typeof value === 'object') {
              const date = new Date(value.seconds * 1000);
              return `${translations[key] || key}: ${date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`;
            }
            return `${translations[key] || key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
          }).join('<br>') : ''}
        </div>
        <div class="history-timestamp">
          ${data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Data non disponibile'} - ${data.user}
        </div>
      `;
      historyList.appendChild(item);
    });
  } catch (error) {
    console.error("Errore caricamento cronologia:", error);
    historyList.innerHTML = "<div class='history-item'>Errore nel caricamento</div>";
  } finally {
    utils.hideLoader();
  }
}

function filterHistory() {
  const searchTerm = document.getElementById("historySearch").value.toLowerCase();
  document.querySelectorAll(".history-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? "block" : "none";
  });
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

// Funzione per copiare i collarini da ordinare
async function copyLowStockItems() {
  const lowStockItems = collarini.filter(c => c.qty < 120);
  if (lowStockItems.length === 0) {
    alert('Nessun collarino da ordinare');
    return;
  }

  const text = lowStockItems
    .map(c => `${c.name}\nQuantità: ${c.qty} circa\nCodice: ${c.code}\n`)
    .join('\n');

  try {
    await navigator.clipboard.writeText(text);
    utils.showSuccess();
  } catch (err) {
    console.error('Errore durante la copia:', err);
    alert('Errore durante la copia');
  }
}

// Array per gli elementi da ordinare
let orderList = [];

// Funzione per aggiungere alla lista ordini
function addToOrder(code) {
  const item = collarini.find(c => c.code === code);
  if (item && !orderList.some(i => i.code === code)) {
    orderList.push(item);
    updateOrderSection();
    updateOrderCounters();
  }
}

function updateOrderCounters() {
  document.querySelectorAll('.add-to-order').forEach(btn => {
    const code = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
    if (orderList.some(i => i.code === code)) {
      btn.setAttribute('data-count', orderList.length);
    } else {
      btn.removeAttribute('data-count');
    }
  });
}

// Funzione per aggiornare la sezione ordini
function updateOrderSection() {
  const orderSection = document.querySelector('.order-section') || createOrderSection();
  const orderListElement = orderSection.querySelector('.order-list');
  orderListElement.innerHTML = orderList.map(item => `
    <div class="item">
      <div class="item-header">
        <span class="item-name">${item.name}</span>
        <span class="item-qty">${item.qty}</span>
      </div>
      <div class="item-code">${item.code}</div>
    </div>
  `).join('');
}

// Funzione per creare la sezione ordini
function createOrderSection() {
  const section = document.createElement('div');
  section.className = 'order-section';
  section.innerHTML = `
    <h3>Da ordinare</h3>
    <div class="order-list"></div>
    <button class="btn-copy" onclick="copyOrderList()">Copia lista</button>
  `;
  document.getElementById('inventory-section').appendChild(section);
  return section;
}

// Funzione per copiare la lista ordini
async function copyOrderList() {
  if (orderList.length === 0) {
    alert('Nessun elemento da copiare');
    return;
  }

  const text = orderList
    .map(item => `${item.name}\nQuantità: ${item.qty} circa\nCodice: ${item.code}\n`)
    .join('\n');

  try {
    await navigator.clipboard.writeText(text);
    utils.showSuccess();
  } catch (err) {
    console.error('Errore durante la copia:', err);
    alert('Errore durante la copia');
  }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
  // Setup utente
  if (!localStorage.getItem("nomeUtente")) {
    const nomeUtente = prompt("Inserisci il tuo nome:") || "Anonimo";
    localStorage.setItem("nomeUtente", nomeUtente);
  }
  DOM.userBadge.textContent = localStorage.getItem("nomeUtente");

  // Setup menu
  setupMenu();

  // Inizializzazione grafici
  initCharts();

  // Event listeners
  document.getElementById("addButton").addEventListener('click', dbOperations.addCollarino);
  document.getElementById("updateButton").addEventListener('click', dbOperations.updateQty);
  document.getElementById("weightButton").addEventListener('click', dbOperations.calcolaDaPeso);
  document.getElementById("saveButton").addEventListener('click', salvaModifiche);
  document.getElementById("deleteButton").addEventListener('click', eliminaConConferma);
  document.getElementById("closeModal").addEventListener('click', chiudiModale);
  document.getElementById("liveSearch").addEventListener('input', aggiornaLista);
  document.getElementById("filtroBassoStock").addEventListener('change', aggiornaLista);
  document.getElementById("filtroQrVecchio").addEventListener('change', aggiornaLista);
  document.getElementById("historySearch").addEventListener('input', filterHistory);
  document.getElementById("copyLowStock").addEventListener('click', copyLowStockItems);

  // Caricamento iniziale
  changeSection('inventory-section');

 
});