-- ============================================================================
-- MIGRACIÓN 08: RLS, TRIGGERS Y RPCs PARA EL ROL EMPLEADO (6 MÓDULOS OPERATIVOS)
-- ============================================================================
-- Compatible con: supabase/01_instalacion_definitiva.sql (modelo definitivo N:M
-- sin columna id_gimnasio en public.empleado; vínculo vía empleado_sucursal -> sucursal).
--
-- Alcance:
--   1. Habilita a cualquier empleado activo del gimnasio (`administrador`,
--      `recepcionista`, `entrenador` en `public.empleado_sucursal`) a operar
--      (SELECT, INSERT, UPDATE directo o vía RPC) sobre los 6 apartados operativos
--      filtrados estrictamente por su `id_gimnasio` / sucursal asignada:
--        - Socios (`socio`, `socio_gimnasio`)
--        - Rutinas (`rutina_gimnasio`, `rutina_ejercicio_gimnasio`, `rutinas_asignadas_socio_gimnasio`)
--        - Ejercicios (`ejercicio_gimnasio`)
--        - Pagos y Membresías (`membresia_socio`, `pago`, lectura de `membresia_gimnasio`)
--        - Asistencia (`asistencia_socio`, lectura de `sucursal`)
--        - Perfil propio (`empleado`: SELECT y UPDATE sobre auth_user_id = auth.uid())
--   2. Bloquea escrituras administrativas exclusivas del Dueño / Administrador
--      Organizacional (`membresia_gimnasio`, `sucursal`, `gimnasio`, `empleado_sucursal`,
--      padrón de otros empleados) y evita borrados físicos de rutinas/ejercicios por empleados.
-- ============================================================================

begin;

-- ============================================================================
-- 1. FUNCIONES AUXILIARES RLS
-- ============================================================================

create or replace function public.fn_staff_puede_ver_empleado(p_id_empleado bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.empleado_sucursal es
    join public.sucursal s on s.id_sucursal = es.id_sucursal
    where es.id_empleado = p_id_empleado
      and (
        public.fn_dueno_posee_gimnasio(s.id_gimnasio)
        or public.fn_admin_posee_gimnasio(s.id_gimnasio)
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
      or public.fn_empleado_en_sucursal(p_id_sucursal, array['administrador', 'recepcionista', 'entrenador'])
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
        or public.fn_empleado_en_gimnasio(sg.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
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
        or public.fn_empleado_en_gimnasio(sg.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
      )
  );
$$;

-- ============================================================================
-- 2. TRIGGERS DE PROTECCIÓN Y VALIDACIÓN
-- ============================================================================

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
    if not (
      old.auth_user_id is null
      and new.auth_user_id is not null
      and new.auth_user_id = v_uid
      and exists (
        select 1
        from auth.users u
        where u.id = v_uid
          and u.email_confirmed_at is not null
          and pg_catalog.lower(pg_catalog.btrim(u.email)) = pg_catalog.lower(pg_catalog.btrim(old.email))
      )
    ) then
      raise exception 'No tienes autorización para modificar auth_user_id del socio.';
    end if;
  end if;

  if new.fecha_alta is distinct from old.fecha_alta then
    raise exception 'No se puede modificar la fecha de alta administrativa del socio.';
  end if;

  if new.estado is distinct from old.estado then
    select public.fn_staff_puede_gestionar_socio(old.id_socio) into v_es_autorizado;
    if not coalesce(v_es_autorizado, false) then
      raise exception 'Solo el dueño, administrador o empleado autorizado del gimnasio puede cambiar el estado del socio.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.trg_fn_validar_rutina_asignada()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sg_estado boolean;
  v_rg_estado boolean;
  v_emp_estado boolean;
  v_ok boolean;
  v_validar_responsable_activo boolean := false;
begin
  if tg_op = 'UPDATE' and (
    new.id_rutina_asignada is distinct from old.id_rutina_asignada
    or new.id_rutina_gimnasio is distinct from old.id_rutina_gimnasio
    or new.id_socio_gimnasio is distinct from old.id_socio_gimnasio
    or new.id_gimnasio is distinct from old.id_gimnasio
    or new.fecha_asignacion is distinct from old.fecha_asignacion
    or new.creado_en is distinct from old.creado_en
  ) then
    raise exception 'No se puede reasignar la rutina, socio o gimnasio de una asignación existente.';
  end if;

  if new.estado = true then
    select rg.estado into v_rg_estado
    from public.rutina_gimnasio rg
    where rg.id_rutina_gimnasio = new.id_rutina_gimnasio
      and rg.id_gimnasio = new.id_gimnasio
    for share;
    if coalesce(v_rg_estado, false) = false then
      raise exception 'La rutina_gimnasio no está activa.';
    end if;

    select sg.estado into v_sg_estado
    from public.socio_gimnasio sg
    where sg.id_socio_gimnasio = new.id_socio_gimnasio
      and sg.id_gimnasio = new.id_gimnasio
    for share;
    if coalesce(v_sg_estado, false) = false then
      raise exception 'La asociación socio_gimnasio no está activa.';
    end if;
  end if;

  if new.id_empleado_responsable is not null then
    if tg_op = 'INSERT' then
      v_validar_responsable_activo := true;
    elsif new.id_empleado_responsable is distinct from old.id_empleado_responsable
          or new.estado = true then
      v_validar_responsable_activo := true;
    end if;

    if v_validar_responsable_activo then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('lock_empleado_integridad'),
        pg_catalog.hashtext(new.id_empleado_responsable::text)
      );

      select e.estado into v_emp_estado
      from public.empleado e
      where e.id_empleado = new.id_empleado_responsable
      for share;

      if not found or coalesce(v_emp_estado, false) = false then
        raise exception 'Empleado responsable inválido o inactivo.';
      end if;

      perform 1
      from public.empleado_sucursal es
      join public.sucursal s on s.id_sucursal = es.id_sucursal
      where es.id_empleado = new.id_empleado_responsable
        and es.estado = true
        and s.id_gimnasio = new.id_gimnasio
        and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
      limit 1
      for share of es, s;
      v_ok := found;

      if not coalesce(v_ok, false) then
        raise exception 'Empleado responsable debe tener asignación activa en este gimnasio.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 3. POLÍTICAS RLS POR TABLA
-- ============================================================================

-- 3a. public.empleado y public.empleado_sucursal: empleado solo lee/actualiza su propio perfil
drop policy if exists empleado_sucursal_select_authorized on public.empleado_sucursal;
create policy empleado_sucursal_select_authorized on public.empleado_sucursal
  for select to authenticated
  using (
    id_empleado = public.fn_current_empleado_id()
    or public.fn_dueno_posee_sucursal(id_sucursal)
    or public.fn_admin_posee_sucursal(id_sucursal)
  );

-- 3b. public.membresia_gimnasio (planes): solo lectura para empleados; escritura exclusiva dueño/admin org
drop policy if exists plan_write_dueno_o_admin on public.membresia_gimnasio;
create policy plan_write_dueno_o_admin on public.membresia_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
  );

