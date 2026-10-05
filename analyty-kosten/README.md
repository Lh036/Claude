# Analyty — Kostenbeheer

Losstaande app om alle kosten van Analyty bij te houden: toevoegen, bewerken,
verwijderen, filteren, BTW berekenen, budgetten bewaken en exporteren.

## Starten

```bash
cd analyty-kosten
npm install
npm run dev        # API op :3100 + interface op http://localhost:5173
```

Productie (één proces, serveert ook de interface):

```bash
npm run build
npm start          # http://localhost:3100
```

Data staat in een SQLite-bestand (`data/kosten.sqlite`, aan te passen met
`KOSTEN_DB_PATH`). Maak daar regelmatig een back-up van.

## Wat zit erin

- **Kosten** — tabel met sorteren, zoeken en filters (periode, categorie,
  leverancier, eenmalig/terugkerend), totaalregel, bewerken, dupliceren,
  verwijderen en **CSV-export** (opent direct goed in Nederlandse Excel).
- **Per kost**: datum, omschrijving, leverancier, categorie, bedrag (incl. óf
  excl. BTW), BTW-tarief 0/9/21%, terugkerend (maand/kwartaal/jaar) en notities.
  Het veld **bon/factuur-link** bestaat al in de database en de API, maar staat
  in de interface uit ("nog niet in gebruik") tot het bonnen-systeem gekoppeld is.
- **Overzicht** — kosten deze maand (met vergelijking vorige maand), dit jaar,
  betaalde BTW, vaste lasten per maand, grafiek per maand, verdeling per
  categorie, budgetten, BTW per kwartaal en terugkerende kosten met een knop om
  de volgende termijn te boeken.
- **Categorieën & budgetten** — standaardcategorieën (aanpasbaar), maandbudget
  per categorie; bij verwijderen kies je waar de kosten heen gaan.
- **BTW-calculator** — 9% en 21%, vanaf excl. of incl., met de formule erbij.

## BTW: altijd dezelfde formule

De berekening staat in [`shared/vat.ts`](shared/vat.ts) en wordt door zowel de
server als de browser gebruikt. Alles gaat in hele centen (geen kommagetallen),
afronding half naar boven:

| Ingevoerd | BTW | Andere bedrag |
|---|---|---|
| excl. BTW | `afronden(excl × tarief / 100)` | `incl = excl + btw` |
| incl. BTW | `afronden(incl × tarief / (100 + tarief))` | `excl = incl − btw` |

De server rekent de BTW altijd zelf opnieuw uit bij opslaan, en de database
weigert elke regel waarbij `excl + btw ≠ incl`. De tests (`npm test`) controleren
dit voor tienduizenden bedragen per tarief.

## Huisstijl

Kleuren staan als variabelen bovenin [`src/index.css`](src/index.css): beige en
wit als basis, zwart en limoengroen uit het logo (`public/logo.svg`).
