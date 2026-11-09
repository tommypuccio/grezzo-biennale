# GREZZO Biennale 2026

PWA del giro alla Biennale di martedi 10 novembre. Nessuna build: Vercel pubblica la cartella cosi com e.

- `index.html`: tutta l'app (giro, foto, gesti, guida).
- `api/state.js`: stato condiviso (ordine e tappe saltate) su Upstash Redis. Variabili: `KV_REST_API_URL` e `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Senza database l'app funziona solo in locale.
- `sw.js`: cache offline (pagina, font, foto). `/api` non va mai in cache.
