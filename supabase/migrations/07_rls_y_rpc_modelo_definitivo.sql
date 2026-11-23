-- ============================================================================
-- MIGRACIÓN INCREMENTAL 07 (HARDENING DEFINITIVO): Seguridad RLS, Privilegios
-- de Tabla/Columna, Vistas de Catálogo y RPCs para el Modelo Definitivo.
--
-- Correcciones de hardening incluidas:
--   1. SECURITY DEFINER: elimina toda detección basada en current_user;
--      valida únicamente contexto JWT confiable (auth.role() = 'service_role'
--      con auth.uid() IS NULL o sesión autenticada auth.uid() NOT NULL),
--      search_path = pg_catalog, public, objetos calificados y propietario
--      seguro.
--   2. socio_gimnasio: revoca INSERT/UPDATE/DELETE directo a authenticated;
--      asociación y desactivación canalizadas vía RPC autorizada por el gym.
--   3. membresia_socio: revoca UPDATE y DELETE directos; toda contratación,
--      renovación anticipada encadenada o cambio de estado pasa por RPC.
--   4. pago: máquina de estados unificada en rpc_registrar_pago y
--      rpc_actualizar_estado_pago; prohíbe sobrepagos, activación por pago
--      parcial, reactivación de anulados y comprobantes duplicados; revierte
--      membresía a 'pendiente' (sin destruir historial) si al anular un pago
--      deja de cubrirse el precio contratado.
--   5. rpc_vincular_identidad_perfil: valida email_confirmed_at IS NOT NULL,
--      bloqueo transaccional y locks FOR UPDATE, detección de duplicados,
--      protección contra apropiación de otro auth_user_id y soporte múltiple
--      de perfiles por identidad Auth.
--   6. Correcciones específicas de RPC: sin uso ambiguo de FOUND en
--      rpc_registrar_socio_gimnasio; validación explícita de sucursal.id_gimnasio
--      = empleado.id_gimnasio en todas las RPCs; atribución exacta del
--      empleado responsable en rutinas asignadas; trazabilidad de anulación
--      en asistencia_socio (anulada_por, anulada_en, motivo_anulacion).
--   7. privilegios mínimos por tabla/columna, protección de rutinas asignadas
--      vía RPC, public.progreso condicional completo y congelamiento legacy.
--
-- NO ejecutar sobre Supabase remoto sin aprobación/ventana controlada.
-- Ejecutar DESPUÉS de 06_separacion_ejercicios_y_rutinas.sql (Escenario B)
-- o DESPUÉS de schema_definitivo.sql (Escenario A).
-- ============================================================================

begin;

-- ============================================================================
-- 0. EXTENSIONES DE AUDITORÍA NO DESTRUCTIVAS SOBRE TABLAS EXISTENTES
-- ============================================================================
alter table public.asistencia_socio
  add column if not exists anulada_por uuid references auth.users(id) on delete set null,
  add column if not exists anulada_en timestamptz,
  add column if not exists motivo_anulacion text;

-- ============================================================================
-- 1. HELPERS DE IDENTIDAD Y AUTORIZACIÓN (SECURITY DEFINER, search_path fijo)
-- ============================================================================

-- Helper interno: determina si la invocación proviene genuinamente de service_role
-- (SIN depender jamás de pg_catalog.current_user; exige ausencia de sub/uid y
-- consistencia estricta entre request.jwt.claims, claim.role y auth.role()).
create or replace function public.fn_es_service_role()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claims_raw text := nullif(pg_catalog.btrim(pg_catalog.current_setting('request.jwt.claims', true)), '');
  v_claims_json jsonb := null;
  v_claims_role text := null;
  v_claims_sub text := null;
  v_claim_role text := nullif(pg_catalog.btrim(pg_catalog.current_setting('request.jwt.claim.role', true)), '');
  v_claim_sub text := nullif(pg_catalog.btrim(pg_catalog.current_setting('request.jwt.claim.sub', true)), '');
  v_auth_role text := nullif(pg_catalog.btrim(auth.role()), '');
begin
  if auth.uid() is not null or v_claim_sub is not null then
    return false;
  end if;

  if v_claims_raw is not null then
    if v_claims_raw !~ '^\s*\{.*\}\s*$' then
      return false;
    end if;
    v_claims_json := v_claims_raw::jsonb;
    v_claims_sub := nullif(pg_catalog.btrim(v_claims_json ->> 'sub'), '');
    if v_claims_sub is not null then
      return false;
    end if;
    v_claims_role := nullif(pg_catalog.btrim(v_claims_json ->> 'role'), '');
  end if;

  if v_claims_role is not null and v_claim_role is not null and v_claims_role <> v_claim_role then
    return false;
  end if;

  return pg_catalog.coalesce(v_claims_role, v_claim_role, v_auth_role, '') = 'service_role';
end;
$$;

create or replace function public.fn_current_dueno_id()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select d.id_dueno
  from public.dueno d
  where d.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.fn_current_socio_id()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select s.id_socio
  from public.socio s
  where s.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.fn_current_empleado_id()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select e.id_empleado
  from public.empleado e
  where e.auth_user_id = auth.uid()
    and e.estado = true
  limit 1;
$$;

create or replace function public.fn_current_administrador_id()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select a.id_administrador
  from public.administrador a
  where a.auth_user_id = auth.uid()
    and a.estado = true
  limit 1;
$$;

create or replace function public.fn_dueno_posee_gimnasio(p_id_gimnasio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.gimnasio g
    join public.dueno d on d.id_dueno = g.id_dueno
    where g.id_gimnasio = p_id_gimnasio
      and d.auth_user_id = auth.uid()
  );
$$;

create or replace function public.fn_dueno_posee_sucursal(p_id_sucursal bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sucursal s
    join public.gimnasio g on g.id_gimnasio = s.id_gimnasio
    join public.dueno d on d.id_dueno = g.id_dueno
    where s.id_sucursal = p_id_sucursal
      and d.auth_user_id = auth.uid()
  );
$$;

create or replace function public.fn_admin_posee_gimnasio(p_id_gimnasio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.administrador a
    join public.administrador_gimnasio ag on ag.id_administrador = a.id_administrador
    where a.auth_user_id = auth.uid()
      and a.estado = true
      and ag.estado = true
      and ag.id_gimnasio = p_id_gimnasio
  );
$$;

create or replace function public.fn_admin_posee_sucursal(p_id_sucursal bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sucursal s
    join public.administrador_gimnasio ag on ag.id_gimnasio = s.id_gimnasio
    join public.administrador a on a.id_administrador = ag.id_administrador
    where s.id_sucursal = p_id_sucursal
      and a.auth_user_id = auth.uid()
      and a.estado = true
      and ag.estado = true
  );
$$;

create or replace function public.fn_empleado_en_gimnasio(
  p_id_gimnasio bigint,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.empleado e
    join public.empleado_sucursal es on es.id_empleado = e.id_empleado
    join public.sucursal s on s.id_sucursal = es.id_sucursal
    where e.auth_user_id = auth.uid()
      and e.estado = true
      and e.id_gimnasio = p_id_gimnasio
      and es.estado = true
      and s.id_gimnasio = p_id_gimnasio
      and (p_roles is null or pg_catalog.lower(es.rol) = any(p_roles))
  );
$$;

create or replace function public.fn_empleado_en_sucursal(
  p_id_sucursal bigint,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.empleado e
    join public.empleado_sucursal es on es.id_empleado = e.id_empleado
    join public.sucursal s on s.id_sucursal = es.id_sucursal
    where e.auth_user_id = auth.uid()
      and e.estado = true
      and es.estado = true
      and es.id_sucursal = p_id_sucursal
      and e.id_gimnasio = s.id_gimnasio
      and (p_roles is null or pg_catalog.lower(es.rol) = any(p_roles))
  );
$$;

create or replace function public.fn_socio_asociado_gimnasio(
  p_id_gimnasio bigint,
  p_solo_activos boolean default true
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.socio_gimnasio sg
    join public.socio s on s.id_socio = sg.id_socio
    where s.auth_user_id = auth.uid()
      and sg.id_gimnasio = p_id_gimnasio
      and (not p_solo_activos or sg.estado = true)
  );
$$;

create or replace function public.fn_socio_tiene_gimnasio(
  p_id_gimnasio bigint,
  p_estados text[] default array['activa', 'pendiente', 'vencida']
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.socio_gimnasio sg
    join public.socio s on s.id_socio = sg.id_socio
    left join public.membresia_socio ms
      on ms.id_socio_gimnasio = sg.id_socio_gimnasio
     and ms.id_gimnasio = sg.id_gimnasio
    where s.auth_user_id = auth.uid()
      and sg.id_gimnasio = p_id_gimnasio
      and (
        sg.estado = true
        or (ms.id_membresia_socio is not null and (p_estados is null or ms.estado = any(p_estados)))
      )
  );
$$;

create or replace function public.fn_socio_puede_asistir_sucursal(
  p_id_socio bigint,
  p_id_sucursal bigint
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (
    (
      p_id_socio = public.fn_current_socio_id()
      or public.fn_dueno_posee_sucursal(p_id_sucursal)
      or public.fn_admin_posee_sucursal(p_id_sucursal)
      or public.fn_empleado_en_sucursal(p_id_sucursal, array['administrador', 'recepcionista'])
    )
    and exists (
      select 1
      from public.sucursal suc
      join public.gimnasio g on g.id_gimnasio = suc.id_gimnasio
      join public.socio soc on soc.id_socio = p_id_socio
      join public.socio_gimnasio sg
        on sg.id_socio = soc.id_socio
       and sg.id_gimnasio = suc.id_gimnasio
      join public.membresia_socio ms
        on ms.id_socio_gimnasio = sg.id_socio_gimnasio
       and ms.id_gimnasio = suc.id_gimnasio
      where suc.id_sucursal = p_id_sucursal
        and suc.estado = true
        and g.estado = true
        and soc.estado = true
        and sg.estado = true
        and ms.estado = 'activa'
        and current_date between ms.fecha_inicio and ms.fecha_vencimiento
    )
  );
$$;

create or replace function public.fn_staff_puede_ver_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.socio_gimnasio sg
    where sg.id_socio = p_id_socio
      and (
        public.fn_dueno_posee_gimnasio(sg.id_gimnasio)
        or public.fn_admin_posee_gimnasio(sg.id_gimnasio)
        or public.fn_empleado_en_gimnasio(sg.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
      )
  );
$$;

create or replace function public.fn_staff_puede_gestionar_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.socio_gimnasio sg
    where sg.id_socio = p_id_socio
      and (
        public.fn_dueno_posee_gimnasio(sg.id_gimnasio)
        or public.fn_admin_posee_gimnasio(sg.id_gimnasio)
        or public.fn_empleado_en_gimnasio(sg.id_gimnasio, array['administrador', 'recepcionista'])
      )
  );
$$;

create or replace function public.fn_staff_puede_gestionar_rutinas_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.socio_gimnasio sg
    where sg.id_socio = p_id_socio
      and sg.estado = true
      and (
        public.fn_dueno_posee_gimnasio(sg.id_gimnasio)
        or public.fn_admin_posee_gimnasio(sg.id_gimnasio)
        or public.fn_empleado_en_gimnasio(sg.id_gimnasio, array['administrador', 'entrenador'])
      )
  );
$$;

-- ============================================================================
-- 1.5. TRIGGERS DE INMUTABILIDAD Y PROTECCIÓN POR COLUMNA (SIN current_user)
-- ============================================================================

create or replace function public.trg_fn_proteger_campos_dueno()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.fn_es_service_role() then
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
for each row execute function public.trg_fn_proteger_campos_dueno();

create or replace function public.trg_fn_proteger_campos_empleado()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if new.id_empleado is distinct from old.id_empleado
     or new.auth_user_id is distinct from old.auth_user_id
     or new.id_gimnasio is distinct from old.id_gimnasio
     or new.fecha_creacion is distinct from old.fecha_creacion then
    raise exception 'No tienes autorización para modificar identidad, gimnasio titular ni fecha_creacion del empleado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_empleado on public.empleado;
create trigger trg_proteger_campos_empleado
before update on public.empleado
for each row execute function public.trg_fn_proteger_campos_empleado();

create or replace function public.trg_fn_proteger_campos_socio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_es_autorizado boolean := false;
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if v_uid is null then
    raise exception 'Contexto de autenticación inválido para modificar socios.';
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
        from public.socio_gimnasio sg
        join public.gimnasio g on g.id_gimnasio = sg.id_gimnasio
        join public.dueno d on d.id_dueno = g.id_dueno
        where sg.id_socio = old.id_socio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.socio_gimnasio sg
        join public.administrador_gimnasio ag on ag.id_gimnasio = sg.id_gimnasio
        join public.administrador a on a.id_administrador = ag.id_administrador
        where sg.id_socio = old.id_socio
          and a.auth_user_id = v_uid
          and a.estado = true
          and ag.estado = true
      )
      or exists (
        select 1
        from public.socio_gimnasio sg
        join public.empleado e on e.id_gimnasio = sg.id_gimnasio
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal s on s.id_sucursal = es.id_sucursal
        where sg.id_socio = old.id_socio
          and s.id_gimnasio = sg.id_gimnasio
          and e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and pg_catalog.lower(es.rol) = 'administrador'
      )
    ) into v_es_autorizado;

    if not coalesce(v_es_autorizado, false) then
      raise exception 'Solo el dueño o administrador autorizado puede cambiar el estado del socio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_socio on public.socio;
