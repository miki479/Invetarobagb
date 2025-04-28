async function loadResoconto() {
    utils.showLoader();
    try {
      const container = document.getElementById("resocontoList");
      container.innerHTML = ""; // Pulisce prima
  
      const snapshot = await getDocs(collection(db, "collarini"));
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const qty = data.qty || 0;
        const percent = Math.min((qty / 1500) * 100, 100);  // Percentuale sulla base di 1500
  
        // Crea gli elementi per ogni collarino
        const item = document.createElement("div");
        item.className = "collarino-item";
  
        const name = document.createElement("div");
        name.className = "collarino-name";
        name.textContent = data.name;
  
        // Aggiungi asterisco per collarini con quantità bassa
        if (qty <= 100) {
          const asterisk = document.createElement("span");
          asterisk.className = "collarino-asterisk";
          asterisk.textContent = "*";
          name.appendChild(asterisk);
        }
  
        // Contenitore della barra di avanzamento
        const barContainer = document.createElement("div");
        barContainer.className = "collarino-bar-container";
  
        // Crea la barra di avanzamento
        const bar = document.createElement("div");
        bar.className = "collarino-bar";
        bar.style.width = percent + "%";
  
        // Cambia colore a seconda della quantità
        if (qty > 1000) {
          bar.style.backgroundColor = "green";
        } else if (qty > 500) {
          bar.style.backgroundColor = "orange";
        } else {
          bar.style.backgroundColor = "red";
        }
  
        // Aggiungi le etichette MIN e MAX
        const barLabels = document.createElement("div");
        barLabels.className = "collarino-bar-labels";
  
        const minLabel = document.createElement("span");
        minLabel.className = "collarino-min-label";
        minLabel.textContent = "MIN";  // Etichetta MIN
  
        const maxLabel = document.createElement("span");
        maxLabel.className = "collarino-max-label";
        maxLabel.textContent = "MAX";  // Etichetta MAX
  
        barLabels.appendChild(minLabel);
        barLabels.appendChild(maxLabel);
  
        // Aggiungi la barra e le etichette al contenitore della barra
        barContainer.appendChild(barLabels);
        barContainer.appendChild(bar);
  
        // Aggiungi tutto al container principale
        item.appendChild(name);
        item.appendChild(barContainer);
        container.appendChild(item);
      });
    } catch (error) {
      alert("Errore durante il caricamento del resoconto: " + error.message);
    } finally {
      utils.hideLoader();
    }
  }
  