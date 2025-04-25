// service-worker.js

// A questo punto, apriamo una cache specifica per la nostra applicazione
const CACHE_NAME = 'collarini-inventory-v1'; // Nome della cache
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icons/icon-192.png',
  
];

// Durante l'installazione del Service Worker, aggiungiamo i file alla cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache); // Aggiungiamo tutti i file alla cache
      })
  );
});

// Durante l'attivazione, eliminiamo eventuali cache obsolete
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName); // Eliminiamo la cache obsoleta
          }
        })
      );
    })
  );
});

// Gestiamo le richieste di rete
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request) // Cerchiamo la risposta nella cache
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Se trovato nella cache, restituiamo la risposta
        }

        // Altrimenti, eseguiamo la richiesta di rete e mettiamo il risultato nella cache
        return fetch(event.request).then((response) => {
          // Se la risposta è valida, la mettiamo nella cache per usi futuri
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone);
              });
          }
          return response;
        });
      })
  );
});