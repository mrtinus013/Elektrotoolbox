# ElektroToolbox v6.1 hotfix

Deze hotfix richt zich op niet-reagerende knoppen na een update.

- cache-busting op kritieke CSS/JS assets;
- service worker gebruikt network-first voor HTML/JS/CSS;
- oude caches worden verwijderd;
- event binding is defensiever bij een stale/mismatched DOM;
- Hyperfield draait achter een error boundary zodat de kernapp bruikbaar blijft;
- decoratieve canvas/FX-lagen kunnen geen pointer/touch-events onderscheppen.

Bij upload naar GitHub: vervang alle oude bestanden, inclusief `sw.js`, `app.html` en de volledige `assets` map. Open daarna de site één keer opnieuw en ververs.