create trigger trg_proteger_campos_socio
before update on public.socio
for each row execute function public.trg_fn_proteger_campos_socio();

create or replace function public.trg_fn_proteger_socio_gimnasio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if new.id_socio_gimnasio is distinct from old.id_socio_gimnasio
     or new.id_socio is distinct from old.id_socio
     or new.id_gimnasio is distinct from old.id_gimnasio
     or new.fecha_alta is distinct from old.fecha_alta
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No está permitido reasignar socio_gimnasio ni alterar fecha_alta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_socio_gimnasio on public.socio_gimnasio;
create trigger trg_proteger_socio_gimnasio
before update on public.socio_gimnasio
for each row execute function public.trg_fn_proteger_socio_gimnasio();

create or replace function public.trg_fn_proteger_campos_administrador()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_es_dueno boolean := false;
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if v_uid is null then
    raise exception 'Contexto de autenticación inválido.';
  end if;

  if new.id_administrador is distinct from old.id_administrador
     or new.auth_user_id is distinct from old.auth_user_id
     or new.fecha_creacion is distinct from old.fecha_creacion then
    raise exception 'No tienes autorización para modificar identificador, auth_user_id ni fecha_creacion del administrador.';
  end if;

  if new.estado is distinct from old.estado then
    select exists (
      select 1
      from public.administrador_gimnasio ag
      join public.gimnasio g on g.id_gimnasio = ag.id_gimnasio
      join public.dueno d on d.id_dueno = g.id_dueno
      where ag.id_administrador = old.id_administrador
        and d.auth_user_id = v_uid
    ) into v_es_dueno;

    if not coalesce(v_es_dueno, false) then
      raise exception 'Solo el dueño del gimnasio puede activar o desactivar un perfil de administrador.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_administrador on public.administrador;
create trigger trg_proteger_campos_administrador
before update on public.administrador
for each row execute function public.trg_fn_proteger_campos_administrador();

create or replace function public.trg_fn_proteger_admin_gimnasio_cambio()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if new.id_administrador_gimnasio is distinct from old.id_administrador_gimnasio
     or new.id_administrador is distinct from old.id_administrador
     or new.id_gimnasio is distinct from old.id_gimnasio
     or new.fecha_asignacion is distinct from old.fecha_asignacion then
    raise exception 'No se puede transferir una asignación administrador_gimnasio; solo modificar su estado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_admin_gimnasio_cambio on public.administrador_gimnasio;
create trigger trg_proteger_admin_gimnasio_cambio
before update on public.administrador_gimnasio
for each row execute function public.trg_fn_proteger_admin_gimnasio_cambio();

create or replace function public.trg_fn_proteger_membresia_socio_inmutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.fn_es_service_role() then
    return new;
  end if;

  if new.id_membresia_socio is distinct from old.id_membresia_socio
     or new.id_socio_gimnasio is distinct from old.id_socio_gimnasio
     or new.id_membresia_gimnasio is distinct from old.id_membresia_gimnasio
     or new.id_gimnasio is distinct from old.id_gimnasio
     or new.precio is distinct from old.precio
     or new.duracion_dias_contratados is distinct from old.duracion_dias_contratados
     or new.limite_asistencias_semanales is distinct from old.limite_asistencias_semanales
     or new.limite_asistencias_totales is distinct from old.limite_asistencias_totales
     or new.fecha_inicio is distinct from old.fecha_inicio
     or new.creado_en is distinct from old.creado_en then
    raise exception 'No se pueden alterar las condiciones históricas, fecha de inicio ni titulares de una membresía contratada.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_membresia_socio_inmutable on public.membresia_socio;
create trigger trg_proteger_membresia_socio_inmutable
before update on public.membresia_socio
for each row execute function public.trg_fn_proteger_membresia_socio_inmutable();

create or replace function public.trg_fn_proteger_pago_inmutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Está prohibido eliminar registros de pago; realice una anulación lógica (estado = ''anulado'').';
  end if;

  if public.fn_es_service_role() then
    if old.estado = 'anulado' and new.estado is distinct from old.estado then
      raise exception 'Un pago anulado es inmutable para preservar el historial contable.';
    end if;
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
for each row execute function public.trg_fn_proteger_pago_inmutable();

-- ============================================================================
-- 2. RPCs TRANSACCIONALES HARDENED (SECURITY DEFINER + CONTROL DE ESTADO)
-- ============================================================================

-- 2a. Asociar socio a un gimnasio (solo dueño, administrador de gym,
--     administrador de sucursal o recepcionista de ese gimnasio, o service_role)
create or replace function public.rpc_asociar_socio_gimnasio(
  p_id_gimnasio bigint,
  p_id_socio bigint default null
)
returns public.socio_gimnasio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_is_staff boolean := false;
  v_gym_estado boolean;
  v_socio_estado boolean;
  v_assoc public.socio_gimnasio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para asociar un socio a un gimnasio.';
  end if;

  if p_id_gimnasio is null or p_id_socio is null then
    raise exception 'Debes indicar el gimnasio y el socio a asociar.';
  end if;

  select g.estado into v_gym_estado
  from public.gimnasio g
  where g.id_gimnasio = p_id_gimnasio;

  if not found or coalesce(v_gym_estado, false) = false then
    raise exception 'El gimnasio % no existe o se encuentra inactivo.', p_id_gimnasio;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = p_id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = p_id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = p_id_gimnasio
          and su.id_gimnasio = p_id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_staff;

    if not coalesce(v_is_staff, false) then
      raise exception 'No tienes autorización para asociar socios al gimnasio %.', p_id_gimnasio;
    end if;
  end if;

  select s.estado into v_socio_estado
  from public.socio s
  where s.id_socio = p_id_socio
  for update;

  if not found or coalesce(v_socio_estado, false) = false then
    raise exception 'El socio % no existe o se encuentra inactivo.', p_id_socio;
  end if;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (p_id_socio, p_id_gimnasio, current_date, true)
  on conflict (id_socio, id_gimnasio)
  do update set estado = true
  returning * into v_assoc;

  return v_assoc;
end;
$$;

-- 2a-bis. Desactivar/reactivar asociación socio_gimnasio sin perder historial
create or replace function public.rpc_cambiar_estado_socio_gimnasio(
  p_id_socio_gimnasio bigint,
  p_estado boolean
)
returns public.socio_gimnasio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_assoc public.socio_gimnasio%rowtype;
  v_is_staff boolean := false;
  v_updated public.socio_gimnasio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para modificar una asociación socio_gimnasio.';
  end if;

  if p_id_socio_gimnasio is null or p_estado is null then
    raise exception 'Debes indicar la asociación y el nuevo estado.';
  end if;

  select * into v_assoc
  from public.socio_gimnasio
  where id_socio_gimnasio = p_id_socio_gimnasio
  for update;

  if not found then
    raise exception 'La asociación socio_gimnasio #% no existe.', p_id_socio_gimnasio;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_assoc.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_assoc.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_assoc.id_gimnasio
          and su.id_gimnasio = v_assoc.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_staff;

    if not coalesce(v_is_staff, false) then
      raise exception 'No tienes autorización para modificar asociaciones en el gimnasio %.', v_assoc.id_gimnasio;
    end if;
  end if;

  update public.socio_gimnasio
  set estado = p_estado
  where id_socio_gimnasio = v_assoc.id_socio_gimnasio
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 2b. Sistema transaccional unificado de pagos (máquina de estados + cobro completo)
create or replace function public.rpc_registrar_pago(
  p_id_membresia_socio bigint,
  p_monto numeric,
  p_metodo_pago varchar,
  p_estado varchar default 'aprobado',
  p_comprobante varchar default null,
  p_fecha_pago timestamptz default now()
)
returns public.pago
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_contrato public.membresia_socio%rowtype;
  v_autorizado boolean := false;
  v_estado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'aprobado')));
  v_metodo varchar(40) := nullif(pg_catalog.lower(pg_catalog.btrim(p_metodo_pago)), '');
  v_comprobante text := nullif(pg_catalog.btrim(p_comprobante), '');
  v_total_aprobado numeric(12,2);
  v_nuevo_total numeric(12,2);
  v_pago public.pago%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar pagos.';
  end if;

  if p_id_membresia_socio is null or p_monto is null or p_monto < 0 or v_metodo is null then
    raise exception 'Parámetros de pago inválidos.';
  end if;

  if v_estado not in ('pendiente', 'aprobado', 'rechazado') then
    raise exception 'Estado inicial de pago inválido (%). Permitidos: pendiente, aprobado, rechazado.', v_estado;
  end if;

  -- Serializar pagos por contratación para evitar carreras concurrentes
  select ms.* into v_contrato
  from public.membresia_socio ms
  where ms.id_membresia_socio = p_id_membresia_socio
  for update;

  if not found then
    raise exception 'La contratación #% no existe.', p_id_membresia_socio;
  end if;

  if v_contrato.estado = 'cancelada' then
    raise exception 'No se pueden registrar pagos sobre una membresía cancelada.';
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_contrato.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_contrato.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_contrato.id_gimnasio
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para registrar pagos en este gimnasio.';
    end if;
  end if;

  if v_comprobante is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('pago_comprobante_gym'),
      pg_catalog.hashtext(v_contrato.id_gimnasio::text || ':' || pg_catalog.lower(v_comprobante))
    );

    if exists (
      select 1
      from public.pago p
      join public.membresia_socio ms on ms.id_membresia_socio = p.id_membresia_socio
      where ms.id_gimnasio = v_contrato.id_gimnasio
        and p.estado <> 'anulado'
        and pg_catalog.lower(pg_catalog.btrim(p.comprobante)) = pg_catalog.lower(v_comprobante)
    ) then
      raise exception 'El comprobante "%" ya se encuentra registrado en este gimnasio.', v_comprobante;
    end if;
  end if;

  -- Validar saldo contratado también antes de insertar (anti-sobrepago estricto)
  select coalesce(sum(p.monto), 0) into v_total_aprobado
  from public.pago p
  where p.id_membresia_socio = p_id_membresia_socio
    and p.estado = 'aprobado';

  if v_estado in ('pendiente', 'aprobado') then
    if (v_total_aprobado + p_monto) > v_contrato.precio then
      raise exception 'El monto (%) excede el saldo pendiente de la contratación (precio: %, ya aprobado: %). No se permiten sobrepagos.',
        p_monto, v_contrato.precio, v_total_aprobado;
    end if;
  end if;

  if v_contrato.precio > 0 and p_monto = 0 and v_estado = 'aprobado' then
    raise exception 'No se puede aprobar un pago de monto 0 cuando el precio contratado es mayor a 0.';
  end if;

  if v_estado = 'aprobado' and v_contrato.precio = 0 and exists (
    select 1 from public.pago p
    where p.id_membresia_socio = p_id_membresia_socio and p.estado = 'aprobado'
  ) then
    raise exception 'La contratación gratuita #% ya posee un pago aprobado registrado.', p_id_membresia_socio;
  end if;

  insert into public.pago (id_membresia_socio, monto, fecha_pago, metodo_pago, estado, comprobante)
  values (p_id_membresia_socio, p_monto, coalesce(p_fecha_pago, now()), v_metodo, v_estado, v_comprobante)
  returning * into v_pago;

  -- Política de activación por cobro completo: solo activa cuando pagos aprobados >= precio
  if v_estado = 'aprobado' then
    v_nuevo_total := v_total_aprobado + p_monto;
    if v_contrato.estado = 'pendiente' and v_nuevo_total >= v_contrato.precio then
      update public.membresia_socio
      set estado = 'activa'
      where id_membresia_socio = v_contrato.id_membresia_socio;
    end if;
  end if;

  return v_pago;
end;
$$;

