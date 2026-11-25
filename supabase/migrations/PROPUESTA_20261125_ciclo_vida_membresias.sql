-- ==============================================================================
-- PROPUESTA DE SCRIPT SQL PARA REVISIÓN Y EJECUCIÓN MANUAL EN SUPABASE
-- PROYECTO: GYMTRACK — CORRECCIÓN DEL CICLO DE VIDA DE MEMBRESÍAS
-- ==============================================================================
-- IMPORTANTE:
--   1. NO crea tablas nuevas: `public.membresia_socio` sigue siendo la única tabla
--      de contrataciones (cada renovación crea una fila nueva conservando el historial).
--   2. NO elimina contrataciones históricas ni modifica/borra registros de `public.pago`.
--   3. Ejecutar primero el PASO 0 (diagnóstico solo lectura) para verificar si ya
--      existen períodos superpuestos heredados (ej: 24/11/2026–22/02/2027 vs
--      25/11/2026–25/11/2027) y resolverlos antes de crear la restricción EXCLUDE.
-- ==============================================================================

-- ==============================================================================
-- PASO 0 (SOLO LECTURA — DIAGNÓSTICO DE SOLAPAMIENTOS HEREDADOS)
-- Ejecutar primero para detectar contrataciones superpuestas existentes.
-- ==============================================================================
select
  a.id_gimnasio,
  a.id_socio_gimnasio,
  sg.id_socio,
  s.nombre,
  s.apellido,
  s.dni,
  a.id_membresia_socio as contrato_a,
  a.estado as estado_a,
  a.fecha_inicio as inicio_a,
  a.fecha_vencimiento as venc_a,
  b.id_membresia_socio as contrato_b,
  b.estado as estado_b,
  b.fecha_inicio as inicio_b,
  b.fecha_vencimiento as venc_b
from public.membresia_socio a
join public.membresia_socio b
  on a.id_socio_gimnasio = b.id_socio_gimnasio
 and a.id_gimnasio = b.id_gimnasio
 and a.id_membresia_socio < b.id_membresia_socio
join public.socio_gimnasio sg on sg.id_socio_gimnasio = a.id_socio_gimnasio
join public.socio s on s.id_socio = sg.id_socio
where a.estado in ('activa', 'programada')
  and b.estado in ('activa', 'programada')
  and daterange(a.fecha_inicio, a.fecha_vencimiento, '[]')
      && daterange(b.fecha_inicio, b.fecha_vencimiento, '[]')
order by a.id_gimnasio, a.id_socio_gimnasio, a.fecha_inicio;

-- ==============================================================================
-- NOTA DE SANEAMIENTO MANUAL (SI EL PASO 0 DEVUELVE FILAS):
-- Antes de aplicar el constraint `excl_membresia_socio_sin_solapamiento`, cada
-- par superpuesto existente debe resolverse SIN eliminar filas ni pagos.
-- Opciones recomendadas según el caso de negocio:
--   Opción A (si una contratación fue duplicada por error): cancelarla lógicamente:
--     select public.rpc_actualizar_estado_membresia(<id_contrato_duplicado>, 'cancelada', null);
--   Opción B (si ambas fueron pagadas y corresponden a una renovación anticipada):
--     re-encadenar la segunda contratación como 'programada' iniciando el día
--     siguiente al vencimiento de la primera (requiere ejecutar con rol postgres/
--     service_role por `trg_proteger_membresia_socio_inmutable`), conservando su
--     pago original vinculado a su `id_membresia_socio`.
-- ==============================================================================

-- ==============================================================================
-- PASO 1: EXTENSIÓN, ESTADOS ('programada') Y RESTRICCIÓN ANTI-SOLAPAMIENTO
-- ==============================================================================
begin;

create extension if not exists btree_gist;

-- 1.1. Ampliar el CHECK de `estado` en `public.membresia_socio` para incluir 'programada'
do $$
declare
  v_constraint_name text;
