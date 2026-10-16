# OlasDelSur — mappa per gli ospiti

Sito statico multilingua (es/en/fr/de/it) per esplorare El Puerto de Santa María. La mappa usa MapLibre GL JS locale e le mappe base CARTO/OpenStreetMap.

## Struttura

- `index.html`: pagina, testi dell'interfaccia e metadati social.
- `js/data.js`: fonte unica dei 48 luoghi, con coordinate, descrizioni e orari nelle cinque lingue.
- `js/main.js`: mappa MapLibre, filtri, schede, lingue e video.
- `css/style.css` e `fonts.css`: stile e font locali.
- `vendor/`: libreria MapLibre locale.
- `assets/`, `icons/`, `logo.webp`: video, poster e icone PWA.
- `manifest.webmanifest` e `sw.js`: installazione e copia offline dell'interfaccia. Le tile della mappa richiedono una connessione.

## Modifiche e pubblicazione

Modificare i luoghi in `js/data.js` e i testi statici in `index.html`. Le coordinate dei marcatori derivano dai record dei luoghi. Controllare la sintassi con `node --check js/*.js sw.js` e verificare i percorsi locali citati da HTML, manifest e service worker. Pubblicare il branch scelto tramite GitHub Pages dalla radice del repository; non serve una build.

## Privacy

OlasDelSur, proprietario dell'alloggio, usa analisi anonime senza cookie tramite Umami Cloud. Le mappe base sono fornite da CARTO/OpenStreetMap. Il video YouTube usa `youtube-nocookie.com` e viene caricato solo dopo il clic. La nota è presente nel footer in tutte le lingue.
