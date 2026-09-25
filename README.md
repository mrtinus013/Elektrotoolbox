# ElektroToolbox v6 — Hyperfield Edition

ElektroToolbox v6 is een local-first PWA voor elektrotechnici en meet-/storingsspecialisten. V6 behoudt de functionele kern uit v5 en voegt een nieuwe Hyperfield-interface, extra trafofuncties, veldmodi en interactieve visualisaties toe.

## Nieuw in v6

- HyperLab met drie interactieve technische visualisaties:
  - WaveScope: conceptuele driefasen-golfvorm met ABC/ACB-volgorde.
  - SequenceScope: geanimeerde fasoren met de ingestelde fasekleuren.
  - TDR Pulse Studio: reflectievisualisatie uit kabellengte, afstand en voortplantingssnelheid.
- CableTwin: ruimtelijke visualisatie van berekende kabelfoutpositie.
- Field Console:
  - Glove Mode (grotere bediening),
  - Sunlight Mode (hoog contrast),
  - Focus Mode,
  - Screen Wake Lock waar de browser dit ondersteunt,
  - centrale Motion-toggle.
- Fullscreen/immersive mode voor belangrijke schema's en diagrams.
- Geanimeerde PhaseSync-verbindingen en actieve kabelfoutpaden.
- 25 calculators, inclusief nieuw:
  - Trafo tapstand → secundaire spanning,
  - Parallel trafo load-share schatting uit kVA en uk%.
- Project-gereedheidsmeter op het dashboard (alleen dossiercompleetheid; geen technische kwaliteitsbeoordeling).
- Responsive regels blijven gericht op géén document-brede horizontale scroll.

## Installeren op GitHub Pages

1. Pak `ElektroToolbox_v6_Hyperfield_Edition.zip` uit.
2. Open de map `ElektroToolbox_v6`.
3. Upload **de inhoud van die map** naar de root van je GitHub-repository.
4. Zorg dat de map `assets` intact blijft.
5. Ga in GitHub naar **Settings → Pages**.
6. Kies de `main` branch en `/root`.
7. Open daarna de GitHub Pages-URL en herlaad één keer hard als je eerder v5 gebruikte.

Belangrijk: v6 gebruikt een nieuwe service-worker-cache (`elektrotoolbox-v6-hyperfield-20260924`).

## Bestandsstructuur

```text
index.html
app.html
privacy.html
voorwaarden.html
manifest.webmanifest
sw.js
assets/
  styles.css
  v5-futuristic.css
  v6-hyperfield.css
  calc-engine.js
  app.js
  v6-hyperfield.js
  favicon.svg
  icon-192.png
  icon-512.png
```

## Technische status

V6 is een geavanceerde pilot en geen gecertificeerd meetinstrument. Kritische berekeningen, meetopstellingen, transformatorconfiguraties en parallelbedrijf moeten altijd onafhankelijk worden gecontroleerd volgens de geldende bedrijfsprocedure, fabrikantgegevens en normen.

HyperLab-animaties zijn **visualisaties** en geen realtime registratie van een fysiek net. De TDR Pulse Studio rekent de ingevoerde afstand/tijdrelatie uit, maar vervangt geen interpretatie van een echte TDR-trace.

### Nieuwe trafo-aannames

**Tapstand-tool**

De tool gebruikt expliciet de conventie: een positieve tapwaarde verhoogt de effectieve nominale primaire tapspanning / het aantal primaire windingen. Bij gelijkblijvende werkelijk aangelegde HV-spanning daalt daardoor de berekende LV-spanning. Controleer altijd de tapschaal en tekenconventie van de fabrikant.

**Parallel load-share**

De verdeling wordt geschat met `gewicht ∝ Sn / uk%`. Dit is alleen bruikbaar als de transformatoren al geschikt zijn voor parallelbedrijf, de spanningsverhouding/fasehoek overeenkomt en de impedantiehoeken voldoende vergelijkbaar zijn. Het is geen vrijgave voor parallelbedrijf.