begin
  select c.conname into v_constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'membresia_socio'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%estado%'
    and pg_get_constraintdef(c.oid) ilike '%pendiente%';

  if v_constraint_name is not null then
    execute format('alter table public.membresia_socio drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.membresia_socio
  add constraint ck_membresia_socio_estado
  check (estado in ('pendiente', 'programada', 'activa', 'vencida', 'cancelada'));

-- 1.2. Normalizar contrataciones existentes antes de crear el EXCLUDE constraint:
--   - Contrataciones 'activa' ya vencidas -> 'vencida'
--   - Contrataciones 'activa' con fecha_inicio futura -> 'programada'
update public.membresia_socio
set estado = 'vencida'
where estado in ('activa', 'programada')
  and fecha_vencimiento < current_date;

update public.membresia_socio
set estado = 'programada'
where estado = 'activa'
  and fecha_inicio > current_date
  and fecha_vencimiento >= current_date;

-- 1.3. Garantía física en PostgreSQL contra períodos superpuestos bajo concurrencia
--      para una misma asociación socio-gimnasio.
alter table public.membresia_socio
  drop constraint if exists excl_membresia_socio_sin_solapamiento;

alter table public.membresia_socio
  add constraint excl_membresia_socio_sin_solapamiento
  exclude using gist (
    id_socio_gimnasio with =,
    id_gimnasio with =,
    daterange(fecha_inicio, fecha_vencimiento, '[]') with &&
  )
  where (estado in ('activa', 'programada'));

-- ==============================================================================
-- PASO 2: FUNCIÓN AUXILIAR DE ESTADO EFECTIVO Y SINCRONIZACIÓN
-- ==============================================================================

create or replace function public.fn_estado_efectivo_membresia(
  p_estado varchar,
  p_fecha_inicio date,
  p_fecha_vencimiento date,
  p_hoy date default current_date
)
returns varchar
language sql
immutable
as $$
  select case
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, ''))) = 'cancelada' then 'cancelada'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, ''))) = 'pendiente' then 'pendiente'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, ''))) = 'vencida'
         or p_fecha_vencimiento < p_hoy then 'vencida'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, ''))) in ('activa', 'programada')
         and p_fecha_inicio > p_hoy then 'programada'
    when pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, ''))) in ('activa', 'programada') then 'activa'
    else pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'pendiente')))
  end;
$$;

