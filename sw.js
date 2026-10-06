/*
 * Service worker voor De Leste.
 *
 * Strategie "eerst netwerk":
 * - Met internet krijg je altijd meteen de nieuwste versie van GitHub.
 * - Zonder internet, of als het netwerk langer dan 3 seconden nodig
 *   heeft, opent de app vanuit de cache.
 * - Elke versie die van het netwerk komt, wordt in de cache bewaard
 *   voor de volgende keer zonder internet.
 */
const CACHE_NAAM = "de-leste-v6c";

/* Hoe lang we op het netwerk wachten voor we de cache gebruiken */
const NETWERK_WACHTTIJD = 3000;

const BESTANDEN = [
  "./",
  "./index.html",
  "./dranken.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAAM).then(cache =>
      /*
       * Elk bestand apart toevoegen: als er één ontbreekt,
       * worden de andere toch gecachet.
       * cache: "no-cache" vraagt altijd aan GitHub of er iets nieuws is.
       */
      Promise.all(
        BESTANDEN.map(bestand =>
          cache
            .add(new Request(bestand, { cache: "no-cache" }))
            .catch(() => {})
        )
      )
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(namen =>
      Promise.all(
        namen
          .filter(naam => naam !== CACHE_NAAM)
          .map(naam => caches.delete(naam))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const verzoek = event.request;

  if (
    verzoek.method !== "GET" ||
    new URL(verzoek.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(eerstNetwerk(event, verzoek));
});

async function eerstNetwerk(event, verzoek) {
  const cache = await caches.open(CACHE_NAAM);

  /*
   * Haal het bestand op bij GitHub. "no-cache" zorgt ervoor dat de
   * browser niet stiekem een oude kopie uit zijn eigen geheugen geeft.
   */
  const vanNetwerk = fetch(verzoek, { cache: "no-cache" }).then(antwoord => {
    if (antwoord && antwoord.ok) {
      cache.put(verzoek, antwoord.clone());
    }
    return antwoord;
  });

  /* Laat de service worker blijven leven tot de cache bijgewerkt is */
  event.waitUntil(vanNetwerk.catch(() => {}));

  const wachttijd = new Promise(klaar =>
    setTimeout(klaar, NETWERK_WACHTTIJD, null)
  );

  try {
    /* Wie het eerst klaar is: het netwerk of de wachttijd */
    const antwoord = await Promise.race([vanNetwerk, wachttijd]);

    if (antwoord) {
      return antwoord;
    }
  } catch (error) {
    // Geen internet: we gebruiken hieronder de cache.
  }

  const uitCache = await cache.match(verzoek, { ignoreSearch: true });

  /* Niets in de cache: dan toch op het netwerk blijven wachten */
  return uitCache || vanNetwerk;
}
