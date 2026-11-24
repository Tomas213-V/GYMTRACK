-- ============================================================================
-- MIGRACIÓN INCREMENTAL 04: Simplificación Segura de public.asistencia_socio
--
-- Objetivo:
--   Vincular cada asistencia directamente solo con id_socio e id_sucursal,
--   eliminando id_membresia_socio e id_gimnasio SIN eliminar la tabla ni perder
--   registros históricos existentes.
--   El gimnasio se deriva mediante: asistencia_socio -> sucursal -> gimnasio.
--
-- Controles de integridad (sin CASCADE):
--   1. Verifica registros huérfanos en socio/sucursal antes de alterar columnas.
--   2. Identifica por pg_attribute/conkey/indkey las restricciones e índices
--      que involucran exactamente id_membresia_socio o id_gimnasio.
--   3. Verifica pg_depend / pg_views / pg_trigger y aborta con error claro si
--      quedaran objetos dependientes sin adaptar.
--   4. Verifica por conkey + confkey que las FKs finales correspondan
--      exactamente a (id_socio -> socio.id_socio) y (id_sucursal -> sucursal.id_sucursal).
--   5. Consolida RPCs SECURITY DEFINER, REVOKE de escrituras directas y RLS.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Auditoría previa de registros y dependencias
-- ----------------------------------------------------------------------------
do $$
declare
  v_total_asistencias bigint;
  v_huerfanas_socio bigint;
  v_huerfanas_sucursal bigint;
begin
  select count(*) into v_total_asistencias from public.asistencia_socio;

  select count(*) into v_huerfanas_socio
  from public.asistencia_socio a
  left join public.socio s on s.id_socio = a.id_socio
  where s.id_socio is null;

  select count(*) into v_huerfanas_sucursal
  from public.asistencia_socio a
  left join public.sucursal su on su.id_sucursal = a.id_sucursal
  where su.id_sucursal is null;

  if v_huerfanas_socio > 0 or v_huerfanas_sucursal > 0 then
    raise exception 'Existen asistencias huérfanas (socio: %, sucursal: %). Abortando migración 04 para proteger integridad.',
      v_huerfanas_socio, v_huerfanas_sucursal;
  end if;

  raise notice 'Auditoría asistencia_socio: % registros válidos encontrados.', v_total_asistencias;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Eliminar políticas RLS sobre asistencia_socio antes de alterar columnas
-- ----------------------------------------------------------------------------
drop policy if exists asistencia_select_authorized on public.asistencia_socio;
drop policy if exists asistencia_insert_authorized on public.asistencia_socio;
drop policy if exists asistencia_update_authorized on public.asistencia_socio;
drop policy if exists asistencia_delete_authorized on public.asistencia_socio;

-- ----------------------------------------------------------------------------
-- 3. Identificar y eliminar por columna (indkey/conkey) índices y constraints
--    que dependan de id_membresia_socio o id_gimnasio (sin CASCADE)
-- ----------------------------------------------------------------------------
do $$
declare
  v_attnums smallint[];
  v_idx record;
  v_con record;
  v_dep record;