create or replace function public.rpc_sincronizar_estados_membresias(
  p_id_gimnasio bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_vencidas integer := 0;
  v_activadas integer := 0;
begin
  update public.membresia_socio
  set estado = 'vencida'
  where (p_id_gimnasio is null or id_gimnasio = p_id_gimnasio)
    and estado in ('activa', 'programada')
    and fecha_vencimiento < current_date;
  get diagnostics v_vencidas = row_count;

  update public.membresia_socio
  set estado = 'activa'
  where (p_id_gimnasio is null or id_gimnasio = p_id_gimnasio)
    and estado = 'programada'
    and fecha_inicio <= current_date
    and fecha_vencimiento >= current_date;
  get diagnostics v_activadas = row_count;

  return jsonb_build_object(
    'marcadas_vencidas', v_vencidas,
    'promovidas_a_activa', v_activadas
  );
end;
$$;

-- ==============================================================================
-- PASO 3: ACTUALIZACIÓN DE RPCs DEL CICLO DE VIDA (CON BLOQUEO Y ANTI-SOLAPAMIENTO)
-- ==============================================================================

-- 3.1. rpc_contratar_membresia:
--   - Serializa por `socio_gimnasio FOR UPDATE`.
--   - Encadena `v_fecha_inicio := v_max_vencimiento + 1` tanto para contrataciones
--     'activa' como para solicitudes 'pendiente' cuando ya existe membresía vigente/programada.
--   - Asigna 'programada' (y NO 'activa') cuando `v_fecha_inicio > current_date`.
--   - Valida no solapamiento contra todas las contrataciones `estado in ('activa', 'programada')`.
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
  v_fecha_inicio date := coalesce(p_fecha_inicio, current_date);
  v_fecha_vencimiento date;
  v_max_vencimiento date;
  v_estado_solicitado varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado, 'activa')));
  v_estado_contrato_inicial varchar(20);
  v_estado_pago varchar(20) := pg_catalog.lower(pg_catalog.btrim(coalesce(p_estado_pago, 'aprobado')));
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

  if v_estado_solicitado not in ('pendiente', 'activa', 'programada') then
    raise exception 'Estado inicial de membresía inválido (%). Solo se permite pendiente, activa o programada.', v_estado_solicitado;
  end if;

  if coalesce(p_registrar_pago, false) and v_estado_pago not in ('pendiente', 'aprobado', 'rechazado') then
    raise exception 'Estado inicial de pago inválido: %', v_estado_pago;
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

  if coalesce(p_registrar_pago, false) and v_estado_pago <> 'aprobado' and v_estado_solicitado in ('activa', 'programada') then
    raise exception 'No se puede activar una contratación si el pago inicial registrado tiene estado "%".', v_estado_pago;
  end if;

  -- Orden canónico de bloqueos contra concurrencia: socio -> socio_gimnasio
  select * into v_socio
  from public.socio
  where id_socio = p_id_socio
  for update;

  if not found or not v_socio.estado then
    raise exception 'El socio (%) no existe o se encuentra inactivo.', p_id_socio;
  end if;

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

  -- Normalizar contrataciones ya vencidas de esta asociación antes de calcular encadenamiento
  update public.membresia_socio
  set estado = 'vencida'
  where id_socio_gimnasio = v_assoc.id_socio_gimnasio
    and id_gimnasio = v_plan.id_gimnasio
    and estado in ('activa', 'programada')
    and fecha_vencimiento < current_date;

  -- Promover programadas cuyo inicio ya llegó hoy
  update public.membresia_socio
  set estado = 'activa'
  where id_socio_gimnasio = v_assoc.id_socio_gimnasio
    and id_gimnasio = v_plan.id_gimnasio
    and estado = 'programada'
    and fecha_inicio <= current_date
    and fecha_vencimiento >= current_date;

  if v_estado_solicitado = 'pendiente' and exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado = 'pendiente'
  ) then
    raise exception 'Ya existe una solicitud de membresía pendiente para esta asociación socio-gimnasio.';
  end if;

  -- Encadenamiento obligatorio TANTO para contrataciones 'activa'/'programada' COMO para solicitudes 'pendiente':
  -- conserva todos los días restantes de la contratación vigente/programada anterior.
  select max(ms.fecha_vencimiento) into v_max_vencimiento
  from public.membresia_socio ms
  where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
    and ms.id_gimnasio = v_plan.id_gimnasio
    and ms.estado in ('activa', 'programada')
    and ms.fecha_vencimiento >= current_date;

  if v_max_vencimiento is not null and v_fecha_inicio <= v_max_vencimiento then
    v_fecha_inicio := (v_max_vencimiento + 1);
  end if;

  v_fecha_vencimiento := v_fecha_inicio + v_plan.duracion_dias;

  -- Validación explícita anti-solapamiento contra toda contratación vigente o programada
  if exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio_gimnasio = v_assoc.id_socio_gimnasio
      and ms.id_gimnasio = v_plan.id_gimnasio
      and ms.estado in ('activa', 'programada')
      and ms.fecha_inicio <= v_fecha_vencimiento
      and ms.fecha_vencimiento >= v_fecha_inicio
  ) then
    raise exception 'Ya existe una membresía activa o programada en el rango % a % para esta asociación.', v_fecha_inicio, v_fecha_vencimiento;
  end if;

  -- Determinación determinística del estado en servidor (Reglas 5 y 9):
  if v_estado_solicitado = 'pendiente' or (coalesce(p_registrar_pago, false) and v_estado_pago <> 'aprobado') then
    v_estado_contrato_inicial := 'pendiente';
  elsif v_fecha_vencimiento < current_date then
    v_estado_contrato_inicial := 'vencida';
  elsif v_fecha_inicio > current_date then
    v_estado_contrato_inicial := 'programada';
  else
    v_estado_contrato_inicial := 'activa';
  end if;

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