create or replace function public.rpc_actualizar_estado_pago(
  p_id_pago bigint,
  p_estado varchar
)
returns public.pago
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_id_membresia_socio bigint;
  v_pago public.pago%rowtype;
  v_contrato public.membresia_socio%rowtype;
  v_autorizado boolean := false;
  v_nuevo_estado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, '')));
  v_total_otros_aprobados numeric(12,2);
  v_total_final_aprobado numeric(12,2);
  v_updated public.pago%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para actualizar pagos.';
  end if;

  if p_id_pago is null or v_nuevo_estado not in ('pendiente', 'aprobado', 'rechazado', 'anulado') then
    raise exception 'Parámetros inválidos para actualizar el estado del pago.';
  end if;

  -- Orden canónico de bloqueos (membresia_socio -> pago) alineado con rpc_registrar_pago
  select p.id_membresia_socio into v_id_membresia_socio
  from public.pago p
  where p.id_pago = p_id_pago;

  if not found then
    raise exception 'El pago #% no existe.', p_id_pago;
  end if;

  select * into v_contrato
  from public.membresia_socio
  where id_membresia_socio = v_id_membresia_socio
  for update;

  if not found then
    raise exception 'La contratación #% asociada al pago no existe.', v_id_membresia_socio;
  end if;

  select * into v_pago from public.pago where id_pago = p_id_pago for update;
  if not found then
    raise exception 'El pago #% no existe.', p_id_pago;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_contrato.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_contrato.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_contrato.id_gimnasio
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para modificar este pago.';
    end if;
  end if;

  -- Máquina de estados estricta de pagos
  if v_pago.estado = v_nuevo_estado then
    return v_pago;
  end if;

  if v_pago.estado = 'anulado' then
    raise exception 'El pago #% ya fue anulado y no puede reactivarse ni transicionar.', p_id_pago;
  end if;

  if v_pago.estado = 'pendiente' and v_nuevo_estado not in ('aprobado', 'rechazado', 'anulado') then
    raise exception 'Transición inválida de pago pendiente a %.', v_nuevo_estado;
  elsif v_pago.estado = 'aprobado' and v_nuevo_estado <> 'anulado' then
    raise exception 'Un pago aprobado solo puede transicionar a anulado (intentado: %).', v_nuevo_estado;
  elsif v_pago.estado = 'rechazado' and v_nuevo_estado <> 'anulado' then
    raise exception 'Un pago rechazado solo puede transicionar a anulado; genere un nuevo registro para reintentar.', v_nuevo_estado;
  end if;

  -- Si se aprueba un pago pendiente: verificar saldo y política de cobro completo
  if v_nuevo_estado = 'aprobado' then
    if v_contrato.estado = 'cancelada' then
      raise exception 'No se puede aprobar un pago sobre una contratación cancelada.';
    end if;

    select coalesce(sum(p.monto), 0) into v_total_otros_aprobados
    from public.pago p
    where p.id_membresia_socio = v_contrato.id_membresia_socio
      and p.estado = 'aprobado'
      and p.id_pago <> v_pago.id_pago;

    if (v_total_otros_aprobados + v_pago.monto) > v_contrato.precio then
      raise exception 'Aprobar el pago #% provocaría un sobrepago sobre el valor contratado (%).', p_id_pago, v_contrato.precio;
    end if;
  end if;

  update public.pago
  set estado = v_nuevo_estado
  where id_pago = p_id_pago
  returning * into v_updated;

  -- Recalcular total aprobado tras la transición y sincronizar estado de membresía sin borrar historial
  select coalesce(sum(p.monto), 0) into v_total_final_aprobado
  from public.pago p
  where p.id_membresia_socio = v_contrato.id_membresia_socio
    and p.estado = 'aprobado';

  if v_nuevo_estado = 'aprobado'
     and v_contrato.estado = 'pendiente'
     and v_total_final_aprobado >= v_contrato.precio then
    update public.membresia_socio
    set estado = 'activa'
    where id_membresia_socio = v_contrato.id_membresia_socio;
  elsif v_pago.estado = 'aprobado'
        and v_nuevo_estado = 'anulado'
        and v_contrato.estado = 'activa'
        and v_total_final_aprobado < v_contrato.precio then
    -- Al anular un pago aprobado dejando saldo insuficiente:
    -- si aún está en fecha, vuelve a 'pendiente' (suspende acceso sin borrar historial);
    -- si ya expiró su fecha de vencimiento, conserva cierre histórico 'vencida'.
    update public.membresia_socio
    set estado = case
      when fecha_vencimiento < current_date then 'vencida'
      else 'pendiente'
    end
    where id_membresia_socio = v_contrato.id_membresia_socio;
  end if;

  return v_updated;
end;
$$;

-- 2c. Contratar o renovar membresía sobre socio_gimnasio
create or replace function public.rpc_contratar_membresia(
  p_id_socio bigint,
  p_id_membresia_gimnasio bigint,
  p_fecha_inicio date default current_date,
  p_estado varchar default 'activa',
  p_registrar_pago boolean default false,
  p_metodo_pago varchar default 'efectivo',
  p_estado_pago varchar default 'aprobado',
  p_comprobante varchar default null,
  p_monto_override numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_caller_socio_id bigint;
  v_is_gym_staff boolean := false;
  v_plan public.membresia_gimnasio%rowtype;
  v_gym_estado boolean;
  v_socio public.socio%rowtype;
  v_assoc public.socio_gimnasio%rowtype;
  v_max_vencimiento date;
  v_fecha_inicio date := coalesce(p_fecha_inicio, current_date);
  v_fecha_vencimiento date;
  v_estado_solicitado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'activa')));
  v_estado_pago varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado_pago, 'aprobado')));
  v_estado_contrato_inicial varchar(20);
  v_precio numeric(12,2);
  v_contrato public.membresia_socio%rowtype;
  v_pago public.pago%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para contratar una membresía.';
  end if;

  if p_id_socio is null or p_id_membresia_gimnasio is null then
    raise exception 'Debes indicar el socio y el plan de membresía.';
  end if;

  if v_estado_solicitado not in ('pendiente', 'activa') then
    raise exception 'Estado inicial de membresía inválido (%). Solo se permite pendiente o activa.', v_estado_solicitado;
  end if;

  select mp.* into v_plan
  from public.membresia_gimnasio mp
  where mp.id_membresia_gimnasio = p_id_membresia_gimnasio;

  if not found then
    raise exception 'El plan de membresía (%) no existe.', p_id_membresia_gimnasio;
  end if;

  if not v_plan.estado then
    raise exception 'El plan "%" se encuentra inactivo y no admite nuevas contrataciones.', v_plan.nombre;
  end if;

  select g.estado into v_gym_estado
  from public.gimnasio g
  where g.id_gimnasio = v_plan.id_gimnasio;

  if coalesce(v_gym_estado, false) = false then
    raise exception 'El gimnasio asociado al plan se encuentra inactivo.';
  end if;

  if not v_is_service then
    select s.id_socio into v_caller_socio_id
    from public.socio s
    where s.auth_user_id = v_uid
    limit 1;

    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_plan.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_plan.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_plan.id_gimnasio
          and su.id_gimnasio = v_plan.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_gym_staff;

    if v_is_gym_staff then
      if p_monto_override is not null and p_monto_override < 0 then
        raise exception 'El importe de la contratación no puede ser negativo.';
      end if;
      v_precio := coalesce(p_monto_override, v_plan.precio);
    elsif v_caller_socio_id is not null and v_caller_socio_id = p_id_socio then
      if v_estado_solicitado <> 'pendiente' then
        raise exception 'Un socio no puede activar directamente una membresía sin acreditación de pago.';
      end if;
      if coalesce(p_registrar_pago, false) then
        raise exception 'Un socio no puede registrar pagos administrativos aprobados directamente.';
      end if;
      if p_monto_override is not null and p_monto_override <> v_plan.precio then
        raise exception 'No tienes autorización para modificar el importe o aplicar descuentos al plan.';
      end if;
      if v_fecha_inicio < current_date then
        raise exception 'La fecha de inicio de una solicitud no puede ser retroactiva.';
      end if;
      v_precio := v_plan.precio;
    else
      raise exception 'No tienes autorización para contratar membresías para este socio o gimnasio.';
    end if;
  else
    v_precio := coalesce(p_monto_override, v_plan.precio);
    if v_precio < 0 then
      raise exception 'El precio de la contratación no puede ser negativo.';
    end if;
  end if;

  if coalesce(p_registrar_pago, false) and v_estado_pago <> 'aprobado' and v_estado_solicitado = 'activa' then
    raise exception 'No se puede activar una contratación si el pago inicial registrado tiene estado "%".', v_estado_pago;
  end if;

  select * into v_socio
  from public.socio
  where id_socio = p_id_socio
  for update;

  if not found or not v_socio.estado then
    raise exception 'El socio (%) no existe o se encuentra inactivo.', p_id_socio;
  end if;

  -- El socio debe poseer asociación previa socio_gimnasio (solo staff o service_role puede crearla)
  select * into v_assoc
  from public.socio_gimnasio sg
  where sg.id_socio = p_id_socio
    and sg.id_gimnasio = v_plan.id_gimnasio
  for update;

  if not found then
    if v_is_service or v_is_gym_staff then
      insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
      values (p_id_socio, v_plan.id_gimnasio, current_date, true)
      returning * into v_assoc;
    else
      raise exception 'El socio no posee una asociación socio_gimnasio con el gimnasio %. Debe ser asociado por el gimnasio antes de contratar.', v_plan.id_gimnasio;
    end if;
  elsif not v_assoc.estado then
    if v_is_service or v_is_gym_staff then
      update public.socio_gimnasio
      set estado = true
      where id_socio_gimnasio = v_assoc.id_socio_gimnasio
      returning * into v_assoc;
    else
      raise exception 'Tu asociación con este gimnasio se encuentra desactivada.';
    end if;
  end if;

  if v_estado_solicitado = 'pendiente' and exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'pendiente'
  ) then
    raise exception 'Ya existe una solicitud de membresía pendiente para esta asociación socio-gimnasio.';
  end if;

  -- Renovación anticipada: conservar días restantes encadenando desde vencimiento + 1
  if v_estado_solicitado = 'activa' then
    select max(ms.fecha_vencimiento) into v_max_vencimiento
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'activa'
      and ms.fecha_vencimiento >= current_date;

    if v_max_vencimiento is not null and v_fecha_inicio <= v_max_vencimiento then
      v_fecha_inicio := (v_max_vencimiento + 1);
    end if;
  end if;

  v_fecha_vencimiento := v_fecha_inicio + v_plan.duracion_dias;

  if v_estado_solicitado = 'activa' and exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'activa'
      and ms.fecha_inicio <= v_fecha_vencimiento
      and ms.fecha_vencimiento >= v_fecha_inicio
  ) then
    raise exception 'Ya existe una membresía activa en el rango % a % para esta asociación.', v_fecha_inicio, v_fecha_vencimiento;
  end if;

  -- Si se registra pago pendiente/rechazado junto al alta, la membresía nace pendiente hasta completarse el pago
  v_estado_contrato_inicial := case
    when coalesce(p_registrar_pago, false) and v_estado_pago <> 'aprobado' then 'pendiente'
    else v_estado_solicitado
  end;

  insert into public.membresia_socio (
    id_socio_gimnasio,
    id_membresia_gimnasio,
    id_gimnasio,
    precio,
    duracion_dias_contratados,
    limite_asistencias_semanales,
    limite_asistencias_totales,
    fecha_inicio,
    fecha_vencimiento,
    estado
  )
  values (
    v_assoc.id_socio_gimnasio,
    v_plan.id_membresia_gimnasio,
    v_plan.id_gimnasio,
    v_precio,
    v_plan.duracion_dias,
    v_plan.limite_asistencias_semanales,
    v_plan.limite_asistencias_totales,
    v_fecha_inicio,
    v_fecha_vencimiento,
    v_estado_contrato_inicial
  )
  returning * into v_contrato;

  if coalesce(p_registrar_pago, false) then
    v_pago := public.rpc_registrar_pago(
      v_contrato.id_membresia_socio,
      v_precio,
      p_metodo_pago,
      v_estado_pago,
      p_comprobante,
      now()
    );

    -- Refrescar contrato tras la evaluación unificada de pago
    select * into v_contrato
    from public.membresia_socio
    where id_membresia_socio = v_contrato.id_membresia_socio;
  end if;

  return jsonb_build_object(
    'socio_gimnasio', to_jsonb(v_assoc),
    'membresia_socio', to_jsonb(v_contrato),
    'pago', case when coalesce(p_registrar_pago, false) then to_jsonb(v_pago) else null end
  );
end;
$$;

