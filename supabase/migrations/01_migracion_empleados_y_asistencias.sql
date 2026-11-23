-- ============================================================================
-- MIGRACIÓN ADITIVA 01: Empleados (Auth + Estado + Gimnasio), Integridad de
-- Tablas Sensibles, Asistencias concurrentes y tabla aditiva public.progreso.
--
-- NO modifica destructivamente GymTrack_Supabase_PostgreSQL.sql.
-- NO vuelve a ejecutar la creación inicial de tablas base.
-- Ejecutar en Supabase SQL Editor DESPUÉS de GymTrack_Supabase_PostgreSQL.sql.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Ampliar public.empleado para vinculación con Supabase Auth, estado lógico
--    y pertenencia a gimnasio.
-- ----------------------------------------------------------------------------
alter table public.empleado
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null,
  add column if not exists estado boolean not null default true,
  add column if not exists id_gimnasio bigint references public.gimnasio(id_gimnasio) on delete cascade,
  add column if not exists fecha_creacion timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_empleado_gimnasio'
      and conrelid = 'public.empleado'::regclass
  ) then
    alter table public.empleado
      add constraint uq_empleado_gimnasio unique (id_empleado, id_gimnasio);
  end if;
end $$;

create index if not exists idx_empleado_gimnasio on public.empleado(id_gimnasio);
create index if not exists idx_empleado_auth_user on public.empleado(auth_user_id);

-- Impedir reasignar empleado.id_gimnasio si ya posee sucursales de otro gimnasio
create or replace function public.trg_fn_proteger_empleado_gimnasio_cambio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_gimnasio is distinct from old.id_gimnasio then
    if exists (
      select 1
      from public.empleado_sucursal es
      join public.sucursal s on s.id_sucursal = es.id_sucursal
      where es.id_empleado = old.id_empleado
        and s.id_gimnasio is distinct from new.id_gimnasio
    ) then
      raise exception 'No se puede cambiar el gimnasio del empleado % mientras tenga sucursales asignadas de otro gimnasio.', old.id_empleado;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_empleado_gimnasio_cambio on public.empleado;
create trigger trg_proteger_empleado_gimnasio_cambio
before update of id_gimnasio on public.empleado
for each row
execute function public.trg_fn_proteger_empleado_gimnasio_cambio();

-- ----------------------------------------------------------------------------
-- 2. Ampliar public.empleado_sucursal: roles válidos, estado y coherencia de gym
-- ----------------------------------------------------------------------------
alter table public.empleado_sucursal
  add column if not exists estado boolean not null default true,
  add column if not exists fecha_asignacion timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ck_empleado_sucursal_rol'
      and conrelid = 'public.empleado_sucursal'::regclass
  ) then
    alter table public.empleado_sucursal
      add constraint ck_empleado_sucursal_rol
      check (lower(rol) in ('administrador', 'recepcionista', 'entrenador'));
  end if;
end $$;

create index if not exists idx_empleado_sucursal_empleado on public.empleado_sucursal(id_empleado);

-- Trigger estricto: exige que empleado y sucursal existan y pertenezcan al mismo gimnasio
create or replace function public.trg_fn_validar_empleado_sucursal_gimnasio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_emp_gym bigint;
  v_suc_gym bigint;
begin
  select e.id_gimnasio into v_emp_gym
  from public.empleado e
  where e.id_empleado = new.id_empleado;

  if not found then
    raise exception 'El empleado indicado (%) no existe.', new.id_empleado;
  end if;

  if v_emp_gym is null then
    raise exception 'El empleado (%) no tiene un gimnasio asignado; no puede vincularse a una sucursal.', new.id_empleado;
  end if;

  select s.id_gimnasio into v_suc_gym
  from public.sucursal s
  where s.id_sucursal = new.id_sucursal;

  if not found or v_suc_gym is null then
    raise exception 'La sucursal indicada (%) no existe.', new.id_sucursal;
  end if;

  if v_emp_gym <> v_suc_gym then
    raise exception 'No se puede asignar un empleado del gimnasio % a una sucursal del gimnasio %.', v_emp_gym, v_suc_gym;
  end if;

  if new.rol is null or pg_catalog.btrim(new.rol) = '' then
    raise exception 'El rol del empleado en la sucursal es obligatorio.';
  end if;

  new.rol := pg_catalog.lower(pg_catalog.btrim(new.rol));
  return new;
