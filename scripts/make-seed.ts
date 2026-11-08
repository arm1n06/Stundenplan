// Erzeugt aus einer Plan-JSON-Datei ein SQL-Skript für den Supabase SQL Editor.
// Aufruf: npm run seed -- supabase/plan-p-mh-2-26-03.json
import { readFileSync, writeFileSync } from 'node:fs'
import { encode } from '../src/lib/codec.ts'
import { normalizeDoc } from '../src/lib/schema.ts'

const input = process.argv[2] ?? 'supabase/plan-p-mh-2-26-03.json'
const output = 'supabase/seed.sql'

const doc = normalizeDoc(JSON.parse(readFileSync(input, 'utf8')))
const lessons = doc.w.reduce((sum, day) => sum + day.length, 0)
const data = encode({ ...doc, c: [] })

writeFileSync(
  output,
  `-- Automatisch erzeugt aus ${input} (${doc.p.length} Stunden, ${lessons} Unterrichtsblöcke).
-- Im Supabase SQL Editor ausführen, NACHDEM schema.sql ausgeführt wurde.
-- ACHTUNG: Ersetzt den kompletten gespeicherten Datensatz (inkl. bereits eingetragener Änderungen).
insert into public.timetable (id, data)
values (1, '${data}')
on conflict (id) do update set data = excluded.data;
`,
)
console.log(`${output} geschrieben (${lessons} Blöcke).`)
