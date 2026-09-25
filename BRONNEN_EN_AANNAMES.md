# Bronnen & technische aannames — ElektroToolbox v6

## PhaseSync en klokgetallen

De implementatie volgt het principe uit IEC 60076-8 dat bepaalde klokverschillen door externe lijnpermutaties kunnen worden gecompenseerd. De rekenmotor probeert systematisch externe drie-fasepermutaties op HV en LV en selecteert de eenvoudigste oplossing die het effectieve klokgetal gelijk maakt aan de referentie.

De solver beoordeelt **alleen fasehoek/line-permutatie**. Een fasehoek die na externe aansluiting overeenkomt betekent niet automatisch dat transformatoren parallel mogen worden gebruikt.

Bij werkelijk parallelbedrijf moeten onder andere typeplaatgegevens, overzetverhouding/tapstand, polariteit, fasevolgorde, kortsluitimpedantie, belastingsverdeling, nulpunts-/zero-sequence-gedrag, beveiligingen en lokale voorschriften worden gecontroleerd.

## Fasekleuren

Er bestaat internationaal geen universele één-op-één kleurtoewijzing voor L1/L2/L3 die overal hetzelfde is. Daarom gebruikt ElektroToolbox:

- herkenbare regionale presets;
- altijd expliciete labels L1/L2/L3 en U/V/W of u/v/w;
- volledig instelbare HV- en LV-kleuren.

De kleuren zijn visuele hulpmiddelen, niet de technische identiteit van een fase. Controleer altijd de lokale installatie-/netbeheerderconventie en terminalmarkering.

## Lusmethode

De huidige guided lusmethode gebruikt de eerder vastgelegde meetprocedure:

1. Kies een stroom-/foutader, een meetreferentie en een gezonde lusader.
2. Sluit de DC-bron aan de meetzijde tussen gezonde lusader en stroom-/foutader aan.
3. Maak aan de verre zijde een laagohmige lus tussen diezelfde twee aders.
4. Meet Uvt over de volledige stroomlus aan de meetzijde.
5. Meet Uv1 aan de meetzijde tussen stroom-/foutader en meetreferentie.
6. ElektroToolbox berekent Uv2 als `Uvt/2 − Uv1`.
7. Uv2 hoort bij hetzelfde foutader/referentie-paar aan de verre zijde en kan daar desgewenst worden gecontroleerd.

De fout zelf voert in dit model niet de meetstroom.

Formules:

- `U_Rg = Uv1 + Uv2`
- `R_Rg = U_Rg / I`
- `L_totaal = R_Rg × A / ρ`
- `L_fout = Uv1 / (Uv1 + Uv2) × L_totaal`

De implementatie gebruikt soortelijke weerstand bij 20 °C. Werkelijke kabeltemperatuur, overgangsweerstanden, verbindingen, kabelconstructie en meetopstelling kunnen afwijkingen veroorzaken.

## Directe methode

De directe module rekent met U1, U2, meetstroom en geleidergegevens. De visualisatie toont het gekozen aderpaar en de nabije/verre meetlocatie. Gebruik deze route alleen wanneer dit aansluit op de gevalideerde tweedraadsprocedure die in de praktijk wordt toegepast.