-- 3c. public.pago: lectura para cualquier empleado activo del gimnasio (escrituras vía RPC)
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
          or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
        )
    )
  );

-- 3d. public.ejercicio_gimnasio: SELECT/INSERT/UPDATE para empleados activos; DELETE solo dueño/admin org
drop policy if exists ejercicio_gimnasio_write_authorized on public.ejercicio_gimnasio;
drop policy if exists ejercicio_gimnasio_insert_authorized on public.ejercicio_gimnasio;
drop policy if exists ejercicio_gimnasio_update_authorized on public.ejercicio_gimnasio;
drop policy if exists ejercicio_gimnasio_delete_dueno_o_admin on public.ejercicio_gimnasio;

create policy ejercicio_gimnasio_insert_authorized on public.ejercicio_gimnasio
  for insert to authenticated
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

create policy ejercicio_gimnasio_update_authorized on public.ejercicio_gimnasio
  for update to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

create policy ejercicio_gimnasio_delete_dueno_o_admin on public.ejercicio_gimnasio
  for delete to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
  );

-- 3e. public.rutina_gimnasio: SELECT/INSERT/UPDATE para empleados activos; DELETE solo dueño/admin org
drop policy if exists rutina_gimnasio_select_authorized on public.rutina_gimnasio;
create policy rutina_gimnasio_select_authorized on public.rutina_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
    or exists (
      select 1
      from public.rutinas_asignadas_socio_gimnasio ra
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ra.id_socio_gimnasio
      where ra.id_rutina_gimnasio = rutina_gimnasio.id_rutina_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists rutina_gimnasio_write_authorized on public.rutina_gimnasio;
drop policy if exists rutina_gimnasio_insert_authorized on public.rutina_gimnasio;
drop policy if exists rutina_gimnasio_update_authorized on public.rutina_gimnasio;
drop policy if exists rutina_gimnasio_delete_dueno_o_admin on public.rutina_gimnasio;

create policy rutina_gimnasio_insert_authorized on public.rutina_gimnasio
  for insert to authenticated
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

create policy rutina_gimnasio_update_authorized on public.rutina_gimnasio
  for update to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

create policy rutina_gimnasio_delete_dueno_o_admin on public.rutina_gimnasio
  for delete to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
  );