-- 3.2. rpc_registrar_pago:
--   - Serializa sobre `socio_gimnasio FOR UPDATE` al activar una contratación pendiente.
--   - Valida no solapamiento antes de activar y asigna 'programada' si `fecha_inicio > current_date`.
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
  v_estado_destino varchar(20);
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

  select ms.* into v_contrato
  from public.membresia_socio ms
  where ms.id_membresia_socio = p_id_membresia_socio;

  if not found then
    raise exception 'La contratación #% no existe.', p_id_membresia_socio;
  end if;

  -- Orden canónico de bloqueo: socio_gimnasio -> membresia_socio
  perform 1 from public.socio_gimnasio where id_socio_gimnasio = v_contrato.id_socio_gimnasio for update;

  select ms.* into v_contrato
  from public.membresia_socio ms
  where ms.id_membresia_socio = p_id_membresia_socio
  for update;

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
  end if;

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

  if v_estado = 'aprobado' and v_contrato.estado = 'pendiente' and (v_total_aprobado + p_monto) >= v_contrato.precio then
    if exists (
      select 1
      from public.membresia_socio ms
      where ms.id_socio_gimnasio = v_contrato.id_socio_gimnasio
        and ms.id_gimnasio = v_contrato.id_gimnasio
        and ms.id_membresia_socio <> v_contrato.id_membresia_socio
        and ms.estado in ('activa', 'programada')
        and ms.fecha_inicio <= v_contrato.fecha_vencimiento
        and ms.fecha_vencimiento >= v_contrato.fecha_inicio
    ) then
      raise exception 'No se puede activar la contratación #% (% a %) porque se superpone con otra membresía activa o programada del socio.',
        v_contrato.id_membresia_socio, v_contrato.fecha_inicio, v_contrato.fecha_vencimiento;
    end if;
  end if;

  insert into public.pago (id_membresia_socio, monto, fecha_pago, metodo_pago, estado, comprobante)
  values (p_id_membresia_socio, p_monto, coalesce(p_fecha_pago, now()), v_metodo, v_estado, v_comprobante)
  returning * into v_pago;

  if v_estado = 'aprobado' then
    v_nuevo_total := v_total_aprobado + p_monto;
    if v_contrato.estado = 'pendiente' and v_nuevo_total >= v_contrato.precio then
      v_estado_destino := case
        when v_contrato.fecha_vencimiento < current_date then 'vencida'
        when v_contrato.fecha_inicio > current_date then 'programada'
        else 'activa'
      end;

      update public.membresia_socio
      set estado = v_estado_destino
      where id_membresia_socio = v_contrato.id_membresia_socio;
    end if;
  end if;

  return v_pago;
end;
$$;

-- 3.3. rpc_actualizar_estado_pago:
--   - Mismo control de bloqueo, anti-solapamiento y estado 'programada' al aprobar un pago pendiente,
--     y reversión consistente al anular un pago aprobado sobre contrato 'activa' o 'programada'.
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
  v_id_socio_gimnasio bigint;
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

  select p.id_membresia_socio, ms.id_socio_gimnasio
  into v_id_membresia_socio, v_id_socio_gimnasio
  from public.pago p
  join public.membresia_socio ms on ms.id_membresia_socio = p.id_membresia_socio
  where p.id_pago = p_id_pago;

  if not found then
    raise exception 'El pago #% no existe.', p_id_pago;
  end if;

  -- Orden canónico de bloqueos: socio_gimnasio -> membresia_socio -> pago
  perform 1 from public.socio_gimnasio where id_socio_gimnasio = v_id_socio_gimnasio for update;

  select * into v_contrato
  from public.membresia_socio
  where id_membresia_socio = v_id_membresia_socio
  for update;

  select * into v_pago from public.pago where id_pago = p_id_pago for update;

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
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para modificar este pago.';
    end if;
  end if;

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
    raise exception 'Un pago rechazado solo puede transicionar a anulado (intentado: %); genere un nuevo registro para reintentar.', v_nuevo_estado;
  end if;

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

    if v_contrato.estado = 'pendiente' and (v_total_otros_aprobados + v_pago.monto) >= v_contrato.precio then
      if exists (
        select 1
        from public.membresia_socio ms
        where ms.id_socio_gimnasio = v_contrato.id_socio_gimnasio
          and ms.id_gimnasio = v_contrato.id_gimnasio
          and ms.id_membresia_socio <> v_contrato.id_membresia_socio
          and ms.estado in ('activa', 'programada')
          and ms.fecha_inicio <= v_contrato.fecha_vencimiento
          and ms.fecha_vencimiento >= v_contrato.fecha_inicio
      ) then
        raise exception 'No se puede aprobar el pago #% porque la contratación #% se superpone con otra membresía vigente o programada.',
          p_id_pago, v_contrato.id_membresia_socio;
      end if;
    end if;
  end if;

  update public.pago
  set estado = v_nuevo_estado
  where id_pago = p_id_pago
  returning * into v_updated;

  select coalesce(sum(p.monto), 0) into v_total_final_aprobado
  from public.pago p
  where p.id_membresia_socio = v_contrato.id_membresia_socio
    and p.estado = 'aprobado';

  if v_nuevo_estado = 'aprobado'
     and v_contrato.estado = 'pendiente'
     and v_total_final_aprobado >= v_contrato.precio then
    update public.membresia_socio
    set estado = case
      when fecha_vencimiento < current_date then 'vencida'
      when fecha_inicio > current_date then 'programada'
      else 'activa'
    end
    where id_membresia_socio = v_contrato.id_membresia_socio;
  elsif v_pago.estado = 'aprobado'
        and v_nuevo_estado = 'anulado'
        and v_contrato.estado in ('activa', 'programada')
        and v_total_final_aprobado < v_contrato.precio then
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

