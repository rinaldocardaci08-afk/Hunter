/* ============================================================
   HUNTER · Service Worker
   Scopo: far APRIRE l'app anche senza rete.

   Strategia scelta: NETWORK FIRST.
   - Se c'è rete: scarico sempre la versione fresca (niente app congelate).
   - Se non c'è rete: uso la copia salvata.
   È la strategia più sicura: non si resta mai bloccati su una versione vecchia.
   ============================================================ */

var CACHE = "hunter-v1";

// I file che servono per far partire l'app senza rete
var FILE_BASE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

// INSTALLAZIONE: scarico i file base
self.addEventListener("install", function(e){
  self.skipWaiting();   // la versione nuova entra subito in servizio
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // addAll fallisce tutto se un file manca: li aggiungo uno a uno
      return Promise.all(FILE_BASE.map(function(url){
        return c.add(url).catch(function(){ /* un file in meno non blocca */ });
      }));
    })
  );
});

// ATTIVAZIONE: butto le cache vecchie
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(nomi){
      return Promise.all(nomi.map(function(n){
        if(n !== CACHE) return caches.delete(n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// RICHIESTE
self.addEventListener("fetch", function(e){
  var req = e.request;

  // Solo GET: le scritture (POST) devono sempre andare in rete
  if(req.method !== "GET") return;

  var url = new URL(req.url);

  // MAI intercettare Supabase: i dati devono essere sempre freschi,
  // e la loro gestione offline la fa l'app (cache locale nei dati).
  if(url.hostname.indexOf("supabase") !== -1) return;

  // Le TILES satellitari: se ci sono in cache le uso, altrimenti rete.
  // (le salvo man mano che le guardi: piccolo bonus offline)
  if(url.hostname.indexOf("arcgisonline") !== -1){
    e.respondWith(
      caches.match(req).then(function(hit){
        if(hit) return hit;
        return fetch(req).then(function(res){
          if(res && res.status === 200){
            var copia = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copia); });
          }
          return res;
        }).catch(function(){
          return new Response("", {status: 504});
        });
      })
    );
    return;
  }

  // TUTTO IL RESTO (app, icone, librerie): NETWORK FIRST
  e.respondWith(
    fetch(req).then(function(res){
      // rete OK: aggiorno la copia e servo il fresco
      if(res && res.status === 200){
        var copia = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copia); });
      }
      return res;
    }).catch(function(){
      // rete assente: uso la copia salvata
      return caches.match(req).then(function(hit){
        if(hit) return hit;
        // se chiedeva una pagina, do l'app
        if(req.mode === "navigate") return caches.match("./index.html");
        return new Response("", {status: 504});
      });
    })
  );
});

// L'app può chiedere di svuotare tutto (pulsante "Aggiorna app")
self.addEventListener("message", function(e){
  if(e.data === "pulisci"){
    caches.keys().then(function(nomi){
      nomi.forEach(function(n){ caches.delete(n); });
    });
  }
});
