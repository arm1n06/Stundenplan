# Stundenplan

Minimalistische Web-App für den persönlichen Stundenplan: aktueller und nächster Monat auf einen Blick,
Vertretungen, Ausfälle, Verlegungen, Zusatzstunden und Hinweise für beliebige zukünftige Tage.

**Stack:** TypeScript · Vite 8 (Rolldown) · React 19 · CSS Modules · TanStack Router · TanStack Query · Supabase REST API

## Einrichtung

1. **Supabase-Tabelle anlegen:** Inhalt von [`supabase/schema.sql`](supabase/schema.sql) im SQL Editor ausführen.
2. **Stundenplan importieren (optional):** Inhalt von [`supabase/seed.sql`](supabase/seed.sql) im SQL Editor ausführen.
   Er enthält den Plan *P MH 2/26-03* und **ersetzt** den gespeicherten Datensatz – daher nur einmal am Anfang ausführen.
3. **Umgebungsvariablen:** `.env.example` nach `.env.local` kopieren und Projekt-URL + **Publishable Key**
   (`sb_publishable_…`, Supabase → Project Settings → API Keys) eintragen.
   Niemals den Secret Key (`sb_secret_…`) verwenden – die App verweigert ihn.
4. Starten:
   ```bash
   npm install
   npm run dev
   ```

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` |
| `npm run typecheck` | nur Typprüfung |
| `npm test` | Tests der Datenlogik (Node, ohne Zusatzpakete) |
| `npm run seed -- <datei.json>` | erzeugt `supabase/seed.sql` aus einer Plan-JSON-Datei |

## Aufbau

```
src/
  api/supabase.ts        REST-Zugriff (Laden, Upsert mit Bestätigung, Fehlertexte)
  lib/                   reine Logik ohne React – direkt mit node --test testbar
    schema.ts            Typen, Validierung/Normalisierung, KW-Gültigkeit
    schedule.ts          regulärer Plan + Änderungen → Zeilen eines Tages
    cleanup.ts           automatische Bereinigung
    codec.ts             JSON ⇄ Base64 (UTF-8-sicher)
    dates.ts             Datumslogik (lokale YYYY-MM-DD-Strings, ISO-Kalenderwochen)
  hooks/                 TanStack Query (Laden, Mutationen), aktuelles Datum
  components/            wiederverwendbare UI-Bausteine
  pages/                 Übersicht, Änderungen, Regulärer Plan
supabase/                schema.sql, Plan als JSON, erzeugtes seed.sql
scripts/make-seed.ts     JSON → seed.sql
```

## Regulärer Plan

Der Plan besteht aus Blöcken (z. B. Doppelstunde 3.–4.) mit Fach, Lehrkraft, Raum und Gültigkeit nach
Kalenderwoche. Bereiche wie **KW 37–3** laufen über den Jahreswechsel; leere Felder bedeuten „immer gültig“.
Bearbeitbar unter **Regulärer Plan** oder in `supabase/plan-p-mh-2-26-03.json`.

## Änderungen

Jede Änderung betrifft einen Stundenbereich (von–bis). Standardmäßig ist der ganze Block vorausgewählt,
es kann aber auch eine einzelne Stunde einer Doppelstunde gewählt werden – die Übersicht teilt den Block dann auf.
Arten: Vertretung, Ausfall, Verlegung (anderer Tag und/oder andere Uhrzeit), Zusatzstunde, Sonstiges.

## Datenspeicherung

Eine einzige Zeile in `timetable`: `{ "id": 1, "data": "<Base64>" }`. `data` ist das Base64-kodierte JSON
(Typen dokumentiert in `src/lib/schema.ts`):

```json
{ "v": 2,
  "p": [{ "s": "08:00", "e": "08:45" }],
  "w": [[{ "p": 3, "n": 2, "f": "1.1.2 Sozi", "l": "Stolorz", "r": "LG2, C244", "a": 37, "b": 46 }], [], [], [], []],
  "c": [{ "id": "k3f9a2x1", "d": "2026-11-09", "p": 4, "k": "a" }] }
```

Speichern läuft immer als *frisch laden → Änderung anwenden → bereinigen → speichern*. Mutationen werden
nacheinander ausgeführt, die Antwort der Datenbank wird gegen den gesendeten Inhalt geprüft. Erfolg wird
erst angezeigt, wenn Supabase die Speicherung bestätigt hat; bei Fehlern wird die optimistische Anzeige
zurückgesetzt. Nicht lesbare Daten werden nie überschrieben.

## Automatische Bereinigung

Beim Laden/Synchronisieren und bei jedem Speichern werden Änderungen entfernt, deren Datum
**am oder vor dem gleichen Tag des Vormonats** liegt (heute 08.11. → alles bis einschließlich 08.10. wird gelöscht).
Bei Verlegungen zählt das spätere der beiden Daten. Zukünftige Einträge werden nie entfernt.
Vergleiche erfolgen auf lokalen Kalenderdaten, daher keine Zeitzonen-Verschiebungen.

## Sicherheitshinweis

Der Publishable Key ist im ausgelieferten JavaScript sichtbar. Mit den Richtlinien aus `schema.sql` kann jeder,
der die App-URL kennt, den Stundenplan lesen und ändern. Für einen rein persönlichen Plan ist das meist
vertretbar; für mehr Schutz müsste Supabase Auth ergänzt und die Richtlinien auf `authenticated` beschränkt werden.