-- 3f. public.rutina_ejercicio_gimnasio: gestión completa de ejercicios dentro de plantillas del gimnasio
drop policy if exists reg_select_authorized on public.rutina_ejercicio_gimnasio;
create policy reg_select_authorized on public.rutina_ejercicio_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
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
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

-- 3g. public.rutinas_asignadas_socio_gimnasio: lectura para empleados activos (escrituras vía RPC)
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
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

-- ============================================================================
-- 4. RPCs TRANSACCIONALES HARDENED (HABILITADAS PARA CUALQUIER EMPLEADO ACTIVO)
-- ============================================================================

-- 4a. Asociar socio a gimnasio
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
          and su.id_gimnasio = p_id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

-- 4b. Cambiar estado asociación socio_gimnasio (baja lógica / reactivación)
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
          and su.id_gimnasio = v_assoc.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

-- 4c. Registrar socio en gimnasio
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
          and su.id_gimnasio = p_id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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
    select * into v_socio_email from public.socio s where pg_catalog.lower(pg_catalog.btrim(s.email)) = v_clean_email limit 1;
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

  v_assoc := public.rpc_asociar_socio_gimnasio(p_id_gimnasio, v_socio.id_socio);

  if p_id_membresia_gimnasio is not null then
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
  else
    v_res := jsonb_build_object('socio_gimnasio', to_jsonb(v_assoc), 'membresia_socio', null, 'pago', null);
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

-- 4d. Registrar pago
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
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

  insert into public.pago (id_membresia_socio, monto, fecha_pago, metodo_pago, estado, comprobante)
  values (p_id_membresia_socio, p_monto, coalesce(p_fecha_pago, now()), v_metodo, v_estado, v_comprobante)
  returning * into v_pago;

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

-- 4e. Actualizar estado de pago ("Marcar como pagado", rechazar, anular)
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
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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
    set estado = 'activa'
    where id_membresia_socio = v_contrato.id_membresia_socio;
  elsif v_pago.estado = 'aprobado'
        and v_nuevo_estado = 'anulado'
        and v_contrato.estado = 'activa'
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

-- 4f. Contratar / renovar / cambiar plan de membresía
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

  if v_estado_solicitado not in ('pendiente', 'activa') then
    raise exception 'Estado inicial de membresía inválido (%). Solo se permite pendiente o activa.', v_estado_solicitado;
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
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

-- 4g. Actualizar estado de membresía
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
          and su.id_gimnasio = v_contrato.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

-- 4h. Asistencias: ingreso, salida y anulación para cualquier empleado activo asignado a la sucursal
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
  v_asistencias_hoy_gym integer := 0;
  v_ahora timestamptz := now();
  v_dia_inicio timestamptz := pg_catalog.date_trunc('day', v_ahora);
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
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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
      and (
        v_is_service
        or (v_caller_socio_id is not null and a.id_socio = v_caller_socio_id)
        or public.fn_dueno_posee_sucursal(a.id_sucursal)
        or public.fn_admin_posee_sucursal(a.id_sucursal)
        or public.fn_empleado_en_sucursal(a.id_sucursal, array['administrador', 'recepcionista', 'entrenador'])
      )
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
          and es.estado = true
          and es.id_sucursal = v_actual.id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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
          and es.estado = true
          and es.id_sucursal = v_actual.id_sucursal
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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

-- 4i. Rutinas asignadas y reordenamiento para cualquier empleado activo del gimnasio
create or replace function public.rpc_asignar_rutina_gimnasio_socio(
  p_id_rutina_gimnasio bigint,
  p_id_socio_gimnasio bigint,
  p_fecha_finalizacion date default null,
  p_observaciones text default null,
  p_id_empleado_responsable bigint default null
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
  v_responsable_final_id bigint := null;
  v_asignacion public.rutinas_asignadas_socio_gimnasio%rowtype;
begin
  if not v_is_service and v_uid is null then
    raise exception 'Debes iniciar sesión para asignar rutinas.';
  end if;

  if p_id_rutina_gimnasio is null or p_id_socio_gimnasio is null then
    raise exception 'Debes indicar la rutina de gimnasio y la asociación socio_gimnasio.';
  end if;

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
      and su.id_gimnasio = v_rutina.id_gimnasio
      and es.estado = true
      and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
    limit 1;

    if not coalesce(v_es_dueno_o_admin_org, false) and v_emp_autorizante_id is null then
      raise exception 'No tienes autorización para asignar rutinas del gimnasio.';
    end if;
  end if;

  v_responsable_final_id := coalesce(p_id_empleado_responsable, v_emp_autorizante_id);

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
    v_rutina.id_rutina_gimnasio, v_assoc.id_socio_gimnasio, v_rutina.id_gimnasio, v_responsable_final_id,
    current_date, p_fecha_finalizacion, true, nullif(pg_catalog.btrim(p_observaciones), '')
  )
  returning * into v_asignacion;

  return v_asignacion;
