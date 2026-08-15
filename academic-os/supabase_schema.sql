-- Academic OS — tablas para las notificaciones push.
-- Pegar TODO esto en Supabase > SQL Editor > Run. Se puede volver a correr sin miedo.
--
-- Todas las tablas llevan prefijo aos_ y son NUEVAS: no tocan nada de NoMimir,
-- que comparte este mismo proyecto de Supabase.
--
-- Academic OS no tiene login (es de un solo usuario, id fijo 'gerardex'), así que
-- el navegador escribe con la llave anon. Por eso las policies son para el rol
-- `anon` y están acotadas a ese user_id. La tabla aos_sent no tiene ninguna
-- policy a propósito: solo la toca la función de Netlify con la llave
-- service_role, que se salta RLS.

drop table if exists aos_snapshot, aos_push_subs, aos_sent cascade;

-- Lo que el navegador sube: qué hay hoy y mañana en Dexie, más las horas
-- elegidas del briefing y el cierre. Una sola fila.
create table aos_snapshot (
  user_id    text primary key,
  fecha      date not null,
  morning    text not null default '07:00',
  night      text not null default '22:00',
  days       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tokens de FCM (uno por dispositivo/navegador donde active el push).
create table aos_push_subs (
  token   text primary key,
  user_id text not null default 'gerardex',
  creado  timestamptz not null default now()
);

-- Antideduplicado. La clave es `fecha:evento` (ej. 2026-08-15:briefing), así que
-- la primary key es lo que garantiza que un aviso salga UNA sola vez por día
-- aunque la función corra cada 5 minutos.
create table aos_sent (
  clave  text primary key,
  creado timestamptz not null default now()
);

alter table aos_snapshot  enable row level security;
alter table aos_push_subs enable row level security;
alter table aos_sent      enable row level security;

create policy aos_snap_leer on aos_snapshot for select to anon
  using (user_id = 'gerardex');
create policy aos_snap_escribir on aos_snapshot for insert to anon
  with check (user_id = 'gerardex');
create policy aos_snap_actualizar on aos_snapshot for update to anon
  using (user_id = 'gerardex') with check (user_id = 'gerardex');

create policy aos_subs_leer on aos_push_subs for select to anon
  using (user_id = 'gerardex');
create policy aos_subs_escribir on aos_push_subs for insert to anon
  with check (user_id = 'gerardex');
create policy aos_subs_actualizar on aos_push_subs for update to anon
  using (user_id = 'gerardex') with check (user_id = 'gerardex');

-- Limpieza opcional del historial de envíos (no hace falta: son ~8 filas al día).
-- delete from aos_sent where creado < now() - interval '30 days';