-- 2c-bis. Cambio controlado de estado/vencimiento en membresia_socio (sin UPDATE directo)
create or replace function public.rpc_actualizar_estado_membresia(
  p_id_membresia_socio bigint,
  p_estado varchar default null,
  p_fecha_vencimiento date default null
)
returns public.membresia_socio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_contrato public.membresia_socio%rowtype;
  v_autorizado boolean := false;
  v_nuevo_estado varchar(20);
  v_nueva_fecha_venc date;
  v_total_aprobado numeric(12,2);
  v_updated public.membresia_socio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para actualizar membresías.';
  end if;

  if p_id_membresia_socio is null then
    raise exception 'Debes indicar la contratación a actualizar.';
  end if;

  select * into v_contrato
  from public.membresia_socio
  where id_membresia_socio = p_id_membresia_socio
  for update;

  if not found then
    raise exception 'La contratación #% no existe.', p_id_membresia_socio;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_contrato.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_contrato.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_contrato.id_gimnasio
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para modificar esta membresía.';
    end if;
  end if;

  v_nuevo_estado := coalesce(pg_catalog.lower(pg_catalog.btrim(p_estado)), v_contrato.estado);
  v_nueva_fecha_venc := coalesce(p_fecha_vencimiento, v_contrato.fecha_vencimiento);

  if v_nuevo_estado not in ('pendiente', 'activa', 'vencida', 'cancelada') then
    raise exception 'Estado de membresía inválido: %', v_nuevo_estado;
  end if;

  if v_nueva_fecha_venc < v_contrato.fecha_inicio then
    raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.';
  end if;

  if v_contrato.estado = 'cancelada' and v_nuevo_estado <> 'cancelada' then
    raise exception 'Una contratación cancelada no puede reactivarse; registre una nueva contratación.';
  end if;

  if v_nuevo_estado = 'activa' and v_contrato.estado = 'pendiente' and v_contrato.precio > 0 then
    select coalesce(sum(p.monto), 0) into v_total_aprobado
    from public.pago p
    where p.id_membresia_socio = v_contrato.id_membresia_socio
      and p.estado = 'aprobado';

    if v_total_aprobado < v_contrato.precio then
      raise exception 'No se puede activar la membresía #% sin pagos aprobados que cubran el importe (% / %).',
        v_contrato.id_membresia_socio, v_total_aprobado, v_contrato.precio;
    end if;
  end if;

  update public.membresia_socio
  set estado = v_nuevo_estado,
      fecha_vencimiento = v_nueva_fecha_venc
  where id_membresia_socio = v_contrato.id_membresia_socio
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 2d. Registrar socio presencial y asociarlo/contratarlo en un gimnasio
--     (sin uso ambiguo de FOUND: usa variable booleana explícita + valida conflicto DNI/email)
create or replace function public.rpc_registrar_socio_gimnasio(
  p_id_gimnasio bigint,
  p_id_membresia_gimnasio bigint,
  p_nombre varchar,
  p_apellido varchar,
  p_dni varchar,
  p_email varchar default null,
  p_telefono varchar default null,
  p_fecha_inicio date default current_date,
  p_estado_membresia varchar default 'activa',
  p_registrar_pago boolean default false,
  p_metodo_pago varchar default 'efectivo',
  p_monto_override numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_is_staff boolean := false;
  v_plan_gym bigint;
  v_clean_dni text := nullif(pg_catalog.btrim(p_dni), '');
  v_clean_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_socio_dni public.socio%rowtype;
  v_socio_email public.socio%rowtype;
  v_has_dni boolean := false;
  v_has_email boolean := false;
  v_socio public.socio%rowtype;
  v_creado boolean := false;
  v_assoc public.socio_gimnasio%rowtype;
  v_res jsonb;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar socios.';
  end if;

  if p_id_gimnasio is null then
    raise exception 'Debes indicar el gimnasio.';
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = p_id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = p_id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = p_id_gimnasio
          and su.id_gimnasio = p_id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_staff;

    if not coalesce(v_is_staff, false) then
      raise exception 'No tienes autorización para registrar socios en el gimnasio %.', p_id_gimnasio;
    end if;
  end if;

  if p_id_membresia_gimnasio is not null then
    select mg.id_gimnasio into v_plan_gym
    from public.membresia_gimnasio mg
    where mg.id_membresia_gimnasio = p_id_membresia_gimnasio;

    if not found or v_plan_gym <> p_id_gimnasio then
      raise exception 'El plan % no pertenece al gimnasio %.', p_id_membresia_gimnasio, p_id_gimnasio;
    end if;
  end if;

  if v_clean_dni is null and v_clean_email is null then
    raise exception 'Debes proporcionar al menos DNI o email para identificar o registrar al socio.';
  end if;

  if v_clean_dni is not null then
    select * into v_socio_dni from public.socio s where s.dni = v_clean_dni limit 1;
    v_has_dni := found;
  end if;

  if v_clean_email is not null then
    select * into v_socio_email from public.socio s where pg_catalog.lower(s.email) = v_clean_email limit 1;
    v_has_email := found;
  end if;

  if v_has_dni and v_has_email and v_socio_dni.id_socio <> v_socio_email.id_socio then
    raise exception 'Conflicto de identidad: el DNI (%) y el email (%) pertenecen a socios diferentes.', v_clean_dni, v_clean_email;
  end if;

  if v_has_dni then
    v_socio := v_socio_dni;
  elsif v_has_email then
    v_socio := v_socio_email;
  else
    if nullif(pg_catalog.btrim(p_nombre), '') is null or nullif(pg_catalog.btrim(p_apellido), '') is null then
      raise exception 'Nombre y apellido son obligatorios para registrar un nuevo socio.';
    end if;

    insert into public.socio (auth_user_id, nombre, apellido, dni, telefono, email, estado)
    values (null, pg_catalog.btrim(p_nombre), pg_catalog.btrim(p_apellido), v_clean_dni, nullif(pg_catalog.btrim(p_telefono), ''), v_clean_email, true)
    returning * into v_socio;

    v_creado := true;
  end if;

  if p_id_membresia_gimnasio is null then
    v_assoc := public.rpc_asociar_socio_gimnasio(p_id_gimnasio, v_socio.id_socio);
    v_res := jsonb_build_object(
      'socio_gimnasio', to_jsonb(v_assoc),
      'membresia_socio', null,
      'pago', null
    );
  else
    v_res := public.rpc_contratar_membresia(
      v_socio.id_socio,
      p_id_membresia_gimnasio,
      p_fecha_inicio,
      p_estado_membresia,
      p_registrar_pago,
      p_metodo_pago,
      'aprobado',
      null,
      p_monto_override
    );
  end if;

  return jsonb_build_object(
    'creado', v_creado,
    'socio', to_jsonb(v_socio),
    'socio_gimnasio', v_res->'socio_gimnasio',
    'membresia_socio', v_res->'membresia_socio',
    'pago', v_res->'pago'
  );
end;
$$;

-- 2e. Asistencias: valida socio_gimnasio activo + membresía vigente + sucursal = empleado.id_gimnasio
create or replace function public.rpc_registrar_ingreso_asistencia(
  p_id_sucursal bigint,
  p_id_socio bigint default null
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_caller_socio_id bigint;
  v_sucursal public.sucursal%rowtype;
  v_gym_estado boolean;
  v_es_staff boolean := false;
  v_target_socio_id bigint;
  v_socio public.socio%rowtype;
  v_sg_id bigint;
  v_sg_estado boolean;
  v_tiene_membresia boolean := false;
  v_abierta_id bigint;
  v_asistencia public.asistencia_socio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar un ingreso.';
  end if;

  if p_id_sucursal is null then
    raise exception 'Debes indicar la sucursal para registrar el ingreso.';
  end if;

  select * into v_sucursal from public.sucursal where id_sucursal = p_id_sucursal;
  if not found or not v_sucursal.estado then
    raise exception 'La sucursal seleccionada no existe o se encuentra inactiva.';
  end if;

  select g.estado into v_gym_estado from public.gimnasio g where g.id_gimnasio = v_sucursal.id_gimnasio;
  if coalesce(v_gym_estado, false) = false then
    raise exception 'El gimnasio asociado a esta sucursal se encuentra inactivo.';
  end if;

  if not v_is_service then
    select s.id_socio into v_caller_socio_id from public.socio s where s.auth_user_id = v_uid limit 1;

    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_sucursal.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_sucursal.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_sucursal.id_gimnasio
          and su.id_gimnasio = v_sucursal.id_gimnasio
          and es.estado = true
          and es.id_sucursal = p_id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_es_staff;

    if v_es_staff then
      v_target_socio_id := coalesce(p_id_socio, v_caller_socio_id);
    else
      if v_caller_socio_id is null then
        raise exception 'No tienes autorización para registrar ingresos en esta sucursal.';
      end if;
      if p_id_socio is not null and p_id_socio <> v_caller_socio_id then
        raise exception 'No tienes autorización para registrar asistencias de otro socio.';
      end if;
      v_target_socio_id := v_caller_socio_id;
    end if;
  else
    v_target_socio_id := p_id_socio;
  end if;

  if v_target_socio_id is null then
    raise exception 'Debes indicar el socio para registrar la asistencia.';
  end if;

  -- Lock sobre fila de socio serializa ingresos concurrentes
  select * into v_socio from public.socio where id_socio = v_target_socio_id for update;
  if not found or not v_socio.estado then
    raise exception 'Socio no encontrado o inactivo.';
  end if;

  select a.id_asistencia_socio into v_abierta_id
  from public.asistencia_socio a
  where a.id_socio = v_target_socio_id
    and a.estado = 'presente'
    and a.hora_salida is null
  limit 1;

  if v_abierta_id is not null then
    raise exception 'Ya existe un ingreso en curso (asistencia #%). Debes registrar la salida antes de volver a ingresar.', v_abierta_id;
  end if;

  select sg.id_socio_gimnasio, sg.estado into v_sg_id, v_sg_estado
  from public.socio_gimnasio sg
  where sg.id_socio = v_target_socio_id
    and sg.id_gimnasio = v_sucursal.id_gimnasio;

  if not found or coalesce(v_sg_estado, false) = false then
    raise exception 'El socio no posee una asociación socio_gimnasio activa en el gimnasio de esta sucursal.';
  end if;

  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_sg_id
      and ms.id_gimnasio = v_sucursal.id_gimnasio
      and ms.estado = 'activa'
      and current_date between ms.fecha_inicio and ms.fecha_vencimiento
  ) into v_tiene_membresia;

  if not v_tiene_membresia then
    raise exception 'El socio no cuenta con una membresía activa y vigente en el gimnasio de esta sucursal.';
  end if;

  insert into public.asistencia_socio (id_socio, id_sucursal, hora_ingreso, estado)
  values (v_target_socio_id, v_sucursal.id_sucursal, now(), 'presente')
  returning * into v_asistencia;

  return v_asistencia;
end;
$$;

create or replace function public.rpc_registrar_salida_asistencia(
  p_id_asistencia_socio bigint default null,
  p_id_socio bigint default null
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_caller_socio_id bigint;
  v_actual public.asistencia_socio%rowtype;
  v_autorizado boolean := false;
  v_updated public.asistencia_socio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar la salida.';
  end if;

  if not v_is_service then
    select s.id_socio into v_caller_socio_id from public.socio s where s.auth_user_id = v_uid limit 1;
  end if;

  if p_id_asistencia_socio is not null then
    select * into v_actual from public.asistencia_socio where id_asistencia_socio = p_id_asistencia_socio for update;
  else
    if not v_is_service and p_id_socio is null and v_caller_socio_id is null then
      raise exception 'Debes indicar la asistencia o el socio para registrar la salida.';
    end if;

    select a.* into v_actual
    from public.asistencia_socio a
    where a.id_socio = coalesce(p_id_socio, v_caller_socio_id)
      and a.estado = 'presente'
      and a.hora_salida is null
    order by a.hora_ingreso desc
    limit 1
    for update;
  end if;

  if not found then
    raise exception 'No se encontró una asistencia abierta o no tienes permisos para cerrarla.';
  end if;

  if not v_is_service then
    select (
      (v_caller_socio_id is not null and v_actual.id_socio = v_caller_socio_id)
      or exists (
        select 1 from public.sucursal su join public.gimnasio g on g.id_gimnasio = su.id_gimnasio join public.dueno d on d.id_dueno = g.id_dueno
        where su.id_sucursal = v_actual.id_sucursal and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.sucursal su join public.administrador_gimnasio ag on ag.id_gimnasio = su.id_gimnasio join public.administrador a on a.id_administrador = ag.id_administrador
        where su.id_sucursal = v_actual.id_sucursal and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = su.id_gimnasio
          and es.estado = true
          and es.id_sucursal = v_actual.id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para registrar la salida de esta asistencia.';
    end if;
  end if;

  if v_actual.estado <> 'presente' or v_actual.hora_salida is not null then
    raise exception 'Transición inválida: la asistencia #% tiene estado "%" y no está abierta.', v_actual.id_asistencia_socio, v_actual.estado;
  end if;

  update public.asistencia_socio
  set hora_salida = greatest(now(), hora_ingreso),
      estado = 'finalizada'
  where id_asistencia_socio = v_actual.id_asistencia_socio
  returning * into v_updated;

  return v_updated;
end;
$$;

drop function if exists public.rpc_anular_asistencia(bigint);
drop function if exists public.rpc_anular_asistencia(bigint, text);

create or replace function public.rpc_anular_asistencia(
  p_id_asistencia_socio bigint,
  p_motivo text default null
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_actual public.asistencia_socio%rowtype;
  v_autorizado boolean := false;
  v_updated public.asistencia_socio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para anular asistencias.';
  end if;

  if p_id_asistencia_socio is null then
    raise exception 'Debes indicar la asistencia a anular.';
  end if;

  select * into v_actual from public.asistencia_socio where id_asistencia_socio = p_id_asistencia_socio for update;
  if not found then
    raise exception 'La asistencia #% no existe.', p_id_asistencia_socio;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.sucursal su join public.gimnasio g on g.id_gimnasio = su.id_gimnasio join public.dueno d on d.id_dueno = g.id_dueno
        where su.id_sucursal = v_actual.id_sucursal and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.sucursal su join public.administrador_gimnasio ag on ag.id_gimnasio = su.id_gimnasio join public.administrador a on a.id_administrador = ag.id_administrador
        where su.id_sucursal = v_actual.id_sucursal and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = su.id_gimnasio
          and es.estado = true
          and es.id_sucursal = v_actual.id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para anular asistencias en esta sucursal.';
    end if;
  end if;

  if v_actual.estado = 'anulada' then
    raise exception 'La asistencia #% ya fue anulada previamente.', v_actual.id_asistencia_socio;
  end if;

  update public.asistencia_socio
  set estado = 'anulada',
      anulada_por = v_uid,
      anulada_en = now(),
      motivo_anulacion = nullif(pg_catalog.btrim(p_motivo), '')
  where id_asistencia_socio = v_actual.id_asistencia_socio
  returning * into v_updated;

  return v_updated;
end;
$$;

-- 2f. RPCs de rutinas asignadas y reordenamiento
--     Regla: id_empleado_responsable solo se registra si ESE empleado es quien
--     justificó la autorización operativa; dueño/admin org dejan NULL si no son
--     además entrenador/admin en sucursal del gimnasio.
create or replace function public.rpc_asignar_rutina_gimnasio_socio(
  p_id_rutina_gimnasio bigint,
  p_id_socio_gimnasio bigint,
  p_fecha_finalizacion date default null,
  p_observaciones text default null
)
returns public.rutinas_asignadas_socio_gimnasio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_rutina public.rutina_gimnasio%rowtype;
  v_assoc public.socio_gimnasio%rowtype;
  v_es_dueno_o_admin_org boolean := false;
  v_emp_autorizante_id bigint := null;
  v_asignacion public.rutinas_asignadas_socio_gimnasio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para asignar rutinas.';
  end if;

  if p_id_rutina_gimnasio is null or p_id_socio_gimnasio is null then
    raise exception 'Debes indicar la rutina de gimnasio y la asociación socio_gimnasio.';
  end if;

  -- Serializar asignaciones concurrentes para el mismo par (rutina, socio_gimnasio)
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('asignar_rutina:' || p_id_rutina_gimnasio::text),
    pg_catalog.hashtext(p_id_socio_gimnasio::text)
  );

  select * into v_rutina from public.rutina_gimnasio where id_rutina_gimnasio = p_id_rutina_gimnasio for share;
  if not found or not v_rutina.estado then
    raise exception 'La rutina de gimnasio (%) no existe o está inactiva.', p_id_rutina_gimnasio;
  end if;

  select * into v_assoc from public.socio_gimnasio where id_socio_gimnasio = p_id_socio_gimnasio for share;
  if not found or not v_assoc.estado then
    raise exception 'La asociación socio_gimnasio (%) no existe o está inactiva.', p_id_socio_gimnasio;
  end if;

  if v_rutina.id_gimnasio <> v_assoc.id_gimnasio then
    raise exception 'No se puede asignar una rutina del gimnasio % a un socio asociado al gimnasio %.', v_rutina.id_gimnasio, v_assoc.id_gimnasio;
  end if;

  if p_fecha_finalizacion is not null and p_fecha_finalizacion < current_date then
    raise exception 'La fecha de finalización no puede ser anterior a la fecha de asignación.';
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_rutina.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_rutina.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
    ) into v_es_dueno_o_admin_org;

    select e.id_empleado into v_emp_autorizante_id
    from public.empleado e
    join public.empleado_sucursal es on es.id_empleado = e.id_empleado
    join public.sucursal su on su.id_sucursal = es.id_sucursal
    where e.auth_user_id = v_uid
      and e.estado = true
      and e.id_gimnasio = v_rutina.id_gimnasio
      and su.id_gimnasio = v_rutina.id_gimnasio
      and es.estado = true
      and pg_catalog.lower(es.rol) in ('administrador', 'entrenador')
    limit 1;

    if not coalesce(v_es_dueno_o_admin_org, false) and v_emp_autorizante_id is null then
      raise exception 'No tienes autorización para asignar rutinas del gimnasio (recepcionistas y terceros no autorizados).';
    end if;
  end if;

  if exists (
    select 1
    from public.rutinas_asignadas_socio_gimnasio ra
    where ra.id_rutina_gimnasio = v_rutina.id_rutina_gimnasio
      and ra.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ra.estado = true
  ) then
    raise exception 'La rutina ya se encuentra asignada activamente a esta asociación socio-gimnasio.';
  end if;

  insert into public.rutinas_asignadas_socio_gimnasio (
    id_rutina_gimnasio, id_socio_gimnasio, id_gimnasio, id_empleado_responsable,
    fecha_asignacion, fecha_finalizacion, estado, observaciones
  )
  values (
    v_rutina.id_rutina_gimnasio, v_assoc.id_socio_gimnasio, v_rutina.id_gimnasio, v_emp_autorizante_id,
    current_date, p_fecha_finalizacion, true, nullif(pg_catalog.btrim(p_observaciones), '')
  )
  returning * into v_asignacion;

  return v_asignacion;
end;
$$;

create or replace function public.rpc_finalizar_rutina_asignada(
  p_id_rutina_asignada bigint,
  p_fecha_finalizacion date default current_date,
  p_observaciones text default null
)
returns public.rutinas_asignadas_socio_gimnasio
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_service boolean := public.fn_es_service_role();
  v_asig public.rutinas_asignadas_socio_gimnasio%rowtype;
  v_autorizado boolean := false;
  v_updated public.rutinas_asignadas_socio_gimnasio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para finalizar o modificar una asignación.';
  end if;

  select * into v_asig
  from public.rutinas_asignadas_socio_gimnasio
  where id_rutina_asignada = p_id_rutina_asignada
  for update;

  if not found then
    raise exception 'La asignación #% no existe.', p_id_rutina_asignada;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_asig.id_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.administrador_gimnasio ag join public.administrador a on a.id_administrador = ag.id_administrador
        where ag.id_gimnasio = v_asig.id_gimnasio and ag.estado = true and a.estado = true and a.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and e.id_gimnasio = v_asig.id_gimnasio
          and su.id_gimnasio = v_asig.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'entrenador')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para cerrar asignaciones de rutina en este gimnasio.';
    end if;
  end if;

  update public.rutinas_asignadas_socio_gimnasio
  set estado = false,
      fecha_finalizacion = greatest(coalesce(p_fecha_finalizacion, current_date), fecha_asignacion),
      observaciones = coalesce(nullif(pg_catalog.btrim(p_observaciones), ''), observaciones)
  where id_rutina_asignada = v_asig.id_rutina_asignada
  returning * into v_updated;

  return v_updated;
end;
$$;

create or replace function public.rpc_reordenar_rutina_socio_ejercicios(
  p_id_rutina_socio bigint,
  p_ids_ordenados bigint[]
)
returns setof public.rutina_ejercicio_socio
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_total integer;
  v_distintos integer;
  v_idx integer;
  v_item_id bigint;
begin
  if p_id_rutina_socio is null or p_ids_ordenados is null or pg_catalog.array_length(p_ids_ordenados, 1) is null then
    raise exception 'Debes indicar rutina y lista ordenada.';
  end if;

  select count(distinct x) into v_distintos from pg_catalog.unnest(p_ids_ordenados) as x;
  if v_distintos <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'Existen identificadores duplicados en el ordenamiento.';
  end if;

  if not exists (
    select 1 from public.rutina_socio r
    where r.id_rutina_socio = p_id_rutina_socio
      and r.id_socio = public.fn_current_socio_id()
  ) then
    raise exception 'Rutina #% no encontrada o sin permisos.', p_id_rutina_socio;
  end if;

  select count(*) into v_total from public.rutina_ejercicio_socio where id_rutina_socio = p_id_rutina_socio;
  if v_total <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'Cantidad de ejercicios distinta al total de la rutina.';
  end if;

  update public.rutina_ejercicio_socio set orden = orden + 100000 where id_rutina_socio = p_id_rutina_socio;

  v_idx := 1;
  foreach v_item_id in array p_ids_ordenados loop
    update public.rutina_ejercicio_socio set orden = v_idx
    where id_rutina_socio = p_id_rutina_socio and id_rutina_ejercicio_socio = v_item_id;
    if not found then
      raise exception 'El registro #% no pertenece a la rutina #%.', v_item_id, p_id_rutina_socio;
    end if;
    v_idx := v_idx + 1;
  end loop;

  return query
  select * from public.rutina_ejercicio_socio where id_rutina_socio = p_id_rutina_socio order by orden asc;
end;
$$;

create or replace function public.rpc_reordenar_rutina_gimnasio_ejercicios(
  p_id_rutina_gimnasio bigint,
  p_ids_ordenados bigint[]
)
returns setof public.rutina_ejercicio_gimnasio
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_total integer;
  v_distintos integer;
  v_idx integer;
  v_item_id bigint;
  v_gym_id bigint;
begin
  if p_id_rutina_gimnasio is null or p_ids_ordenados is null or pg_catalog.array_length(p_ids_ordenados, 1) is null then
    raise exception 'Debes indicar rutina de gimnasio y lista ordenada.';
  end if;

  select count(distinct x) into v_distintos from pg_catalog.unnest(p_ids_ordenados) as x;
  if v_distintos <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'Existen identificadores duplicados en el ordenamiento.';
  end if;

  select r.id_gimnasio into v_gym_id
  from public.rutina_gimnasio r
  where r.id_rutina_gimnasio = p_id_rutina_gimnasio
    and (
      public.fn_dueno_posee_gimnasio(r.id_gimnasio)
      or public.fn_admin_posee_gimnasio(r.id_gimnasio)
      or public.fn_empleado_en_gimnasio(r.id_gimnasio, array['administrador', 'entrenador'])
    );

  if not found then
    raise exception 'Rutina de gimnasio #% no encontrada o sin permisos de edición.', p_id_rutina_gimnasio;
  end if;

  select count(*) into v_total from public.rutina_ejercicio_gimnasio where id_rutina_gimnasio = p_id_rutina_gimnasio;
  if v_total <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'Cantidad de ejercicios distinta al total de la rutina.';
  end if;

  update public.rutina_ejercicio_gimnasio set orden = orden + 100000 where id_rutina_gimnasio = p_id_rutina_gimnasio;

  v_idx := 1;
  foreach v_item_id in array p_ids_ordenados loop
    update public.rutina_ejercicio_gimnasio set orden = v_idx
    where id_rutina_gimnasio = p_id_rutina_gimnasio and id_rutina_ejercicio_gimnasio = v_item_id;
    if not found then
      raise exception 'El registro #% no pertenece a la rutina de gimnasio #%.', v_item_id, p_id_rutina_gimnasio;
    end if;
    v_idx := v_idx + 1;
  end loop;

  return query
  select * from public.rutina_ejercicio_gimnasio where id_rutina_gimnasio = p_id_rutina_gimnasio order by orden asc;
end;
$$;

-- 2g. Vinculación verificada de cuenta Supabase Auth existente (soporta múltiples roles por identidad)
create or replace function public.rpc_vincular_identidad_perfil(
  p_perfil_tipo varchar
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_confirmed_at timestamptz;
  v_tipo varchar := pg_catalog.lower(pg_catalog.btrim(coalesce(p_perfil_tipo, '')));
  v_cnt integer;
  v_target_id bigint;
  v_existing_auth uuid;
  v_ya_tiene_perfil bigint;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para vincular un perfil.';
  end if;

  if v_tipo not in ('socio', 'administrador', 'empleado', 'dueno') then
    raise exception 'Tipo de perfil inválido: %', p_perfil_tipo;
  end if;

  select u.email, u.email_confirmed_at
  into v_auth_email, v_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if not found or v_confirmed_at is null or v_auth_email is null then
    raise exception 'La identidad Supabase Auth debe existir y tener el correo electrónico verificado antes de vincular perfiles.';
  end if;

  -- Serializar vinculaciones concurrentes por email + tipo de perfil
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_tipo),
    pg_catalog.hashtext(pg_catalog.lower(pg_catalog.btrim(v_auth_email)))
  );

  if v_tipo = 'socio' then
    select id_socio into v_ya_tiene_perfil from public.socio where auth_user_id = v_uid limit 1;
    if found then
      return jsonb_build_object('vinculado', true, 'ya_estaba_vinculado', true, 'perfil_tipo', v_tipo, 'id', v_ya_tiene_perfil);
    end if;

    select count(*) into v_cnt from public.socio where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email));
    if v_cnt > 1 then
      raise exception 'Existen múltiples perfiles socio con el correo %. Resuelve la duplicidad antes de vincular.', v_auth_email;
    elsif v_cnt = 0 then
      raise exception 'No existe un perfil socio con este correo verificado.';
    end if;

    select id_socio, auth_user_id into v_target_id, v_existing_auth
    from public.socio
    where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
    for update;

    if v_existing_auth is not null and v_existing_auth <> v_uid then
      raise exception 'El perfil socio ya está vinculado a otra cuenta de autenticación.';
    end if;

    update public.socio set auth_user_id = v_uid where id_socio = v_target_id;

  elsif v_tipo = 'administrador' then
    select id_administrador into v_ya_tiene_perfil from public.administrador where auth_user_id = v_uid limit 1;
    if found then
      return jsonb_build_object('vinculado', true, 'ya_estaba_vinculado', true, 'perfil_tipo', v_tipo, 'id', v_ya_tiene_perfil);
    end if;

    select count(*) into v_cnt from public.administrador where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email));
    if v_cnt > 1 then
      raise exception 'Existen múltiples perfiles administrador con el correo %.', v_auth_email;
    elsif v_cnt = 0 then
      raise exception 'No existe un perfil administrador con este correo verificado.';
    end if;

    select id_administrador, auth_user_id into v_target_id, v_existing_auth
    from public.administrador
    where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
    for update;

    if v_existing_auth is not null and v_existing_auth <> v_uid then
      raise exception 'El perfil administrador ya está vinculado a otra cuenta de autenticación.';
    end if;

    update public.administrador set auth_user_id = v_uid where id_administrador = v_target_id;

  elsif v_tipo = 'empleado' then
    select id_empleado into v_ya_tiene_perfil from public.empleado where auth_user_id = v_uid limit 1;
    if found then
      return jsonb_build_object('vinculado', true, 'ya_estaba_vinculado', true, 'perfil_tipo', v_tipo, 'id', v_ya_tiene_perfil);
    end if;

    select count(*) into v_cnt from public.empleado where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email));
    if v_cnt > 1 then
      raise exception 'Existen múltiples perfiles empleado con el correo %.', v_auth_email;
    elsif v_cnt = 0 then
      raise exception 'No existe un perfil empleado con este correo verificado.';
    end if;

    select id_empleado, auth_user_id into v_target_id, v_existing_auth
    from public.empleado
    where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
    for update;

    if v_existing_auth is not null and v_existing_auth <> v_uid then
      raise exception 'El perfil empleado ya está vinculado a otra cuenta de autenticación.';
    end if;

    update public.empleado set auth_user_id = v_uid where id_empleado = v_target_id;

  elsif v_tipo = 'dueno' then
    select id_dueno into v_ya_tiene_perfil from public.dueno where auth_user_id = v_uid limit 1;
    if found then
      return jsonb_build_object('vinculado', true, 'ya_estaba_vinculado', true, 'perfil_tipo', v_tipo, 'id', v_ya_tiene_perfil);
    end if;

    select count(*) into v_cnt from public.dueno where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email));
    if v_cnt > 1 then
      raise exception 'Existen múltiples perfiles dueno con el correo %.', v_auth_email;
    elsif v_cnt = 0 then
      raise exception 'No existe un perfil dueño con este correo verificado.';
    end if;

    select id_dueno, auth_user_id into v_target_id, v_existing_auth
    from public.dueno
    where pg_catalog.lower(pg_catalog.btrim(email)) = pg_catalog.lower(pg_catalog.btrim(v_auth_email))
    for update;

    if v_existing_auth is not null and v_existing_auth <> v_uid then
      raise exception 'El perfil dueño ya está vinculado a otra cuenta de autenticación.';
    end if;

    update public.dueno set auth_user_id = v_uid where id_dueno = v_target_id;
  end if;

  return jsonb_build_object('vinculado', true, 'ya_estaba_vinculado', false, 'perfil_tipo', v_tipo, 'id', v_target_id);
