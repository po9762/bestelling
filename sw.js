/*
 * Service worker voor De Leste.
 *
 * Strategie "stale-while-revalidate":
 * - De app opent meteen vanuit de cache (ook zonder internet).
 * - Op de achtergrond wordt de nieuwste versie opgehaald en bewaard.
 * - Na een update op GitHub zie je de nieuwe versie dus bij de
 *   tweede keer openen.
 */
const CACHE_NAAM = "de-leste-v6";

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
       */
      Promise.all(
        BESTANDEN.map(bestand =>
          cache.add(bestand).catch(() => {})
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

  event.respondWith(
    caches.open(CACHE_NAAM).then(async cache => {
      const uitCache = await cache.match(verzoek, {
        ignoreSearch: true
      });

      const vanNetwerk = fetch(verzoek)
        .then(antwoord => {
          if (antwoord && antwoord.ok) {
            cache.put(verzoek, antwoord.clone());
          }
          return antwoord;
        })
        .catch(() => uitCache);

      return uitCache || vanNetwerk;
    })
  );
});
