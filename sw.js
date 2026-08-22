/* Hunter · Zannalunga — service worker
   Serve a far funzionare l'app SENZA RETE, che in montagna e' la regola.
   Tre casse separate:
     GUSCIO   il programma e le librerie: si tengono sempre, si aggiornano quando c'e' rete
     TESSERE  i quadretti della mappa satellitare gia' visti: restano per la prossima volta
     ROBA     le immagini dei giochi e le icone
*/
var VERSIONE = "hunter-v2.74";
var GUSCIO  = VERSIONE + "-guscio";
var TESSERE = "hunter-tessere";     // NON porta la versione: le mappe non si buttano a ogni aggiornamento
var ROBA    = VERSIONE + "-roba";

var DA_TENERE = [
  "./",
  "./index.html",
  "./leaflet.js",
  "./leaflet.css",
  "./supabase.js",
  "./manifest.json"
];
var IMMAGINI = [
  "./cinghiale.png", "./cane.png", "./cartuccia.png", "./padella.png",
  "./anatre.png", "./sergente.png", "./cinghiale-rosso.png", "./visore.png",
  "./sm-sergente.png", "./icona-192.png", "./icona-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil((async function(){
    var c = await caches.open(GUSCIO);
    /* uno per volta: se manca un file non deve fallire tutto il resto */
    for(var i=0;i<DA_TENERE.length;i++){
      try{ await c.add(new Request(DA_TENERE[i], {cache:"reload"})); }catch(err){}
    }
    var r = await caches.open(ROBA);
    for(var j=0;j<IMMAGINI.length;j++){
      try{ await r.add(IMMAGINI[j]); }catch(err2){}
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", function(e){
  e.waitUntil((async function(){
    var nomi = await caches.keys();
    await Promise.all(nomi.map(function(n){
      /* le tessere della mappa non si cancellano mai con l'aggiornamento */
      if(n === TESSERE) return null;
      if(n.indexOf(VERSIONE) === 0) return null;
      return caches.delete(n);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", function(e){
  if(e.data === "pulisci"){
    caches.keys().then(function(n){ n.forEach(function(k){ caches.delete(k); }); });
  }
});

function eTessera(url){
  return url.indexOf("server.arcgisonline.com") >= 0
      || url.indexOf("tile.openstreetmap.org") >= 0
      || url.indexOf("basemaps.cartocdn.com") >= 0
      || /\/tile\/\d+\/\d+\/\d+/.test(url);
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = req.url;

  /* il database e le funzioni NON si mettono in cassa: i dati vecchi
     spacciati per nuovi sono peggio di nessun dato */
  if(url.indexOf("/rest/v1/") >= 0 || url.indexOf("/auth/v1/") >= 0 ||
     url.indexOf("/functions/v1/") >= 0 || url.indexOf("/storage/v1/") >= 0 ||
     url.indexOf("api.open-meteo.com") >= 0 || url.indexOf("nominatim") >= 0){
    return;
  }

  /* le tessere della mappa: prima la cassa, cosi' in montagna la mappa c'e'.
     Se non c'e' e la rete manca, si risponde con niente invece di un errore. */
  if(eTessera(url)){
    e.respondWith((async function(){
      var c = await caches.open(TESSERE);
      var salvata = await c.match(req);
      if(salvata) return salvata;
      try{
        var risposta = await fetch(req);
        if(risposta && (risposta.ok || risposta.type === "opaque")){
          c.put(req, risposta.clone());
        }
        return risposta;
      }catch(err){
        return new Response("", {status:504, statusText:"tessera non in cache"});
      }
    })());
    return;
  }

  /* il programma e le immagini: prima la cassa, e intanto si aggiornano */
  e.respondWith((async function(){
    var salvata = await caches.match(req);
    var dallaRete = fetch(req).then(function(risposta){
      if(risposta && risposta.ok){
        var dove = (req.destination === "image") ? ROBA : GUSCIO;
        caches.open(dove).then(function(c){ c.put(req, risposta.clone()); });
      }
      return risposta;
    }).catch(function(){ return null; });

    if(salvata){ dallaRete; return salvata; }
    var r2 = await dallaRete;
    if(r2) return r2;
    /* niente rete e niente in cassa: se e' una pagina, do il programma */
    if(req.mode === "navigate"){
      var idx = await caches.match("./index.html");
      if(idx) return idx;
    }
    return new Response("", {status:504, statusText:"senza rete"});
  })());
});