begin
  select pg_catalog.array_agg(attnum) into v_attnums
  from pg_catalog.pg_attribute
  where attrelid = 'public.asistencia_socio'::regclass
    and attname in ('id_membresia_socio', 'id_gimnasio')
    and not attisdropped;

  if v_attnums is not null and pg_catalog.array_length(v_attnums, 1) > 0 then
    -- 3a. Índices no pertenecientes a constraints que incluyan alguna de las dos columnas
    for v_idx in
      select ns.nspname as schema_name, cls.relname as index_name
      from pg_catalog.pg_index ix
      join pg_catalog.pg_class cls on cls.oid = ix.indexrelid
      join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
      where ix.indrelid = 'public.asistencia_socio'::regclass
        and not ix.indisprimary
        and exists (
          select 1
          from pg_catalog.unnest(ix.indkey::smallint[]) as k(attnum)
          where k.attnum = any(v_attnums)
        )
        and not exists (
          select 1
          from pg_catalog.pg_constraint c
          where c.conindid = ix.indexrelid
        )
    loop
      execute format('drop index if exists %I.%I', v_idx.schema_name, v_idx.index_name);
    end loop;

    -- 3b. Constraints en asistencia_socio cuya conkey incluya id_membresia_socio o id_gimnasio
    for v_con in
      select c.conname
      from pg_catalog.pg_constraint c
      where c.conrelid = 'public.asistencia_socio'::regclass
        and exists (
          select 1
          from pg_catalog.unnest(c.conkey) as k(attnum)
          where k.attnum = any(v_attnums)
        )
    loop
      execute format('alter table public.asistencia_socio drop constraint if exists %I', v_con.conname);
    end loop;

    -- 3c. Verificar si quedan dependencias residuales (vistas, reglas, triggers, FKs externas)
    for v_dep in
      select d.classid::regclass::text as obj_class,
             d.objid,
             a.attname as col_name
      from pg_catalog.pg_depend d
      join pg_catalog.pg_attribute a
        on a.attrelid = d.refobjid
       and a.attnum = d.refobjsubid
      where d.refobjid = 'public.asistencia_socio'::regclass
        and d.refobjsubid = any(v_attnums)
        and d.deptype in ('n', 'a')
    loop
      raise exception 'Dependencia no adaptada detectada sobre asistencia_socio.% (clase: %, objid: %). Resuélvela antes de eliminar la columna.',
        v_dep.col_name, v_dep.obj_class, v_dep.objid;
    end loop;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Verificar por conkey y confkey que las FKs directas correspondan
--    exactamente a (id_socio -> socio.id_socio) y (id_sucursal -> sucursal.id_sucursal)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute af
      on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.conrelid = 'public.asistencia_socio'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.socio'::regclass
      and pg_catalog.array_length(c.conkey, 1) = 1
      and a.attname = 'id_socio'
      and af.attname = 'id_socio'
  ) then
    alter table public.asistencia_socio
      add constraint fk_asistencia_socio
      foreign key (id_socio) references public.socio(id_socio) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a
      on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute af
      on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.conrelid = 'public.asistencia_socio'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.sucursal'::regclass
      and pg_catalog.array_length(c.conkey, 1) = 1
      and a.attname = 'id_sucursal'
      and af.attname = 'id_sucursal'
  ) then
    alter table public.asistencia_socio
      add constraint fk_asistencia_sucursal
      foreign key (id_sucursal) references public.sucursal(id_sucursal) on delete restrict;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Eliminar id_membresia_socio e id_gimnasio (sin CASCADE, conservando filas)
-- ----------------------------------------------------------------------------
alter table public.asistencia_socio
  drop column if exists id_membresia_socio,
  drop column if exists id_gimnasio;

-- Verificación post-alteración de columnas y FKs obligatorias
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.asistencia_socio'::regclass
      and attname in ('id_membresia_socio', 'id_gimnasio')
      and not attisdropped
  ) then
    raise exception 'Fallo en migración 04: las columnas antiguas aún permanecen en public.asistencia_socio.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.conrelid = 'public.asistencia_socio'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.socio'::regclass
      and pg_catalog.array_length(c.conkey, 1) = 1
      and a.attname = 'id_socio'
      and af.attname = 'id_socio'
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.conrelid = 'public.asistencia_socio'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.sucursal'::regclass
      and pg_catalog.array_length(c.conkey, 1) = 1
      and a.attname = 'id_sucursal'
      and af.attname = 'id_sucursal'
  ) then
    raise exception 'Fallo en migración 04: no se verificaron las FKs exactas hacia socio y sucursal.';
  end if;
end $$;

-- Reafirmar índices requeridos sobre la estructura simplificada
create index if not exists idx_asistencia_socio_fecha
  on public.asistencia_socio(id_socio, hora_ingreso desc);

create index if not exists idx_asistencia_sucursal_fecha
  on public.asistencia_socio(id_sucursal, hora_ingreso desc);

create unique index if not exists uq_asistencia_abierta_socio
  on public.asistencia_socio (id_socio)
  where (estado = 'presente' and hora_salida is null);