end;
$$;

drop trigger if exists trg_validar_empleado_sucursal_gimnasio on public.empleado_sucursal;
create trigger trg_validar_empleado_sucursal_gimnasio
before insert or update on public.empleado_sucursal
for each row
execute function public.trg_fn_validar_empleado_sucursal_gimnasio();

-- ----------------------------------------------------------------------------
-- 3. Protección contra modificación indebida de identidad, estado y auditoría
-- ----------------------------------------------------------------------------

-- 3a. public.dueno: inmutabilidad de id_dueno, auth_user_id y fecha_creacion
create or replace function public.trg_fn_proteger_campos_dueno()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
begin
  if v_jwt_role = 'service_role' or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and auth.uid() is null) then
    return new;
  end if;

  if new.id_dueno is distinct from old.id_dueno
     or new.auth_user_id is distinct from old.auth_user_id
     or new.fecha_creacion is distinct from old.fecha_creacion then
    raise exception 'No tienes autorización para modificar columnas de identidad o auditoría del dueño.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_dueno on public.dueno;
create trigger trg_proteger_campos_dueno
before update on public.dueno
for each row
execute function public.trg_fn_proteger_campos_dueno();

-- 3b. public.socio: impedir apropiación de auth_user_id y proteger estado/fecha_alta
create or replace function public.trg_fn_proteger_campos_socio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_es_dueno_o_admin boolean := false;
begin
  if v_jwt_role = 'service_role' or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null) then
    return new;
  end if;

  if new.id_socio is distinct from old.id_socio then
    raise exception 'No se puede modificar el identificador del socio.';
  end if;

  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'No tienes autorización para modificar auth_user_id del socio.';
  end if;

  if new.fecha_alta is distinct from old.fecha_alta then
    raise exception 'No se puede modificar la fecha de alta administrativa del socio.';
  end if;

  if new.estado is distinct from old.estado then
    select (
      exists (
        select 1
        from public.membresia_socio ms
        join public.gimnasio g on g.id_gimnasio = ms.id_gimnasio
        join public.dueno d on d.id_dueno = g.id_dueno
        where ms.id_socio = old.id_socio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.membresia_socio ms
        join public.empleado e on e.id_gimnasio = ms.id_gimnasio
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal s on s.id_sucursal = es.id_sucursal and s.id_gimnasio = ms.id_gimnasio
        where ms.id_socio = old.id_socio
          and e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and pg_catalog.lower(es.rol) = 'administrador'
      )
    ) into v_es_dueno_o_admin;

    if not coalesce(v_es_dueno_o_admin, false) then
      raise exception 'Solo el dueño o administrador autorizado del gimnasio puede cambiar el estado del socio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_socio on public.socio;
create trigger trg_proteger_campos_socio
before update on public.socio
for each row
execute function public.trg_fn_proteger_campos_socio();

-- 3c. public.membresia_socio: preservar condiciones históricas contratadas
create or replace function public.trg_fn_proteger_membresia_socio_inmutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
begin
  if v_jwt_role = 'service_role' or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and auth.uid() is null) then
    return new;
  end if;

  if new.id_membresia_socio is distinct from old.id_membresia_socio
     or new.id_socio is distinct from old.id_socio
     or new.id_membresia_gimnasio is distinct from old.id_membresia_gimnasio
     or new.id_gimnasio is distinct from old.id_gimnasio
     or new.precio is distinct from old.precio
     or new.duracion_dias_contratados is distinct from old.duracion_dias_contratados
     or new.limite_asistencias_semanales is distinct from old.limite_asistencias_semanales
     or new.limite_asistencias_totales is distinct from old.limite_asistencias_totales
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No se pueden alterar las condiciones históricas ni titulares de una membresía contratada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_membresia_socio_inmutable on public.membresia_socio;
create trigger trg_proteger_membresia_socio_inmutable
before update on public.membresia_socio
for each row
execute function public.trg_fn_proteger_membresia_socio_inmutable();