end;
$$;

-- ============================================================================
-- 3. PRIVILEGIOS MÍNIMOS POR TABLA / COLUMNA Y VISTAS DE CATÁLOGO
-- ============================================================================
revoke all on
  public.dueno,
  public.gimnasio,
  public.sucursal,
  public.administrador,
  public.administrador_gimnasio,
  public.empleado,
  public.empleado_sucursal,
  public.socio,
  public.socio_gimnasio,
  public.membresia_gimnasio,
  public.membresia_socio,
  public.pago,
  public.asistencia_socio,
  public.ejercicio_socio,
  public.ejercicio_gimnasio,
  public.rutina_socio,
  public.rutina_gimnasio,
  public.rutina_ejercicio_socio,
  public.rutina_ejercicio_gimnasio,
  public.rutinas_asignadas_socio_gimnasio
from public, anon, authenticated;

-- Privilegios por columna sobre tablas con identidad/estado sensible
grant select, insert on public.dueno to authenticated;
grant update (nombre, apellido, email) on public.dueno to authenticated;

grant select, insert on public.socio to authenticated;
grant update (nombre, apellido, dni, telefono, email, estado) on public.socio to authenticated;

grant select, insert, delete on public.gimnasio to authenticated;
grant update (nombre, telefono, email, estado) on public.gimnasio to authenticated;