end;
$$;

create or replace function public.rpc_reasignar_responsable_rutina_asignada(
  p_id_rutina_asignada bigint,
  p_id_empleado_responsable bigint,
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
    raise exception 'Debes iniciar sesión para reasignar el responsable de una rutina.';
  end if;

  if p_id_rutina_asignada is null or p_id_empleado_responsable is null then
    raise exception 'Debes indicar la asignación y el nuevo empleado responsable.';
  end if;

  select * into v_asig
  from public.rutinas_asignadas_socio_gimnasio
  where id_rutina_asignada = p_id_rutina_asignada
  for update;

  if not found then
    raise exception 'La asignación #% no existe.', p_id_rutina_asignada;
  end if;

  if not v_asig.estado then
    raise exception 'No se puede reasignar el responsable de una rutina ya finalizada (se conserva su responsable histórico).';
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
          and su.id_gimnasio = v_asig.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
      )
    ) into v_autorizado;

    if not coalesce(v_autorizado, false) then
      raise exception 'No tienes autorización para reasignar rutinas en este gimnasio.';
    end if;
  end if;

  update public.rutinas_asignadas_socio_gimnasio
  set id_empleado_responsable = p_id_empleado_responsable,
      observaciones = coalesce(nullif(pg_catalog.btrim(p_observaciones), ''), observaciones)
  where id_rutina_asignada = v_asig.id_rutina_asignada
  returning * into v_updated;

  return v_updated;
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
          and su.id_gimnasio = v_asig.id_gimnasio
          and es.estado = true
          and pg_catalog.lower(es.rol) in ('administrador', 'recepcionista', 'entrenador')
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
      or public.fn_empleado_en_gimnasio(r.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
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

-- ============================================================================
-- 5. PRIVILEGIOS EXECUTE MÍNIMOS
-- ============================================================================

revoke all on function
  public.trg_fn_proteger_campos_socio(),
  public.trg_fn_validar_rutina_asignada()
from public, anon, authenticated;

grant execute on function public.fn_staff_puede_ver_empleado(bigint) to authenticated, service_role;
grant execute on function public.fn_socio_puede_asistir_sucursal(bigint, bigint) to authenticated, service_role;
grant execute on function public.fn_staff_puede_gestionar_socio(bigint) to authenticated, service_role;
grant execute on function public.fn_staff_puede_gestionar_rutinas_socio(bigint) to authenticated, service_role;
grant execute on function public.rpc_asociar_socio_gimnasio(bigint, bigint) to authenticated, service_role;
grant execute on function public.rpc_cambiar_estado_socio_gimnasio(bigint, boolean) to authenticated, service_role;
grant execute on function public.rpc_registrar_socio_gimnasio(bigint, bigint, varchar, varchar, varchar, varchar, varchar, date, varchar, boolean, varchar, numeric) to authenticated, service_role;
grant execute on function public.rpc_registrar_pago(bigint, numeric, varchar, varchar, varchar, timestamptz) to authenticated, service_role;
grant execute on function public.rpc_actualizar_estado_pago(bigint, varchar) to authenticated, service_role;
grant execute on function public.rpc_contratar_membresia(bigint, bigint, date, varchar, boolean, varchar, varchar, varchar, numeric) to authenticated, service_role;
grant execute on function public.rpc_actualizar_estado_membresia(bigint, varchar, date) to authenticated, service_role;
grant execute on function public.rpc_registrar_ingreso_asistencia(bigint, bigint) to authenticated, service_role;
grant execute on function public.rpc_registrar_salida_asistencia(bigint, bigint) to authenticated, service_role;
grant execute on function public.rpc_anular_asistencia(bigint, text) to authenticated, service_role;
grant execute on function public.rpc_asignar_rutina_gimnasio_socio(bigint, bigint, date, text, bigint) to authenticated, service_role;
grant execute on function public.rpc_reasignar_responsable_rutina_asignada(bigint, bigint, text) to authenticated, service_role;
grant execute on function public.rpc_finalizar_rutina_asignada(bigint, date, text) to authenticated, service_role;
grant execute on function public.rpc_reordenar_rutina_gimnasio_ejercicios(bigint, bigint[]) to authenticated, service_role;

commit;