-- 3d. public.pago: impedir DELETE físico y alteración de importes/fechas/anulados
create or replace function public.trg_fn_proteger_pago_inmutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'Está prohibido eliminar registros de pago; realice una anulación lógica (estado = ''anulado'').';
  end if;

  if v_jwt_role = 'service_role' or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and auth.uid() is null) then
    return new;
  end if;

  if new.id_pago is distinct from old.id_pago
     or new.id_membresia_socio is distinct from old.id_membresia_socio
     or new.monto is distinct from old.monto
     or new.fecha_pago is distinct from old.fecha_pago
     or new.metodo_pago is distinct from old.metodo_pago
     or new.comprobante is distinct from old.comprobante then
    raise exception 'No se pueden modificar importes, fechas, referencias ni método de un pago existente.';
  end if;

  if old.estado = 'anulado' and new.estado is distinct from old.estado then
    raise exception 'Un pago anulado es inmutable para preservar el historial contable.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_pago_inmutable on public.pago;
create trigger trg_proteger_pago_inmutable
before update or delete on public.pago
for each row
execute function public.trg_fn_proteger_pago_inmutable();

-- Índice único parcial para prevenir comprobantes duplicados activos en la misma contratación
create unique index if not exists uq_pago_contrato_comprobante_activo
  on public.pago (id_membresia_socio, pg_catalog.lower(pg_catalog.btrim(comprobante)))
  where comprobante is not null and estado <> 'anulado';

-- 3e. public.ejercicio y public.rutina: impedir transferencia/apropiación de propiedad
create or replace function public.trg_fn_proteger_propietario_ejercicio()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_ejercicio is distinct from old.id_ejercicio
     or new.id_socio is distinct from old.id_socio
     or new.id_gimnasio is distinct from old.id_gimnasio then
    raise exception 'No está permitido transferir ni reasignar la propiedad de un ejercicio existente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_propietario_ejercicio on public.ejercicio;
create trigger trg_proteger_propietario_ejercicio
before update on public.ejercicio
for each row
execute function public.trg_fn_proteger_propietario_ejercicio();

create or replace function public.trg_fn_proteger_propietario_rutina()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_rutina is distinct from old.id_rutina
     or new.id_socio is distinct from old.id_socio then
    raise exception 'No está permitido cambiar el socio propietario de una rutina existente.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_propietario_rutina on public.rutina;
create trigger trg_proteger_propietario_rutina
before update on public.rutina
for each row
execute function public.trg_fn_proteger_propietario_rutina();

-- ----------------------------------------------------------------------------
-- 4. Asistencias: impedir dos ingresos simultáneos abiertos para el mismo socio
--    (sin referenciar id_gimnasio ni id_membresia_socio)
-- ----------------------------------------------------------------------------
drop index if exists public.idx_asistencia_gimnasio_fecha;

create unique index if not exists uq_asistencia_abierta_socio
  on public.asistencia_socio (id_socio)
  where (estado = 'presente' and hora_salida is null);

-- ----------------------------------------------------------------------------
-- 5. Tabla aditiva opcional: public.progreso (seguimiento corporal del socio)
-- ----------------------------------------------------------------------------
create table if not exists public.progreso (
  id_progreso bigint generated by default as identity primary key,
  id_socio bigint not null references public.socio(id_socio) on delete cascade,
  peso numeric(6,2) not null check (peso > 0),
  fecha date not null default current_date,
  observaciones text,
  creado_en timestamptz not null default now()
);

create index if not exists idx_progreso_socio_fecha on public.progreso(id_socio, fecha desc);
alter table public.progreso enable row level security;

create or replace function public.trg_fn_proteger_progreso()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id_progreso is distinct from old.id_progreso
     or new.id_socio is distinct from old.id_socio then
    raise exception 'No está permitido reasignar un registro de progreso a otro socio.';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.progreso') is not null then
    drop trigger if exists trg_proteger_progreso on public.progreso;
    create trigger trg_proteger_progreso
    before update on public.progreso
    for each row
    execute function public.trg_fn_proteger_progreso();
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Revocar EXECUTE sobre funciones trigger a PUBLIC, anon y authenticated
-- ----------------------------------------------------------------------------
revoke all on function public.trg_fn_proteger_empleado_gimnasio_cambio() from public, anon, authenticated;
revoke all on function public.trg_fn_validar_empleado_sucursal_gimnasio() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_campos_dueno() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_campos_socio() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_membresia_socio_inmutable() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_pago_inmutable() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_propietario_ejercicio() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_propietario_rutina() from public, anon, authenticated;
revoke all on function public.trg_fn_proteger_progreso() from public, anon, authenticated;

commit;
