# 🌊 Olas Del Sur - Web Project

Questo è il progetto web della Web App multilingua per gli ospiti di Olas Del Sur a El Puerto de Santa María.

## 📂 Struttura del Progetto
- `index.html`: Struttura principale della pagina.
- `css/style.css`: Design, colori e animazioni (Summer Palette).
- `js/data.js`: Database dei luoghi (POI), spiagge, ristoranti e traduzioni.
- `js/main.js`: Logica della mappa Leaflet, player YouTube e interazioni.
- `assets/`: Immagini, video e icone.

## 🛠️ Come fare modifiche
1. **Aggiungere un luogo sulla mappa:** Apri `js/data.js` e aggiungi un oggetto all'array `places`.
2. **Cambiare i colori:** Apri `css/style.css` e modifica le variabili in `:root`.
3. **Modificare i testi:** I testi multilingua sono gestiti sia nell'HTML (tag `<span>` con `data-lang`) che in `js/data.js` per i punti interattivi.

---
*Organizzato da Antigravity - Maggio 2026*
