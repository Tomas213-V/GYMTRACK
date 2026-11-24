-- ============================================================================
-- MIGRACIÓN ADITIVA 02: Funciones Transaccionales (RPC) y Triggers de Integridad
--
-- Incluye:
--   1. rpc_contratar_membresia (SECURITY DEFINER): validación de identidad/rol,
--      vigencia del plan/gimnasio, importe/descuento autorizado, estado inicial,
--      prevención de superposiciones/duplicados y pago opcional atómico.
--   2. rpc_registrar_socio_gimnasio (SECURITY DEFINER): alta/vinculación de socio
--      a un gimnasio con contratación inicial atómica.
--   3. rpc_registrar_pago (SECURITY DEFINER): registro contable protegido,
--      anti-duplicados y activación de contrato pendiente.
--   4. rpc_actualizar_estado_pago (SECURITY DEFINER): transición de estado /
--      anulación lógica sin alterar montos ni fechas y bloqueando reversión de
--      pagos anulados.
--   5. rpc_registrar_ingreso_asistencia (SECURITY DEFINER): modelo simplificado
--      (id_socio + id_sucursal), serializado FOR UPDATE y validando membresía
--      activa y vigente dinámicamente.
--   6. rpc_registrar_salida_asistencia (SECURITY DEFINER): cierre autorizado.
--   7. rpc_anular_asistencia (SECURITY DEFINER): anulación lógica por dueño/staff.
--   8. rpc_reordenar_rutina_ejercicios (SECURITY INVOKER): reordenamiento atómico.
--   9. trg_fn_validar_ejercicio_en_rutina (SECURITY DEFINER): compatibilidad.
--
-- Las RPC de escritura en tablas bloqueadas por PostgREST (membresia_socio,
-- pago, asistencia_socio) usan SECURITY DEFINER con search_path fijo, validación
-- estricta de auth.uid()/tenant/rol y permisos EXECUTE restringidos.
--
-- Ejecutar DESPUÉS de 01_migracion_empleados_y_asistencias.sql.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. RPC: Contratar membresía copiando condiciones históricas del plan
-- ----------------------------------------------------------------------------
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
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_caller_socio_id bigint;
  v_is_gym_staff boolean := false;
  v_plan public.membresia_gimnasio%rowtype;
  v_gym_estado boolean;
  v_socio public.socio%rowtype;
  v_fecha_inicio date := coalesce(p_fecha_inicio, current_date);
  v_fecha_vencimiento date;
  v_estado_inicial varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'activa')));
  v_estado_pago varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado_pago, 'aprobado')));
  v_precio numeric(12,2);
  v_comprobante text := nullif(pg_catalog.btrim(p_comprobante), '');
  v_contrato public.membresia_socio%rowtype;
  v_pago public.pago%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para contratar una membresía.';
  end if;

  if p_id_socio is null or p_id_membresia_gimnasio is null then
    raise exception 'Debes indicar el socio y el plan de membresía.';
  end if;

  -- Validar estado inicial permitido al crear una contratación
  if v_estado_inicial not in ('pendiente', 'activa') then
    raise exception 'Estado inicial de membresía inválido (%). Solo se permite pendiente o activa.', v_estado_inicial;
  end if;

  -- Obtener plan y estado de su gimnasio
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

  -- Validar autorización del llamador (cuando no es service_role)
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
        where g.id_gimnasio = v_plan.id_gimnasio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and su.id_gimnasio = v_plan.id_gimnasio
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_gym_staff;

    if v_is_gym_staff then
      -- Staff autorizado del gimnasio propietario del plan
      if p_monto_override is not null and p_monto_override < 0 then
        raise exception 'El importe de la contratación no puede ser negativo.';
      end if;
      v_precio := coalesce(p_monto_override, v_plan.precio);
    elsif v_caller_socio_id is not null and v_caller_socio_id = p_id_socio then
      -- Un socio solo puede crear solicitudes pendientes con fecha >= hoy y precio oficial
      if v_estado_inicial <> 'pendiente' then
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

  -- Bloquear socio para evitar contrataciones concurrentes inconsistentes
  select * into v_socio
  from public.socio
  where id_socio = p_id_socio
  for update;

  if not found then
    raise exception 'El socio (%) no existe.', p_id_socio;
  end if;

  if not v_socio.estado then
    raise exception 'El socio (%) se encuentra inactivo.', p_id_socio;
  end if;

  v_fecha_vencimiento := v_fecha_inicio + v_plan.duracion_dias;

  -- Prevenir solicitudes pendientes duplicadas en el mismo gimnasio
  if v_estado_inicial = 'pendiente' and exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = p_id_socio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'pendiente'
  ) then
    raise exception 'Ya existe una solicitud de membresía pendiente para este socio en este gimnasio.';
  end if;

  -- Prevenir superposición de fechas entre membresías activas en el mismo gimnasio
  if v_estado_inicial = 'activa' and exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = p_id_socio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'activa'
      and ms.fecha_inicio <= v_fecha_vencimiento
      and ms.fecha_vencimiento >= v_fecha_inicio
  ) then
    raise exception 'El socio ya posee una membresía activa en este gimnasio que se superpone con el período indicado.';
  end if;

  insert into public.membresia_socio (
    id_socio,
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
    p_id_socio,
    v_plan.id_membresia_gimnasio,
    v_plan.id_gimnasio,
    v_precio,
    v_plan.duracion_dias,
    v_plan.limite_asistencias_semanales,
    v_plan.limite_asistencias_totales,
    v_fecha_inicio,
    v_fecha_vencimiento,
    v_estado_inicial
  )
  returning * into v_contrato;

  if coalesce(p_registrar_pago, false) then
    if v_estado_pago not in ('pendiente', 'aprobado', 'rechazado') then
      raise exception 'Estado inicial de pago inválido: %', v_estado_pago;
    end if;

    if v_comprobante is not null and exists (
      select 1
      from public.pago p
      join public.membresia_socio ms on ms.id_membresia_socio = p.id_membresia_socio
      where ms.id_gimnasio = v_plan.id_gimnasio
        and p.estado <> 'anulado'
        and pg_catalog.lower(pg_catalog.btrim(p.comprobante)) = pg_catalog.lower(v_comprobante)
    ) then
      raise exception 'Ya existe un pago activo registrado con el comprobante "%".', v_comprobante;
    end if;

    insert into public.pago (
      monto,
      metodo_pago,
      estado,
      comprobante,
      id_membresia_socio
    )
    values (
      v_precio,
      coalesce(nullif(pg_catalog.btrim(p_metodo_pago), ''), 'efectivo'),
      v_estado_pago,
      v_comprobante,
      v_contrato.id_membresia_socio
    )
    returning * into v_pago;
  end if;

  return jsonb_build_object(
    'membresia_socio', to_jsonb(v_contrato),
    'pago', case when coalesce(p_registrar_pago, false) then to_jsonb(v_pago) else null end
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. RPC: Registrar socio presencial y vincularlo al gimnasio atómicamente
-- ----------------------------------------------------------------------------
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
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_is_staff boolean := false;
  v_plan_gym bigint;
  v_clean_dni text := nullif(pg_catalog.btrim(p_dni), '');
  v_clean_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_socio public.socio%rowtype;
  v_creado boolean := false;
  v_res jsonb;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service then
    if v_uid is null then
      raise exception 'Debes iniciar sesión para registrar socios.';
    end if;

    select (
      exists (
        select 1
        from public.gimnasio g
        join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = p_id_gimnasio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and su.id_gimnasio = p_id_gimnasio
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_is_staff;

    if not coalesce(v_is_staff, false) then
      raise exception 'No tienes autorización para registrar socios en el gimnasio %.', p_id_gimnasio;
    end if;
  end if;

  select mg.id_gimnasio into v_plan_gym
  from public.membresia_gimnasio mg
  where mg.id_membresia_gimnasio = p_id_membresia_gimnasio;

  if not found or v_plan_gym <> p_id_gimnasio then
    raise exception 'El plan % no pertenece al gimnasio %.', p_id_membresia_gimnasio, p_id_gimnasio;
  end if;

  if v_clean_dni is not null then
    select * into v_socio
    from public.socio s
    where s.dni = v_clean_dni
    limit 1;
  end if;

  if not found and v_clean_email is not null then
    select * into v_socio
    from public.socio s
    where pg_catalog.lower(s.email) = v_clean_email
    limit 1;
  end if;

  if not found then
    if nullif(pg_catalog.btrim(p_nombre), '') is null or nullif(pg_catalog.btrim(p_apellido), '') is null then
      raise exception 'Nombre y apellido son obligatorios para registrar un nuevo socio.';
    end if;

    insert into public.socio (
      auth_user_id,
      nombre,
      apellido,
      dni,
      telefono,
      email,
      estado
    )
    values (
      null,
      pg_catalog.btrim(p_nombre),
      pg_catalog.btrim(p_apellido),
      v_clean_dni,
      nullif(pg_catalog.btrim(p_telefono), ''),
      v_clean_email,
      true
    )
    returning * into v_socio;

    v_creado := true;
  end if;

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

  return jsonb_build_object(
    'creado', v_creado,
    'socio', to_jsonb(v_socio),
    'membresia_socio', v_res->'membresia_socio',
    'pago', v_res->'pago'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: Registrar pago protegido sobre una contratación existente
-- ----------------------------------------------------------------------------
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
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_contrato public.membresia_socio%rowtype;
  v_autorizado boolean := false;
  v_estado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'aprobado')));
  v_metodo varchar(40) := nullif(pg_catalog.lower(pg_catalog.btrim(p_metodo_pago)), '');
  v_comprobante text := nullif(pg_catalog.btrim(p_comprobante), '');
  v_total_aprobado numeric(12,2);
  v_pago public.pago%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar pagos.';
  end if;

  if p_id_membresia_socio is null then
    raise exception 'Debes indicar la contratación asociada al pago.';
  end if;

  if p_monto is null or p_monto < 0 then
    raise exception 'El monto del pago debe ser mayor o igual a 0.';
  end if;

  if v_metodo is null then
    raise exception 'El método de pago es obligatorio.';
  end if;

  if v_estado not in ('pendiente', 'aprobado', 'rechazado') then
    raise exception 'Estado inicial de pago inválido (%). Permitidos: pendiente, aprobado, rechazado.', v_estado;
  end if;

  -- Bloquear contrato para evitar registros duplicados concurrentes
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
        select 1
        from public.gimnasio g
        join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_contrato.id_gimnasio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and su.id_gimnasio = v_contrato.id_gimnasio
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para registrar pagos en este gimnasio.';
    end if;
  end if;

  if v_comprobante is not null and exists (
    select 1
    from public.pago p
    join public.membresia_socio ms on ms.id_membresia_socio = p.id_membresia_socio
    where ms.id_gimnasio = v_contrato.id_gimnasio
      and p.estado <> 'anulado'
      and pg_catalog.lower(pg_catalog.btrim(p.comprobante)) = pg_catalog.lower(v_comprobante)
  ) then
    raise exception 'El comprobante "%" ya se encuentra registrado en este gimnasio.', v_comprobante;
  end if;

  if v_estado = 'aprobado' then
    select coalesce(sum(p.monto), 0) into v_total_aprobado
    from public.pago p
    where p.id_membresia_socio = p_id_membresia_socio
      and p.estado = 'aprobado';

    if v_contrato.precio > 0 and (v_total_aprobado + p_monto) > v_contrato.precio and v_total_aprobado >= v_contrato.precio then
      raise exception 'La contratación #% ya registra el total abonado (%). No se permiten pagos aprobados duplicados.', p_id_membresia_socio, v_total_aprobado;
    end if;

    if exists (
      select 1
      from public.pago p
      where p.id_membresia_socio = p_id_membresia_socio
        and p.estado = 'aprobado'
        and p.monto = p_monto
        and p.metodo_pago = v_metodo
        and coalesce(pg_catalog.lower(pg_catalog.btrim(p.comprobante)), '') = coalesce(pg_catalog.lower(v_comprobante), '')
        and p.fecha_pago >= (now() - interval '60 seconds')
    ) then
      raise exception 'Pago duplicado detectado en los últimos segundos para la contratación #%.', p_id_membresia_socio;
    end if;
  end if;

  insert into public.pago (
    id_membresia_socio,
    monto,
    fecha_pago,
    metodo_pago,
    estado,
    comprobante
  )
  values (
    p_id_membresia_socio,
    p_monto,
    coalesce(p_fecha_pago, now()),
    v_metodo,
    v_estado,
    v_comprobante
  )
  returning * into v_pago;

  if v_estado = 'aprobado' and v_contrato.estado = 'pendiente' then
    update public.membresia_socio
    set estado = 'activa'
    where id_membresia_socio = v_contrato.id_membresia_socio;
  end if;

  return v_pago;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC: Actualizar estado o anular lógicamente un pago existente
-- ----------------------------------------------------------------------------
create or replace function public.rpc_actualizar_estado_pago(
  p_id_pago bigint,
  p_estado varchar
)
returns public.pago
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_jwt_role text := coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''), '');
  v_is_service boolean := false;
  v_pago public.pago%rowtype;
  v_contrato public.membresia_socio%rowtype;
  v_autorizado boolean := false;
  v_nuevo_estado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, '')));
  v_updated public.pago%rowtype;
