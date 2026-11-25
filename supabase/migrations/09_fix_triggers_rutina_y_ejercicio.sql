-- ==============================================================================
-- MIGRACIÓN 09: FIX TRIGGERS DE rutina_gimnasio / ejercicio_gimnasio
-- Resuelve: record "new" has no field "id_rutina_socio" (y "id_ejercicio_socio")
-- al editar registros en public.rutina_gimnasio o public.ejercicio_gimnasio.
--
-- Causa raíz:
--   En PL/pgSQL, evaluar `if tg_table_name = 'rutina_socio' and (new.id_rutina_socio ...)`
--   en una misma expresión NO hace cortocircuito en la resolución de campos de `NEW`/`OLD`.
--   Al actualizar `rutina_gimnasio`, PostgreSQL intentaba resolver `new.id_rutina_socio`.
--
-- Solución idempotente:
--   1. Crear funciones trigger dedicadas por tabla (`rutina_socio`, `rutina_gimnasio`,
--      `ejercicio_socio`, `ejercicio_gimnasio`).
--   2. Reasociar los 4 triggers a sus funciones dedicadas.
--   3. Actualizar también las funciones compartidas legacy usando `to_jsonb(new)`/`to_jsonb(old)`.
-- ==============================================================================

begin;

-- 1. Funciones dedicadas para ejercicios
create or replace function public.trg_fn_proteger_ejercicio_socio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_ejercicio_socio is distinct from old.id_ejercicio_socio
     or new.id_socio is distinct from old.id_socio then
    raise exception 'No está permitido transferir un ejercicio_socio.';
  end if;
  return new;
end;
$$;

create or replace function public.trg_fn_proteger_ejercicio_gimnasio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_ejercicio_gimnasio is distinct from old.id_ejercicio_gimnasio
     or new.id_gimnasio is distinct from old.id_gimnasio then
    raise exception 'No está permitido transferir un ejercicio_gimnasio.';
  end if;
  return new;
end;
$$;

create or replace function public.trg_fn_proteger_propietario_ejercicio_sep()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  if tg_table_name = 'ejercicio_socio'
     and ((v_new->>'id_ejercicio_socio') is distinct from (v_old->>'id_ejercicio_socio')
       or (v_new->>'id_socio') is distinct from (v_old->>'id_socio')) then
    raise exception 'No está permitido transferir un ejercicio_socio.';
  elsif tg_table_name = 'ejercicio_gimnasio'
     and ((v_new->>'id_ejercicio_gimnasio') is distinct from (v_old->>'id_ejercicio_gimnasio')
       or (v_new->>'id_gimnasio') is distinct from (v_old->>'id_gimnasio')) then
    raise exception 'No está permitido transferir un ejercicio_gimnasio.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_ejercicio_socio on public.ejercicio_socio;
create trigger trg_proteger_ejercicio_socio
before update on public.ejercicio_socio
for each row execute function public.trg_fn_proteger_ejercicio_socio();

drop trigger if exists trg_proteger_ejercicio_gimnasio on public.ejercicio_gimnasio;
create trigger trg_proteger_ejercicio_gimnasio
before update on public.ejercicio_gimnasio
for each row execute function public.trg_fn_proteger_ejercicio_gimnasio();

-- 2. Funciones dedicadas para rutinas
create or replace function public.trg_fn_proteger_rutina_socio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_rutina_socio is distinct from old.id_rutina_socio
     or new.id_socio is distinct from old.id_socio then
    raise exception 'No está permitido transferir una rutina_socio.';
  end if;
  return new;
end;
$$;

create or replace function public.trg_fn_proteger_rutina_gimnasio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_rutina_gimnasio is distinct from old.id_rutina_gimnasio
     or new.id_gimnasio is distinct from old.id_gimnasio then
    raise exception 'No está permitido transferir una rutina_gimnasio.';
  end if;
  return new;
end;
$$;

create or replace function public.trg_fn_proteger_propietario_rutina_sep()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  if tg_table_name = 'rutina_socio'
     and ((v_new->>'id_rutina_socio') is distinct from (v_old->>'id_rutina_socio')
       or (v_new->>'id_socio') is distinct from (v_old->>'id_socio')) then
    raise exception 'No está permitido transferir una rutina_socio.';
  elsif tg_table_name = 'rutina_gimnasio'
     and ((v_new->>'id_rutina_gimnasio') is distinct from (v_old->>'id_rutina_gimnasio')
       or (v_new->>'id_gimnasio') is distinct from (v_old->>'id_gimnasio')) then
    raise exception 'No está permitido transferir una rutina_gimnasio.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_rutina_socio on public.rutina_socio;
create trigger trg_proteger_rutina_socio
before update on public.rutina_socio
for each row execute function public.trg_fn_proteger_rutina_socio();

drop trigger if exists trg_proteger_rutina_gimnasio on public.rutina_gimnasio;
create trigger trg_proteger_rutina_gimnasio
before update on public.rutina_gimnasio
for each row execute function public.trg_fn_proteger_rutina_gimnasio();

commit;