grant select, insert, update, delete on public.sucursal to authenticated;

grant select, insert on public.administrador to authenticated;
grant update (nombre, apellido, dni, telefono, email, estado) on public.administrador to authenticated;

grant select, insert, delete on public.administrador_gimnasio to authenticated;
grant update (estado) on public.administrador_gimnasio to authenticated;

grant select, insert, delete on public.empleado to authenticated;
grant update (nombre, apellido, dni, telefono, email, estado) on public.empleado to authenticated;
grant select, insert, update, delete on public.empleado_sucursal to authenticated;
grant select, insert, update, delete on public.membresia_gimnasio to authenticated;

-- Tablas canalizadas estrictamente vía RPC para escrituras sensibles:
grant select on public.socio_gimnasio to authenticated;
grant select on public.membresia_socio to authenticated;
grant select on public.pago to authenticated;
grant select on public.asistencia_socio to authenticated;
grant select on public.rutinas_asignadas_socio_gimnasio to authenticated;

grant select, insert, update, delete on
  public.ejercicio_socio,
  public.ejercicio_gimnasio,
  public.rutina_socio,
  public.rutina_gimnasio,
  public.rutina_ejercicio_socio,
  public.rutina_ejercicio_gimnasio
to authenticated;

grant all on
  public.dueno,
  public.gimnasio,
  public.sucursal,
  public.administrador,
  public.administrador_gimnasio,
  public.empleado,
  public.empleado_sucursal,
  public.socio,
  public.socio_gimnasio,
  public.membresia_gimnasio,
  public.membresia_socio,
  public.pago,
  public.asistencia_socio,
  public.ejercicio_socio,
  public.ejercicio_gimnasio,
  public.rutina_socio,
  public.rutina_gimnasio,
  public.rutina_ejercicio_socio,
  public.rutina_ejercicio_gimnasio,
  public.rutinas_asignadas_socio_gimnasio
to service_role;

revoke all on all sequences in schema public from public, anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

do $$
declare
  v_rec record;
  v_seq text;
begin
  for v_rec in
    select * from (values
      ('public.dueno', 'id_dueno'),
      ('public.gimnasio', 'id_gimnasio'),
      ('public.sucursal', 'id_sucursal'),
      ('public.administrador', 'id_administrador'),
      ('public.administrador_gimnasio', 'id_administrador_gimnasio'),
      ('public.empleado', 'id_empleado'),
      ('public.empleado_sucursal', 'id_empleado_sucursal'),
      ('public.socio', 'id_socio'),
      ('public.membresia_gimnasio', 'id_membresia_gimnasio'),
      ('public.ejercicio_socio', 'id_ejercicio_socio'),
      ('public.ejercicio_gimnasio', 'id_ejercicio_gimnasio'),
      ('public.rutina_socio', 'id_rutina_socio'),
      ('public.rutina_gimnasio', 'id_rutina_gimnasio'),
      ('public.rutina_ejercicio_socio', 'id_rutina_ejercicio_socio'),
      ('public.rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio'),
      ('public.progreso', 'id_progreso')
    ) as t(tbl, col)
  loop
    if to_regclass(v_rec.tbl) is not null then
      v_seq := pg_catalog.pg_get_serial_sequence(v_rec.tbl, v_rec.col);
      if v_seq is not null then
        execute format('grant usage, select on sequence %s to authenticated', v_seq);
      end if;
    end if;
  end loop;
end $$;

-- Vistas de catálogo controlado (security_barrier + security_invoker = false para leer catálogo sin abrir tablas privadas)
create or replace view public.vw_catalogo_gimnasios
with (security_barrier = true, security_invoker = false) as
  select
    g.id_gimnasio,
    g.nombre,
    g.telefono,
    g.estado
  from public.gimnasio g
  where g.estado = true;

create or replace view public.vw_catalogo_planes
with (security_barrier = true, security_invoker = false) as
  select
    p.id_membresia_gimnasio,
    p.id_gimnasio,
    p.nombre,
    p.descripcion,
    p.precio,
    p.duracion_dias,
    p.limite_asistencias_semanales,
    p.limite_asistencias_totales,
    p.estado
  from public.membresia_gimnasio p
  join public.gimnasio g on g.id_gimnasio = p.id_gimnasio
  where p.estado = true
    and g.estado = true;

revoke all on public.vw_catalogo_gimnasios, public.vw_catalogo_planes from public, anon;
grant select on public.vw_catalogo_gimnasios, public.vw_catalogo_planes to authenticated, service_role;

-- Tablas legacy (Escenario B): congelar escrituras y reemplazar políticas obsoletas de forma segura
do $$
begin
  if to_regclass('public.ejercicio') is not null then
    execute 'revoke all on public.ejercicio from public, anon, authenticated';
    execute 'grant select on public.ejercicio to authenticated';
    execute 'grant all on public.ejercicio to service_role';
    execute 'drop policy if exists ejercicio_insert_authorized on public.ejercicio';
    execute 'drop policy if exists ejercicio_update_authorized on public.ejercicio';
    execute 'drop policy if exists ejercicio_delete_authorized on public.ejercicio';
    execute 'drop policy if exists ejercicio_select_authorized on public.ejercicio';
    execute $pol$
      create policy ejercicio_select_authorized on public.ejercicio
        for select to authenticated
        using (
          (id_socio is not null and id_socio = public.fn_current_socio_id())
          or (
            id_gimnasio is not null and (
              public.fn_dueno_posee_gimnasio(id_gimnasio)
              or public.fn_admin_posee_gimnasio(id_gimnasio)
              or public.fn_empleado_en_gimnasio(id_gimnasio, null)
              or public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida'])
            )
          )
        )
    $pol$;
  end if;

  if to_regclass('public.rutina') is not null then
    execute 'revoke all on public.rutina from public, anon, authenticated';
    execute 'grant select on public.rutina to authenticated';
    execute 'grant all on public.rutina to service_role';
    execute 'drop policy if exists rutina_insert_authorized on public.rutina';
    execute 'drop policy if exists rutina_update_authorized on public.rutina';
    execute 'drop policy if exists rutina_delete_authorized on public.rutina';
    execute 'drop policy if exists rutina_select_authorized on public.rutina';
    execute $pol$
      create policy rutina_select_authorized on public.rutina
        for select to authenticated
        using (
          id_socio = public.fn_current_socio_id()
          or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
        )
    $pol$;
  end if;

  if to_regclass('public.rutina_ejercicio') is not null then
    execute 'revoke all on public.rutina_ejercicio from public, anon, authenticated';
    execute 'grant select on public.rutina_ejercicio to authenticated';
    execute 'grant all on public.rutina_ejercicio to service_role';
    execute 'drop policy if exists rutina_ejercicio_all_authorized on public.rutina_ejercicio';
    execute 'drop policy if exists rutina_ejercicio_insert_authorized on public.rutina_ejercicio';
    execute 'drop policy if exists rutina_ejercicio_update_authorized on public.rutina_ejercicio';
    execute 'drop policy if exists rutina_ejercicio_delete_authorized on public.rutina_ejercicio';
    execute 'drop policy if exists rutina_ejercicio_select_authorized on public.rutina_ejercicio';
    execute $pol$
      create policy rutina_ejercicio_select_authorized on public.rutina_ejercicio
        for select to authenticated
        using (
          exists (
            select 1 from public.rutina r
            where r.id_rutina = rutina_ejercicio.id_rutina
              and (
                r.id_socio = public.fn_current_socio_id()
                or public.fn_staff_puede_gestionar_rutinas_socio(r.id_socio)
              )
          )
        )
    $pol$;
  end if;
end $$;

-- ============================================================================
-- 4. POLÍTICAS RLS DEFINITIVAS
-- ============================================================================

-- 4.0. public.dueno y public.socio
drop policy if exists dueno_select_self on public.dueno;
create policy dueno_select_self on public.dueno
  for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists dueno_insert_self on public.dueno;
create policy dueno_insert_self on public.dueno
  for insert to authenticated with check (auth_user_id = auth.uid());

drop policy if exists dueno_update_self on public.dueno;
create policy dueno_update_self on public.dueno
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists socio_select_authorized on public.socio;
create policy socio_select_authorized on public.socio
  for select to authenticated
  using (auth_user_id = auth.uid() or public.fn_staff_puede_ver_socio(id_socio));

drop policy if exists socio_insert_authorized on public.socio;
create policy socio_insert_authorized on public.socio
  for insert to authenticated
  with check (auth_user_id = auth.uid() and estado = true and fecha_alta = current_date);

drop policy if exists socio_update_authorized on public.socio;
create policy socio_update_authorized on public.socio
  for update to authenticated
  using (auth_user_id = auth.uid() or public.fn_staff_puede_gestionar_socio(id_socio))
  with check (auth_user_id = auth.uid() or public.fn_staff_puede_gestionar_socio(id_socio));

-- 4a. public.gimnasio y public.sucursal
drop policy if exists gimnasio_select_authorized on public.gimnasio;
create policy gimnasio_select_authorized on public.gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, null)
    or public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida', 'cancelada'])
  );

