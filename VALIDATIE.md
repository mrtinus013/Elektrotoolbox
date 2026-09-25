# Validatie — ElektroToolbox v6 Hyperfield

## Uitgevoerd

- JavaScript-syntaxcontrole op `calc-engine.js`, `app.js` en `v6-hyperfield.js`.
- Regressietest lusmethode:
  - I = 10 A
  - Uvt = 28,8 V
  - Uv1 = 12,3 V
  - Cu 4 mm²
  - Uv2 = 2,10 V
  - totale lengte ≈ 329,14 m
  - foutafstand ≈ 281,14 m
- Transformator-regressietest 630 kVA, 10 kV / 400 V, uk 6%:
  - HV In ≈ 36,37 A
  - LV In ≈ 909,33 A
  - theoretische trafo-klem Ik ≈ 15,16 kA
- Nieuwe tapstand-test:
  - 10 kV / 400 V, werkelijke HV 10 kV, +2,5% primaire tap
  - berekende LV ≈ 390,24 V volgens de in README beschreven conventie.
- Nieuwe parallel-load-share-test:
  - 630 kVA / uk 6% en 1000 kVA / uk 6%
  - verdeling ≈ 38,65% / 61,35% van het totale kVA volgens Sn/uk.
- Alle 12×12 klokcombinaties door `phaseAlignmentSolve` gehaald; voor iedere gevonden oplossing is gecontroleerd dat `effectiveClock` daadwerkelijk gelijk is aan het doelklokgetal.
- Statische controle van nieuwe assets en JavaScript-syntax.

## Browser/viewport validatie

In deze uitvoeromgeving start Chromium momenteel niet betrouwbaar, zelfs niet op een minimale lege testpagina. Daardoor kon de eerdere geautomatiseerde screenshot/viewport-regressietest niet opnieuw worden uitgevoerd voor v6. V6 bouwt verder op de v5-responsive laag die eerder op 320, 393, 430, 768, 1024, 1366 en 1600 px is getest, en voegt extra `min-width:0`, `max-width:100%` en specifieke mobiele HyperLab-regels toe.

Voor commerciële release moet v6 daarom nog op echte Safari iOS, Chrome Android, Safari/Chrome iPad en desktop Chromium/Edge worden doorgelopen.

## Grenzen

- Geen gecertificeerd meetinstrument.
- Geen automatische normkeuze of schakelvrijgave.
- PhaseSync visualiseert externe fasepermutaties; een gevonden mapping is geen automatische goedkeuring voor parallelbedrijf.
- TDR Pulse Studio is een visualisatie/rekenhulp, geen echte trace-analyse.
- Wake Lock is afhankelijk van browser- en apparaatondersteuning.