-- 3.4. rpc_actualizar_estado_membresia:
--   - Serializa sobre `socio_gimnasio FOR UPDATE`.
--   - Bloquea superposiciones al activar o extender `fecha_vencimiento`.
--   - Normaliza estado 'programada' si `fecha_inicio > current_date` y bloquea activar vencidas.
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
  where id_membresia_socio = p_id_membresia_socio;

  if not found then
    raise exception 'La contratación #% no existe.', p_id_membresia_socio;
  end if;

  perform 1 from public.socio_gimnasio where id_socio_gimnasio = v_contrato.id_socio_gimnasio for update;

  select * into v_contrato
  from public.membresia_socio
  where id_membresia_socio = p_id_membresia_socio
  for update;

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

  if v_nuevo_estado not in ('pendiente', 'programada', 'activa', 'vencida', 'cancelada') then
    raise exception 'Estado de membresía inválido: %', v_nuevo_estado;
  end if;

  if v_nueva_fecha_venc < v_contrato.fecha_inicio then
    raise exception 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.';
  end if;

  if v_contrato.estado = 'cancelada' and v_nuevo_estado <> 'cancelada' then
    raise exception 'Una contratación cancelada no puede reactivarse; registre una nueva contratación.';
  end if;

  if v_nuevo_estado in ('activa', 'programada') then
    if v_nueva_fecha_venc < current_date then
      raise exception 'No se puede establecer estado activo/programado sobre una contratación cuya fecha de vencimiento ya pasó.';
    end if;

    if v_contrato.estado = 'pendiente' and v_contrato.precio > 0 then
      select coalesce(sum(p.monto), 0) into v_total_aprobado
      from public.pago p
      where p.id_membresia_socio = v_contrato.id_membresia_socio
        and p.estado = 'aprobado';

      if v_total_aprobado < v_contrato.precio then
        raise exception 'No se puede activar la membresía #% sin pagos aprobados que cubran el importe (% / %).',
          v_contrato.id_membresia_socio, v_total_aprobado, v_contrato.precio;
      end if;
    end if;

    -- Regla 5: si el inicio es futuro, debe quedar como 'programada' (no 'activa')
    if v_contrato.fecha_inicio > current_date then
      v_nuevo_estado := 'programada';
    else
      v_nuevo_estado := 'activa';
    end if;

    -- Validación anti-solapamiento con otras contrataciones vigentes/programadas del mismo socio-gimnasio
    if exists (
      select 1
      from public.membresia_socio ms
      where ms.id_socio_gimnasio = v_contrato.id_socio_gimnasio
        and ms.id_gimnasio = v_contrato.id_gimnasio
        and ms.id_membresia_socio <> v_contrato.id_membresia_socio
        and ms.estado in ('activa', 'programada')
        and ms.fecha_inicio <= v_nueva_fecha_venc
        and ms.fecha_vencimiento >= v_contrato.fecha_inicio
    ) then
      raise exception 'La actualización generaría un período superpuesto (% a %) con otra membresía vigente o programada del socio.',
        v_contrato.fecha_inicio, v_nueva_fecha_venc;
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

-- 3.5. Compatibilidad de check-in en `rpc_registrar_ingreso_asistencia`:
--      asegurar que una contratación 'programada' que inicia hoy habilite el ingreso
--      automáticamente sin depender de un cron externo.
-- (Se sugiere actualizar el `where` de membresía vigente en `rpc_registrar_ingreso_asistencia`
--  de `ms.estado = 'activa'` a `ms.estado in ('activa', 'programada')` junto a
--  `and current_date between ms.fecha_inicio and ms.fecha_vencimiento`.)

commit;
