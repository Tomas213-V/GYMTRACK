-- ==============================================================================
-- FIX: `rpc_registrar_ingreso_asistencia` — Soporte de fecha local Argentina
--      (UTC-3) y promoción automática de membresías 'programada' que inician hoy.
-- ==============================================================================

begin;

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
  v_sucursal public.sucursal%rowtype;
  v_gym_estado boolean;
  v_caller_socio_id bigint;
  v_es_staff boolean := false;
  v_target_socio_id bigint;
  v_socio public.socio%rowtype;
  v_sg_id bigint;
  v_sg_estado boolean;
  v_tiene_membresia boolean := false;
  v_abierta_id bigint;
  v_asistencias_hoy_gym integer := 0;
  v_ahora timestamptz := now();
  v_hoy_ar date := (v_ahora at time zone 'America/Argentina/Buenos_Aires')::date;
  v_dia_inicio timestamptz := (v_hoy_ar::timestamp at time zone 'America/Argentina/Buenos_Aires');
  v_asistencia public.asistencia_socio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para registrar un ingreso.';
  end if;

  if p_id_sucursal is null then
    raise exception 'Debes indicar la sucursal para registrar el ingreso.';
  end if;

  select * into v_sucursal from public.sucursal where id_sucursal = p_id_sucursal for share;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('asistencia_socio_gym'),
    pg_catalog.hashtext(v_target_socio_id::text || ':' || v_sucursal.id_gimnasio::text)
  );

  select * into v_socio from public.socio where id_socio = v_target_socio_id for share;
  if not found or not v_socio.estado then
    raise exception 'Socio no encontrado o inactivo.';
  end if;

  select sg.id_socio_gimnasio, sg.estado into v_sg_id, v_sg_estado
  from public.socio_gimnasio sg
  where sg.id_socio = v_target_socio_id
    and sg.id_gimnasio = v_sucursal.id_gimnasio
  for update;

  if not found or coalesce(v_sg_estado, false) = false then
    raise exception 'El socio no posee una asociación socio_gimnasio activa en el gimnasio de esta sucursal.';
  end if;

  -- Promover automáticamente cualquier renovación 'programada' cuya vigencia ya comenzó hoy (hora AR)
  update public.membresia_socio ms
  set estado = 'activa'
  where ms.id_socio_gimnasio = v_sg_id
    and ms.id_gimnasio = v_sucursal.id_gimnasio
    and ms.estado = 'programada'
    and v_hoy_ar between ms.fecha_inicio and ms.fecha_vencimiento;

  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_sg_id
      and ms.id_gimnasio = v_sucursal.id_gimnasio
      and ms.estado in ('activa', 'programada')
      and v_hoy_ar between ms.fecha_inicio and ms.fecha_vencimiento
  ) into v_tiene_membresia;

  if not v_tiene_membresia then
    raise exception 'El socio no cuenta con una membresía activa y vigente en el gimnasio de esta sucursal.';
  end if;

  select a.id_asistencia_socio into v_abierta_id
  from public.asistencia_socio a
  join public.sucursal s on s.id_sucursal = a.id_sucursal
  where a.id_socio = v_target_socio_id
    and s.id_gimnasio = v_sucursal.id_gimnasio
    and a.estado = 'presente'
    and a.hora_salida is null
  limit 1;

  if v_abierta_id is not null then
    raise exception 'Ya existe un ingreso en curso en este gimnasio (asistencia #%). Debes registrar la salida antes de volver a ingresar.', v_abierta_id;
  end if;

  select count(*) into v_asistencias_hoy_gym
  from public.asistencia_socio a
  join public.sucursal s on s.id_sucursal = a.id_sucursal
  where a.id_socio = v_target_socio_id
    and s.id_gimnasio = v_sucursal.id_gimnasio
    and a.estado <> 'anulada'
    and a.hora_ingreso >= v_dia_inicio
    and a.hora_ingreso < v_dia_inicio + interval '1 day';

  if v_asistencias_hoy_gym >= 3 then
    raise exception 'El socio ya alcanzó el límite máximo de 3 asistencias diarias en este gimnasio.';
  end if;

  insert into public.asistencia_socio (id_socio, id_sucursal, hora_ingreso, estado)
  values (v_target_socio_id, v_sucursal.id_sucursal, v_ahora, 'presente')
  returning * into v_asistencia;

  return v_asistencia;
end;
$$;

commit;