-- ----------------------------------------------------------------------------
-- 6. Reafirmar helpers y RPCs SECURITY DEFINER de asistencia
-- ----------------------------------------------------------------------------
create or replace function public.fn_dueno_posee_sucursal(p_id_sucursal bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
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

create or replace function public.fn_socio_puede_asistir_sucursal(
  p_id_socio bigint,
  p_id_sucursal bigint
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select (
    (
      p_id_socio = public.fn_current_socio_id()
      or public.fn_dueno_posee_sucursal(p_id_sucursal)
      or public.fn_empleado_en_sucursal(p_id_sucursal, array['administrador', 'recepcionista'])
    )
    and exists (
      select 1
      from public.sucursal suc
      join public.gimnasio g on g.id_gimnasio = suc.id_gimnasio
      join public.socio soc on soc.id_socio = p_id_socio
      join public.membresia_socio ms
        on ms.id_socio = soc.id_socio
       and ms.id_gimnasio = suc.id_gimnasio
      where suc.id_sucursal = p_id_sucursal
        and suc.estado = true
        and g.estado = true
        and soc.estado = true
        and ms.estado = 'activa'
        and current_date between ms.fecha_inicio and ms.fecha_vencimiento
    )
  );
$$;

drop function if exists public.rpc_registrar_ingreso_asistencia(bigint, bigint, bigint);
drop function if exists public.rpc_registrar_ingreso_asistencia(bigint, bigint);

create or replace function public.rpc_registrar_ingreso_asistencia(
  p_id_sucursal bigint,
  p_id_socio bigint default null
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_caller_socio_id bigint;
  v_sucursal public.sucursal%rowtype;
  v_gym_estado boolean;
  v_es_staff boolean := false;
  v_target_socio_id bigint;
  v_socio public.socio%rowtype;
  v_tiene_membresia boolean := false;
  v_abierta_id bigint;
  v_asistencia public.asistencia_socio%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar un ingreso.';
  end if;

  if p_id_sucursal is null then
    raise exception 'Debes indicar la sucursal para registrar el ingreso.';
  end if;

  select * into v_sucursal
  from public.sucursal
  where id_sucursal = p_id_sucursal;

  if not found then
    raise exception 'La sucursal seleccionada no existe.';
  end if;

  if not v_sucursal.estado then
    raise exception 'La sucursal seleccionada se encuentra inactiva.';
  end if;

  select g.estado into v_gym_estado
  from public.gimnasio g
  where g.id_gimnasio = v_sucursal.id_gimnasio;

  if coalesce(v_gym_estado, false) = false then
    raise exception 'El gimnasio asociado a esta sucursal se encuentra inactivo.';
  end if;

  if not v_is_service then
    select s.id_socio into v_caller_socio_id
    from public.socio s
    where s.auth_user_id = v_uid
    limit 1;

    select (
      exists (
        select 1
        from public.gimnasio g
        join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_sucursal.id_gimnasio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        where e.auth_user_id = v_uid
          and e.estado = true
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

  select * into v_socio
  from public.socio
  where id_socio = v_target_socio_id
  for update;

  if not found then
    raise exception 'Socio no encontrado.';
  end if;

  if not v_socio.estado then
    raise exception 'El socio se encuentra inactivo.';
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

  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = v_target_socio_id
      and ms.id_gimnasio = v_sucursal.id_gimnasio
      and ms.estado = 'activa'
      and current_date between ms.fecha_inicio and ms.fecha_vencimiento
  ) into v_tiene_membresia;

  if not v_tiene_membresia then
    raise exception 'El socio no cuenta con una membresía activa y vigente en el gimnasio de esta sucursal.';
  end if;

  insert into public.asistencia_socio (
    id_socio,
    id_sucursal,
    hora_ingreso,
    estado
  )
  values (
    v_target_socio_id,
    v_sucursal.id_sucursal,
    now(),
    'presente'
  )
  returning * into v_asistencia;

  return v_asistencia;
end;
$$;

drop function if exists public.rpc_registrar_salida_asistencia(bigint);
drop function if exists public.rpc_registrar_salida_asistencia(bigint, bigint);

create or replace function public.rpc_registrar_salida_asistencia(
  p_id_asistencia_socio bigint default null,
  p_id_socio bigint default null
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_caller_socio_id bigint;
  v_actual public.asistencia_socio%rowtype;
  v_autorizado boolean := false;
  v_updated public.asistencia_socio%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar la salida.';
  end if;

  if not v_is_service then
    select s.id_socio into v_caller_socio_id
    from public.socio s
    where s.auth_user_id = v_uid
    limit 1;
  end if;

  if p_id_asistencia_socio is not null then
    select * into v_actual
    from public.asistencia_socio
    where id_asistencia_socio = p_id_asistencia_socio
    for update;
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
        select 1
        from public.sucursal su
        join public.gimnasio g on g.id_gimnasio = su.id_gimnasio
        join public.dueno d on d.id_dueno = g.id_dueno
        where su.id_sucursal = v_actual.id_sucursal
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        where e.auth_user_id = v_uid
          and e.estado = true
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
    raise exception 'La asistencia #% ya fue cerrada o anulada (estado: %).', v_actual.id_asistencia_socio, v_actual.estado;
  end if;

  update public.asistencia_socio
  set hora_salida = greatest(now(), hora_ingreso),
      estado = 'finalizada'
  where id_asistencia_socio = v_actual.id_asistencia_socio
  returning * into v_updated;

  return v_updated;
end;
$$;

create or replace function public.rpc_anular_asistencia(
  p_id_asistencia_socio bigint
)
returns public.asistencia_socio
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_actual public.asistencia_socio%rowtype;
  v_autorizado boolean := false;
  v_updated public.asistencia_socio%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para anular asistencias.';
  end if;

  if p_id_asistencia_socio is null then
    raise exception 'Debes indicar el identificador de la asistencia.';
  end if;

  select * into v_actual
  from public.asistencia_socio
  where id_asistencia_socio = p_id_asistencia_socio
  for update;

  if not found then
    raise exception 'La asistencia #% no existe.', p_id_asistencia_socio;
  end if;

  if not v_is_service then
    select (
      exists (
        select 1
        from public.sucursal su
        join public.gimnasio g on g.id_gimnasio = su.id_gimnasio
        join public.dueno d on d.id_dueno = g.id_dueno
        where su.id_sucursal = v_actual.id_sucursal
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and es.id_sucursal = v_actual.id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para anular asistencias en esta sucursal.';
    end if;
  end if;

  update public.asistencia_socio
  set estado = 'anulada'
  where id_asistencia_socio = v_actual.id_asistencia_socio
  returning * into v_updated;

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Seguridad, REVOKE/GRANT y política SELECT única en public.asistencia_socio
-- ----------------------------------------------------------------------------
alter table public.asistencia_socio enable row level security;

revoke all on public.asistencia_socio from public, anon, authenticated;
grant select on public.asistencia_socio to authenticated;
grant all on public.asistencia_socio to service_role;

revoke all on function public.fn_dueno_posee_sucursal(bigint) from public, anon;
grant execute on function public.fn_dueno_posee_sucursal(bigint) to authenticated, service_role;

revoke all on function public.fn_socio_puede_asistir_sucursal(bigint, bigint) from public, anon;
grant execute on function public.fn_socio_puede_asistir_sucursal(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_registrar_ingreso_asistencia(bigint, bigint) from public, anon;
grant execute on function public.rpc_registrar_ingreso_asistencia(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_registrar_salida_asistencia(bigint, bigint) from public, anon;
grant execute on function public.rpc_registrar_salida_asistencia(bigint, bigint) to authenticated, service_role;

revoke all on function public.rpc_anular_asistencia(bigint) from public, anon;
grant execute on function public.rpc_anular_asistencia(bigint) to authenticated, service_role;

create policy asistencia_select_authorized on public.asistencia_socio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_dueno_posee_sucursal(id_sucursal)
    or public.fn_empleado_en_sucursal(id_sucursal, array['administrador', 'recepcionista', 'entrenador'])
  );

commit;