drop policy if exists gimnasio_insert_dueno on public.gimnasio;
create policy gimnasio_insert_dueno on public.gimnasio
  for insert to authenticated with check (id_dueno = public.fn_current_dueno_id());

drop policy if exists gimnasio_update_dueno on public.gimnasio;
create policy gimnasio_update_dueno on public.gimnasio
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio))
  with check (id_dueno = public.fn_current_dueno_id());

drop policy if exists gimnasio_delete_dueno on public.gimnasio;
create policy gimnasio_delete_dueno on public.gimnasio
  for delete to authenticated using (public.fn_dueno_posee_gimnasio(id_gimnasio));

drop policy if exists sucursal_select_authorized on public.sucursal;
create policy sucursal_select_authorized on public.sucursal
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_sucursal(id_sucursal, null)
    or (estado = true and public.fn_socio_asociado_gimnasio(id_gimnasio, true))
    or exists (
      select 1 from public.asistencia_socio a
      where a.id_sucursal = sucursal.id_sucursal
        and a.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists sucursal_write_dueno_o_admin on public.sucursal;
drop policy if exists sucursal_insert_dueno on public.sucursal;
create policy sucursal_insert_dueno on public.sucursal
  for insert to authenticated
  with check (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio));

drop policy if exists sucursal_update_dueno on public.sucursal;
create policy sucursal_update_dueno on public.sucursal
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio))
  with check (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio));

drop policy if exists sucursal_delete_dueno on public.sucursal;
create policy sucursal_delete_dueno on public.sucursal
  for delete to authenticated using (public.fn_dueno_posee_gimnasio(id_gimnasio));

-- 4b. public.administrador y public.administrador_gimnasio
drop policy if exists admin_select_authorized on public.administrador;
create policy admin_select_authorized on public.administrador
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or exists (
      select 1
      from public.administrador_gimnasio ag
      where ag.id_administrador = administrador.id_administrador
        and public.fn_dueno_posee_gimnasio(ag.id_gimnasio)
    )
  );

drop policy if exists admin_insert_dueno on public.administrador;
create policy admin_insert_dueno on public.administrador
  for insert to authenticated
  with check (public.fn_current_dueno_id() is not null and auth_user_id is null);

drop policy if exists admin_update_authorized on public.administrador;
create policy admin_update_authorized on public.administrador
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or exists (
      select 1 from public.administrador_gimnasio ag
      where ag.id_administrador = administrador.id_administrador
        and public.fn_dueno_posee_gimnasio(ag.id_gimnasio)
    )
  )
  with check (
    auth_user_id = auth.uid()
    or exists (
      select 1 from public.administrador_gimnasio ag
      where ag.id_administrador = administrador.id_administrador
        and public.fn_dueno_posee_gimnasio(ag.id_gimnasio)
    )
  );

drop policy if exists admin_gym_select_authorized on public.administrador_gimnasio;
create policy admin_gym_select_authorized on public.administrador_gimnasio
  for select to authenticated
  using (
    id_administrador = public.fn_current_administrador_id()
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
  );

drop policy if exists admin_gym_write_dueno on public.administrador_gimnasio;
create policy admin_gym_write_dueno on public.administrador_gimnasio
  for all to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio))
  with check (public.fn_dueno_posee_gimnasio(id_gimnasio));

-- 4c. public.empleado y public.empleado_sucursal
drop policy if exists empleado_select_authorized on public.empleado;
create policy empleado_select_authorized on public.empleado
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  );

drop policy if exists empleado_insert_dueno on public.empleado;
create policy empleado_insert_dueno on public.empleado
  for insert to authenticated
  with check (
    id_gimnasio is not null
    and (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio))
  );

drop policy if exists empleado_update_dueno on public.empleado;
create policy empleado_update_dueno on public.empleado
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio))
  with check (
    id_gimnasio is not null
    and (public.fn_dueno_posee_gimnasio(id_gimnasio) or public.fn_admin_posee_gimnasio(id_gimnasio))
  );

drop policy if exists empleado_delete_dueno on public.empleado;
create policy empleado_delete_dueno on public.empleado
  for delete to authenticated using (public.fn_dueno_posee_gimnasio(id_gimnasio));

drop policy if exists empleado_sucursal_select_authorized on public.empleado_sucursal;
create policy empleado_sucursal_select_authorized on public.empleado_sucursal
  for select to authenticated
  using (
    id_empleado = public.fn_current_empleado_id()
    or exists (
      select 1
      from public.sucursal s
      join public.empleado e on e.id_empleado = empleado_sucursal.id_empleado
      where s.id_sucursal = empleado_sucursal.id_sucursal
        and e.id_gimnasio = s.id_gimnasio
        and (
          public.fn_dueno_posee_gimnasio(s.id_gimnasio)
          or public.fn_admin_posee_gimnasio(s.id_gimnasio)
          or public.fn_empleado_en_gimnasio(s.id_gimnasio, array['administrador'])
        )
    )
  );

drop policy if exists empleado_sucursal_write_dueno on public.empleado_sucursal;
create policy empleado_sucursal_write_dueno on public.empleado_sucursal
  for all to authenticated
  using (
    exists (
      select 1
      from public.sucursal s
      join public.empleado e on e.id_empleado = empleado_sucursal.id_empleado
      where s.id_sucursal = empleado_sucursal.id_sucursal
        and e.id_gimnasio is not null
        and e.id_gimnasio = s.id_gimnasio
        and (public.fn_dueno_posee_gimnasio(s.id_gimnasio) or public.fn_admin_posee_gimnasio(s.id_gimnasio))
    )
  )
  with check (
    exists (
      select 1
      from public.sucursal s
      join public.empleado e on e.id_empleado = empleado_sucursal.id_empleado
      where s.id_sucursal = empleado_sucursal.id_sucursal
        and e.id_gimnasio is not null
        and e.id_gimnasio = s.id_gimnasio
        and (public.fn_dueno_posee_gimnasio(s.id_gimnasio) or public.fn_admin_posee_gimnasio(s.id_gimnasio))
    )
  );

-- 4d. public.socio_gimnasio (SOLO SELECT; escrituras vía RPC),
--     public.membresia_gimnasio, public.membresia_socio (SOLO SELECT),
--     public.pago (SOLO SELECT), public.asistencia_socio (SOLO SELECT)
drop policy if exists socio_gimnasio_insert_authorized on public.socio_gimnasio;
drop policy if exists socio_gimnasio_update_authorized on public.socio_gimnasio;
drop policy if exists socio_gimnasio_select_authorized on public.socio_gimnasio;
create policy socio_gimnasio_select_authorized on public.socio_gimnasio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

drop policy if exists plan_select_authorized on public.membresia_gimnasio;
create policy plan_select_authorized on public.membresia_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, null)
    or (estado = true and public.fn_socio_asociado_gimnasio(id_gimnasio, true))
    or exists (
      select 1
      from public.membresia_socio ms
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ms.id_socio_gimnasio
      where ms.id_membresia_gimnasio = membresia_gimnasio.id_membresia_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists plan_write_dueno_o_admin on public.membresia_gimnasio;
create policy plan_write_dueno_o_admin on public.membresia_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  );

drop policy if exists membresia_socio_insert_authorized on public.membresia_socio;
drop policy if exists membresia_socio_update_authorized on public.membresia_socio;
drop policy if exists membresia_socio_delete_dueno on public.membresia_socio;
drop policy if exists membresia_socio_select_authorized on public.membresia_socio;
create policy membresia_socio_select_authorized on public.membresia_socio
  for select to authenticated
  using (
    exists (
      select 1 from public.socio_gimnasio sg
      where sg.id_socio_gimnasio = membresia_socio.id_socio_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

drop policy if exists pago_insert_authorized on public.pago;
drop policy if exists pago_update_authorized on public.pago;
drop policy if exists pago_select_authorized on public.pago;
create policy pago_select_authorized on public.pago
  for select to authenticated
  using (
    exists (
      select 1
      from public.membresia_socio ms
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ms.id_socio_gimnasio
      where ms.id_membresia_socio = pago.id_membresia_socio
        and (
          sg.id_socio = public.fn_current_socio_id()
          or public.fn_dueno_posee_gimnasio(ms.id_gimnasio)
          or public.fn_admin_posee_gimnasio(ms.id_gimnasio)
          or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'recepcionista'])
        )
    )
  );

drop policy if exists asistencia_insert_authorized on public.asistencia_socio;
drop policy if exists asistencia_update_authorized on public.asistencia_socio;
drop policy if exists asistencia_delete_authorized on public.asistencia_socio;
drop policy if exists asistencia_select_authorized on public.asistencia_socio;
create policy asistencia_select_authorized on public.asistencia_socio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_dueno_posee_sucursal(id_sucursal)
    or public.fn_admin_posee_sucursal(id_sucursal)
    or public.fn_empleado_en_sucursal(id_sucursal, array['administrador', 'recepcionista', 'entrenador'])
  );

-- 4e. Ejercicios separados
drop policy if exists ejercicio_socio_select_own on public.ejercicio_socio;
create policy ejercicio_socio_select_own on public.ejercicio_socio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  );

drop policy if exists ejercicio_socio_write_own on public.ejercicio_socio;
create policy ejercicio_socio_write_own on public.ejercicio_socio
  for all to authenticated
  using (id_socio = public.fn_current_socio_id())
  with check (id_socio = public.fn_current_socio_id());

drop policy if exists ejercicio_gimnasio_select_authorized on public.ejercicio_gimnasio;
create policy ejercicio_gimnasio_select_authorized on public.ejercicio_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, null)
    or (estado = true and public.fn_socio_asociado_gimnasio(id_gimnasio, true))
  );

drop policy if exists ejercicio_gimnasio_write_authorized on public.ejercicio_gimnasio;
create policy ejercicio_gimnasio_write_authorized on public.ejercicio_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  );

-- 4f. Rutinas separadas y asignaciones (escrituras en rutinas_asignadas solo vía RPC)
drop policy if exists rutina_socio_select_own on public.rutina_socio;
create policy rutina_socio_select_own on public.rutina_socio
  for select to authenticated
  using (id_socio = public.fn_current_socio_id());

drop policy if exists rutina_socio_write_own on public.rutina_socio;
create policy rutina_socio_write_own on public.rutina_socio
  for all to authenticated
  using (id_socio = public.fn_current_socio_id())
  with check (id_socio = public.fn_current_socio_id());

drop policy if exists res_select_own on public.rutina_ejercicio_socio;
create policy res_select_own on public.rutina_ejercicio_socio
  for select to authenticated
  using (id_socio = public.fn_current_socio_id());

drop policy if exists res_write_own on public.rutina_ejercicio_socio;
create policy res_write_own on public.rutina_ejercicio_socio
  for all to authenticated
  using (id_socio = public.fn_current_socio_id())
  with check (id_socio = public.fn_current_socio_id());

drop policy if exists rutina_gimnasio_select_authorized on public.rutina_gimnasio;
create policy rutina_gimnasio_select_authorized on public.rutina_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
    or exists (
      select 1
      from public.rutinas_asignadas_socio_gimnasio ra
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ra.id_socio_gimnasio
      where ra.id_rutina_gimnasio = rutina_gimnasio.id_rutina_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists rutina_gimnasio_write_authorized on public.rutina_gimnasio;
create policy rutina_gimnasio_write_authorized on public.rutina_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  );

drop policy if exists reg_select_authorized on public.rutina_ejercicio_gimnasio;
create policy reg_select_authorized on public.rutina_ejercicio_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
    or exists (
      select 1
      from public.rutinas_asignadas_socio_gimnasio ra
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ra.id_socio_gimnasio
      where ra.id_rutina_gimnasio = rutina_ejercicio_gimnasio.id_rutina_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists reg_write_authorized on public.rutina_ejercicio_gimnasio;
create policy reg_write_authorized on public.rutina_ejercicio_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  );