begin
  v_is_service := (v_jwt_role = 'service_role')
    or (pg_catalog.current_user in ('postgres', 'supabase_admin', 'service_role') and v_uid is null);

  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para actualizar pagos.';
  end if;

  if p_id_pago is null then
    raise exception 'Debes indicar el identificador del pago.';
  end if;

  if v_nuevo_estado not in ('pendiente', 'aprobado', 'rechazado', 'anulado') then
    raise exception 'Estado de pago inválido: %', p_estado;
  end if;

  select * into v_pago
  from public.pago
  where id_pago = p_id_pago
  for update;

  if not found then
    raise exception 'El pago #% no existe.', p_id_pago;
  end if;

  select * into v_contrato
  from public.membresia_socio
  where id_membresia_socio = v_pago.id_membresia_socio
  for update;

  if not v_is_service then
    select (
      exists (
        select 1
        from public.gimnasio g
        join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_contrato.id_gimnasio
          and d.auth_user_id = v_uid
      )
      or exists (
        select 1
        from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and su.id_gimnasio = v_contrato.id_gimnasio
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para modificar este pago.';
    end if;
  end if;

  if v_pago.estado = 'anulado' and v_nuevo_estado <> 'anulado' then
    raise exception 'El pago #% ya fue anulado y no puede reactivarse ni alterarse.', p_id_pago;
  end if;

  update public.pago
  set estado = v_nuevo_estado
  where id_pago = p_id_pago
  returning * into v_updated;

  if v_nuevo_estado = 'aprobado' and v_contrato.estado = 'pendiente' then
    update public.membresia_socio
    set estado = 'activa'
    where id_membresia_socio = v_contrato.id_membresia_socio;
  end if;

  return v_updated;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: Registrar ingreso de asistencia (modelo simplificado socio + sucursal)
--    SECURITY DEFINER: impide bypass directo vía PostgREST INSERT.
-- ----------------------------------------------------------------------------
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

    -- Solo dueño del gimnasio o administrador/recepcionista asignado a esta sucursal (excluye entrenador)
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

  -- Serializar solicitudes simultáneas bloqueando la fila del socio
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

  -- Consultar dinámicamente membresía activa y vigente en el gimnasio de la sucursal
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

-- ----------------------------------------------------------------------------
-- 6. RPC: Registrar salida de asistencia abierta (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 7. RPC: Anular lógicamente una asistencia (solo dueño/admin/recepcionista)
-- ----------------------------------------------------------------------------
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
-- 8. RPC: Reordenar ejercicios de una rutina atómicamente (SECURITY INVOKER + RLS)
-- ----------------------------------------------------------------------------
create or replace function public.rpc_reordenar_rutina_ejercicios(
  p_id_rutina bigint,
  p_ids_ordenados bigint[]
)
returns setof public.rutina_ejercicio
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
  if p_id_rutina is null then
    raise exception 'Debes indicar la rutina a reordenar.';
  end if;

  if p_ids_ordenados is null or pg_catalog.array_length(p_ids_ordenados, 1) is null then
    raise exception 'Debes proporcionar la lista ordenada de ejercicios.';
  end if;

  select count(distinct x) into v_distintos
  from pg_catalog.unnest(p_ids_ordenados) as x;

  if v_distintos <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'La lista ordenada contiene identificadores de ejercicio duplicados.';
  end if;

  -- Verifica permisos vía RLS sobre public.rutina (excluye recepcionistas y terceros)
  if not exists (select 1 from public.rutina r where r.id_rutina = p_id_rutina) then
    raise exception 'Rutina #% no encontrada o sin permisos.', p_id_rutina;
  end if;

  select count(*) into v_total
  from public.rutina_ejercicio
  where id_rutina = p_id_rutina;

  if v_total <> pg_catalog.array_length(p_ids_ordenados, 1) then
    raise exception 'La cantidad de ejercicios enviados (%) no coincide con los ejercicios de la rutina (%).',
      pg_catalog.array_length(p_ids_ordenados, 1), v_total;
  end if;

  update public.rutina_ejercicio
  set orden = orden + 100000
  where id_rutina = p_id_rutina;

  v_idx := 1;
  foreach v_item_id in array p_ids_ordenados loop
    update public.rutina_ejercicio
    set orden = v_idx
    where id_rutina = p_id_rutina
      and id_rutina_ejercicio = v_item_id;

    if not found then
      raise exception 'El registro rutina_ejercicio #% no pertenece a la rutina #%.', v_item_id, p_id_rutina;
    end if;

    v_idx := v_idx + 1;
  end loop;

  return query
  select *
  from public.rutina_ejercicio
  where id_rutina = p_id_rutina
  order by orden asc;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Trigger: Validar compatibilidad de ejercicio al agregarlo a una rutina
-- ----------------------------------------------------------------------------
create or replace function public.trg_fn_validar_ejercicio_en_rutina()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_rutina_socio bigint;
  v_ej_socio bigint;
  v_ej_gimnasio bigint;
  v_autorizado boolean;
  v_uid uuid := auth.uid();
begin
  select r.id_socio into v_rutina_socio
  from public.rutina r
  where r.id_rutina = new.id_rutina;

  if v_rutina_socio is null then
    raise exception 'La rutina #% no existe.', new.id_rutina;
  end if;

  select e.id_socio, e.id_gimnasio
  into v_ej_socio, v_ej_gimnasio
  from public.ejercicio e
  where e.id_ejercicio = new.id_ejercicio;

  if v_ej_socio is null and v_ej_gimnasio is null then
    raise exception 'El ejercicio #% no existe.', new.id_ejercicio;
  end if;

  if v_ej_socio is not null then
    if v_ej_socio <> v_rutina_socio then
      raise exception 'No puedes incorporar a la rutina un ejercicio personal perteneciente a otro socio.';
    end if;
    return new;
  end if;

  -- Ejercicio del gimnasio: el socio debe tener relación no cancelada con ese gimnasio
  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = v_rutina_socio
      and ms.id_gimnasio = v_ej_gimnasio
      and ms.estado <> 'cancelada'
  ) into v_autorizado;

  if not coalesce(v_autorizado, false) then
    raise exception 'No puedes incorporar un ejercicio de un gimnasio en el que el socio no tiene membresía autorizada.';
  end if;

  -- Si lo inserta staff autenticado (y no es el propio socio), debe pertenecer al mismo gimnasio del ejercicio
  if v_uid is not null and not exists (select 1 from public.socio s where s.id_socio = v_rutina_socio and s.auth_user_id = v_uid) then
    if not (
      exists (
        select 1 from public.gimnasio g join public.dueno d on d.id_dueno = g.id_dueno
        where g.id_gimnasio = v_ej_gimnasio and d.auth_user_id = v_uid
      )
      or exists (
        select 1 from public.empleado e
        join public.empleado_sucursal es on es.id_empleado = e.id_empleado
        join public.sucursal su on su.id_sucursal = es.id_sucursal
        where e.auth_user_id = v_uid
          and e.estado = true
          and es.estado = true
          and su.id_gimnasio = v_ej_gimnasio
          and pg_catalog.lower(es.rol) in ('administrador', 'entrenador')
      )
    ) then
      raise exception 'El ejercicio pertenece a un gimnasio fuera del ámbito autorizado del operador.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_ejercicio_en_rutina on public.rutina_ejercicio;
create trigger trg_validar_ejercicio_en_rutina
before insert or update of id_rutina, id_ejercicio on public.rutina_ejercicio
for each row
execute function public.trg_fn_validar_ejercicio_en_rutina();

-- ----------------------------------------------------------------------------
-- 10. Permisos EXECUTE explícitos sobre funciones de migración 02
-- ----------------------------------------------------------------------------
revoke all on function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) from public, anon;
grant execute on function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) to authenticated, service_role;

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

revoke all on function public.rpc_anular_asistencia(bigint) from public, anon;
grant execute on function public.rpc_anular_asistencia(bigint) to authenticated, service_role;

revoke all on function public.rpc_reordenar_rutina_ejercicios(bigint, bigint[]) from public, anon;
grant execute on function public.rpc_reordenar_rutina_ejercicios(bigint, bigint[]) to authenticated, service_role;

revoke all on function public.trg_fn_validar_ejercicio_en_rutina() from public, anon, authenticated;

commit;
