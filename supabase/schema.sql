-- Einmalig im Supabase SQL Editor ausführen.
-- Eine einzige Zeile (id = 1) enthält den kompletten Stundenplan als Base64-kodiertes JSON.

create table if not exists public.timetable (
  id smallint primary key default 1 check (id = 1),
  data text not null
);

alter table public.timetable enable row level security;

-- Zugriff mit dem Anon-/Publishable-Key: lesen, anlegen, aktualisieren (kein Löschen der Zeile).
drop policy if exists "timetable_select" on public.timetable;
drop policy if exists "timetable_insert" on public.timetable;
drop policy if exists "timetable_update" on public.timetable;

create policy "timetable_select" on public.timetable for select to anon using (true);
create policy "timetable_insert" on public.timetable for insert to anon with check (id = 1);
create policy "timetable_update" on public.timetable for update to anon using (id = 1) with check (id = 1);

grant select, insert, update on public.timetable to anon;