drop policy if exists rasg_write_authorized on public.rutinas_asignadas_socio_gimnasio;
drop policy if exists rasg_select_authorized on public.rutinas_asignadas_socio_gimnasio;
create policy rasg_select_authorized on public.rutinas_asignadas_socio_gimnasio
  for select to authenticated
  using (
    exists (
      select 1 from public.socio_gimnasio sg
      where sg.id_socio_gimnasio = rutinas_asignadas_socio_gimnasio.id_socio_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
  );

-- 4g. Manejo condicional integral de public.progreso si existe
do $$
begin
  if to_regclass('public.progreso') is not null then
    execute 'alter table public.progreso enable row level security';
    execute 'revoke all on public.progreso from public, anon, authenticated';
    execute 'grant select, insert, update, delete on public.progreso to authenticated';
    execute 'grant all on public.progreso to service_role';

    execute 'drop policy if exists progreso_select_authorized on public.progreso';
    execute $pol$
      create policy progreso_select_authorized on public.progreso
        for select to authenticated
        using (
          id_socio = public.fn_current_socio_id()
          or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
        )
    $pol$;

    execute 'drop policy if exists progreso_write_self on public.progreso';
    execute 'drop policy if exists progreso_insert_self on public.progreso';
    execute $pol$
      create policy progreso_insert_self on public.progreso
        for insert to authenticated
        with check (id_socio = public.fn_current_socio_id())
    $pol$;

    execute 'drop policy if exists progreso_update_self on public.progreso';
    execute $pol$
      create policy progreso_update_self on public.progreso
        for update to authenticated
        using (id_socio = public.fn_current_socio_id())
        with check (id_socio = public.fn_current_socio_id())
    $pol$;

    execute 'drop policy if exists progreso_delete_self on public.progreso';
    execute $pol$
      create policy progreso_delete_self on public.progreso
        for delete to authenticated
        using (id_socio = public.fn_current_socio_id())
    $pol$;
  else
    raise notice 'public.progreso no existe en este esquema; políticas y permisos omitidos sin error.';
  end if;
end $$;

-- ============================================================================
-- 5. PROPIETARIOS SEGUROS Y PERMISOS EXECUTE MÍNIMOS EXPLICITOS
-- ============================================================================

-- Helpers internos y triggers: revocados incluso a authenticated (solo ejecución interna)
revoke all on function public.fn_es_service_role() from public, anon, authenticated;
grant execute on function public.fn_es_service_role() to service_role;

revoke all on function
  public.trg_fn_proteger_campos_dueno(),
  public.trg_fn_proteger_campos_empleado(),
  public.trg_fn_proteger_campos_socio(),
  public.trg_fn_proteger_socio_gimnasio(),
  public.trg_fn_proteger_campos_administrador(),
  public.trg_fn_proteger_admin_gimnasio_cambio(),
  public.trg_fn_proteger_membresia_socio_inmutable(),
  public.trg_fn_proteger_pago_inmutable()
from public, anon, authenticated;

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.trg_fn_proteger_empleado_gimnasio_cambio()',
    'public.trg_fn_validar_empleado_sucursal_gimnasio()',
    'public.trg_fn_proteger_propietario_ejercicio_sep()',
    'public.trg_fn_proteger_propietario_rutina_sep()',
    'public.trg_fn_validar_rutina_asignada()',
    'public.trg_fn_proteger_progreso()',
    'public.trg_fn_validar_ejercicio_en_rutina()',
    'public.trg_fn_proteger_propietario_ejercicio()',
    'public.trg_fn_proteger_propietario_rutina()'
  ]
  loop
    if to_regprocedure(v_sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    end if;
  end loop;
end $$;

-- Helpers RLS (requieren EXECUTE para authenticated al evaluarse bajo políticas RLS)
revoke all on function public.fn_current_dueno_id() from public, anon;
grant execute on function public.fn_current_dueno_id() to authenticated, service_role;

revoke all on function public.fn_current_socio_id() from public, anon;
grant execute on function public.fn_current_socio_id() to authenticated, service_role;

revoke all on function public.fn_current_empleado_id() from public, anon;
grant execute on function public.fn_current_empleado_id() to authenticated, service_role;

revoke all on function public.fn_current_administrador_id() from public, anon;
grant execute on function public.fn_current_administrador_id() to authenticated, service_role;

revoke all on function public.fn_dueno_posee_gimnasio(bigint) from public, anon;
grant execute on function public.fn_dueno_posee_gimnasio(bigint) to authenticated, service_role;

revoke all on function public.fn_dueno_posee_sucursal(bigint) from public, anon;
grant execute on function public.fn_dueno_posee_sucursal(bigint) to authenticated, service_role;

revoke all on function public.fn_admin_posee_gimnasio(bigint) from public, anon;
grant execute on function public.fn_admin_posee_gimnasio(bigint) to authenticated, service_role;

revoke all on function public.fn_admin_posee_sucursal(bigint) from public, anon;
grant execute on function public.fn_admin_posee_sucursal(bigint) to authenticated, service_role;

revoke all on function public.fn_empleado_en_gimnasio(bigint, text[]) from public, anon;
grant execute on function public.fn_empleado_en_gimnasio(bigint, text[]) to authenticated, service_role;

revoke all on function public.fn_empleado_en_sucursal(bigint, text[]) from public, anon;
grant execute on function public.fn_empleado_en_sucursal(bigint, text[]) to authenticated, service_role;

revoke all on function public.fn_socio_asociado_gimnasio(bigint, boolean) from public, anon;
grant execute on function public.fn_socio_asociado_gimnasio(bigint, boolean) to authenticated, service_role;

revoke all on function public.fn_socio_tiene_gimnasio(bigint, text[]) from public, anon;
grant execute on function public.fn_socio_tiene_gimnasio(bigint, text[]) to authenticated, service_role;

revoke all on function public.fn_socio_puede_asistir_sucursal(bigint, bigint) from public, anon;
grant execute on function public.fn_socio_puede_asistir_sucursal(bigint, bigint) to authenticated, service_role;

revoke all on function public.fn_staff_puede_ver_socio(bigint) from public, anon;
grant execute on function public.fn_staff_puede_ver_socio(bigint) to authenticated, service_role;

revoke all on function public.fn_staff_puede_gestionar_socio(bigint) from public, anon;
grant execute on function public.fn_staff_puede_gestionar_socio(bigint) to authenticated, service_role;

revoke all on function public.fn_staff_puede_gestionar_rutinas_socio(bigint) from public, anon;
grant execute on function public.fn_staff_puede_gestionar_rutinas_socio(bigint) to authenticated, service_role;

-- RPCs de negocio autorizadas
revoke all on function public.rpc_asociar_socio_gimnasio(bigint, bigint) from public, anon;
grant execute on function public.rpc_asociar_socio_gimnasio(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_cambiar_estado_socio_gimnasio(bigint, boolean) from public, anon;
grant execute on function public.rpc_cambiar_estado_socio_gimnasio(bigint, boolean) to authenticated, service_role;

revoke all on function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) from public, anon;
grant execute on function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) to authenticated, service_role;

revoke all on function public.rpc_actualizar_estado_membresia(bigint, varchar, date) from public, anon;
grant execute on function public.rpc_actualizar_estado_membresia(bigint, varchar, date) to authenticated, service_role;

revoke all on function public.rpc_registrar_socio_gimnasio(bigint, bigint, varchar, varchar, varchar, varchar, varchar, date, varchar, boolean, varchar, numeric) from public, anon;
grant execute on function public.rpc_registrar_socio_gimnasio(bigint, bigint, varchar, varchar, varchar, varchar, varchar, date, varchar, boolean, varchar, numeric) to authenticated, service_role;

revoke all on function public.rpc_registrar_pago(bigint, numeric, varchar, varchar, varchar, timestamptz) from public, anon;
grant execute on function public.rpc_registrar_pago(bigint, numeric, varchar, varchar, varchar, timestamptz) to authenticated, service_role;

revoke all on function public.rpc_actualizar_estado_pago(bigint, varchar) from public, anon;
grant execute on function public.rpc_actualizar_estado_pago(bigint, varchar) to authenticated, service_role;

revoke all on function public.rpc_registrar_ingreso_asistencia(bigint, bigint) from public, anon;
grant execute on function public.rpc_registrar_ingreso_asistencia(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_registrar_salida_asistencia(bigint, bigint) from public, anon;
grant execute on function public.rpc_registrar_salida_asistencia(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_anular_asistencia(bigint, text) from public, anon;
grant execute on function public.rpc_anular_asistencia(bigint, text) to authenticated, service_role;

revoke all on function public.rpc_asignar_rutina_gimnasio_socio(bigint, bigint, date, text) from public, anon;
grant execute on function public.rpc_asignar_rutina_gimnasio_socio(bigint, bigint, date, text) to authenticated, service_role;

revoke all on function public.rpc_finalizar_rutina_asignada(bigint, date, text) from public, anon;
grant execute on function public.rpc_finalizar_rutina_asignada(bigint, date, text) to authenticated, service_role;

revoke all on function public.rpc_reordenar_rutina_socio_ejercicios(bigint, bigint[]) from public, anon;
grant execute on function public.rpc_reordenar_rutina_socio_ejercicios(bigint, bigint[]) to authenticated, service_role;

revoke all on function public.rpc_reordenar_rutina_gimnasio_ejercicios(bigint, bigint[]) from public, anon;
grant execute on function public.rpc_reordenar_rutina_gimnasio_ejercicios(bigint, bigint[]) to authenticated, service_role;

revoke all on function public.rpc_vincular_identidad_perfil(varchar) from public, anon;
grant execute on function public.rpc_vincular_identidad_perfil(varchar) to authenticated, service_role;

-- Asegurar propietario confiable (postgres) en funciones SECURITY DEFINER, triggers, RPCs y vistas cuando exista el rol
do $$
declare
  v_sig text;
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'postgres')
     and pg_catalog.pg_has_role(current_user, 'postgres', 'MEMBER') then
    alter view public.vw_catalogo_gimnasios owner to postgres;
    alter view public.vw_catalogo_planes owner to postgres;
    alter function public.fn_es_service_role() owner to postgres;
    alter function public.fn_current_dueno_id() owner to postgres;
    alter function public.fn_current_socio_id() owner to postgres;
    alter function public.fn_current_empleado_id() owner to postgres;
    alter function public.fn_current_administrador_id() owner to postgres;
    alter function public.fn_dueno_posee_gimnasio(bigint) owner to postgres;
    alter function public.fn_dueno_posee_sucursal(bigint) owner to postgres;
    alter function public.fn_admin_posee_gimnasio(bigint) owner to postgres;
    alter function public.fn_admin_posee_sucursal(bigint) owner to postgres;
    alter function public.fn_empleado_en_gimnasio(bigint, text[]) owner to postgres;
    alter function public.fn_empleado_en_sucursal(bigint, text[]) owner to postgres;
    alter function public.fn_socio_asociado_gimnasio(bigint, boolean) owner to postgres;
    alter function public.fn_socio_tiene_gimnasio(bigint, text[]) owner to postgres;
    alter function public.fn_socio_puede_asistir_sucursal(bigint, bigint) owner to postgres;
    alter function public.fn_staff_puede_ver_socio(bigint) owner to postgres;
    alter function public.fn_staff_puede_gestionar_socio(bigint) owner to postgres;
    alter function public.fn_staff_puede_gestionar_rutinas_socio(bigint) owner to postgres;
    alter function public.trg_fn_proteger_campos_dueno() owner to postgres;
    alter function public.trg_fn_proteger_campos_empleado() owner to postgres;
    alter function public.trg_fn_proteger_campos_socio() owner to postgres;
    alter function public.trg_fn_proteger_socio_gimnasio() owner to postgres;
    alter function public.trg_fn_proteger_campos_administrador() owner to postgres;
    alter function public.trg_fn_proteger_admin_gimnasio_cambio() owner to postgres;
    alter function public.trg_fn_proteger_membresia_socio_inmutable() owner to postgres;
    alter function public.trg_fn_proteger_pago_inmutable() owner to postgres;
    alter function public.rpc_asociar_socio_gimnasio(bigint, bigint) owner to postgres;
    alter function public.rpc_cambiar_estado_socio_gimnasio(bigint, boolean) owner to postgres;
    alter function public.rpc_registrar_pago(bigint, numeric, varchar, varchar, varchar, timestamptz) owner to postgres;
    alter function public.rpc_actualizar_estado_pago(bigint, varchar) owner to postgres;
    alter function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) owner to postgres;
    alter function public.rpc_actualizar_estado_membresia(bigint, varchar, date) owner to postgres;
    alter function public.rpc_registrar_socio_gimnasio(bigint, bigint, varchar, varchar, varchar, varchar, varchar, date, varchar, boolean, varchar, numeric) owner to postgres;
    alter function public.rpc_registrar_ingreso_asistencia(bigint, bigint) owner to postgres;
    alter function public.rpc_registrar_salida_asistencia(bigint, bigint) owner to postgres;
    alter function public.rpc_anular_asistencia(bigint, text) owner to postgres;
    alter function public.rpc_asignar_rutina_gimnasio_socio(bigint, bigint, date, text) owner to postgres;
    alter function public.rpc_finalizar_rutina_asignada(bigint, date, text) owner to postgres;
    alter function public.rpc_reordenar_rutina_socio_ejercicios(bigint, bigint[]) owner to postgres;
    alter function public.rpc_reordenar_rutina_gimnasio_ejercicios(bigint, bigint[]) owner to postgres;
    alter function public.rpc_vincular_identidad_perfil(varchar) owner to postgres;

    foreach v_sig in array array[
      'public.trg_fn_proteger_empleado_gimnasio_cambio()',
      'public.trg_fn_validar_empleado_sucursal_gimnasio()',
      'public.trg_fn_proteger_propietario_ejercicio_sep()',
      'public.trg_fn_proteger_propietario_rutina_sep()',
      'public.trg_fn_validar_rutina_asignada()',
      'public.trg_fn_proteger_progreso()',
      'public.rpc_reordenar_rutina_ejercicios(bigint, bigint[])'
    ]
    loop
      if to_regprocedure(v_sig) is not null then
        execute format('alter function %s owner to postgres', v_sig);
      end if;
    end loop;
  end if;
end $$;

commit;
