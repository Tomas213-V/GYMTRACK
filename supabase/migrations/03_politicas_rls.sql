-- ============================================================================
-- MIGRACIÓN ADITIVA 03: Políticas de Row Level Security (RLS), Privilegios de
-- Tabla, Vistas de Catálogo y Endurecimiento de Helpers SECURITY DEFINER.
--
-- Principios:
--   - Sin políticas permisivas genéricas (nunca USING (true) / WITH CHECK (true)).
--   - Sin acceso global a gimnasios ni planes por el solo hecho de ser socio;
--     el catálogo exploratorio se expone únicamente mediante vistas controladas
--     (vw_catalogo_gimnasios, vw_catalogo_planes) con campos públicos acotados.
--   - PostgREST: escrituras sensibles (membresia_socio INSERT, pago INSERT/UPDATE,
--     asistencia_socio INSERT/UPDATE/DELETE) revocadas a authenticated/anon y
--     canalizadas por RPC SECURITY DEFINER protegidas.
--   - Separación estricta de lectura y escritura por rol (dueño, administrador,
--     recepcionista, entrenador, socio).
--   - Manejo condicional seguro de public.progreso si no existiera.
--
-- Ejecutar DESPUÉS de 01 y 02.
-- ============================================================================

begin;

-- ============================================================================
-- 1. FUNCIONES HELPER SECURITY DEFINER (search_path seguro + sin oracle leaks)
-- ============================================================================

create or replace function public.fn_current_dueno_id()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public, auth
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
set search_path = pg_catalog, public, auth
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
set search_path = pg_catalog, public, auth
as $$
  select e.id_empleado
  from public.empleado e
  where e.auth_user_id = auth.uid()
    and e.estado = true
  limit 1;
$$;

create or replace function public.fn_dueno_posee_gimnasio(p_id_gimnasio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
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

create or replace function public.fn_empleado_en_gimnasio(
  p_id_gimnasio bigint,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
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
set search_path = pg_catalog, public, auth
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
      and s.id_gimnasio = e.id_gimnasio
      and (p_roles is null or pg_catalog.lower(es.rol) = any(p_roles))
  );
$$;

drop function if exists public.fn_socio_tiene_gimnasio(bigint);
drop function if exists public.fn_socio_tiene_gimnasio(bigint, text[]);

create or replace function public.fn_socio_tiene_gimnasio(
  p_id_gimnasio bigint,
  p_estados text[] default array['activa', 'pendiente', 'vencida']
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.membresia_socio ms
    join public.socio s on s.id_socio = ms.id_socio
    where s.auth_user_id = auth.uid()
      and ms.id_gimnasio = p_id_gimnasio
      and (p_estados is null or ms.estado = any(p_estados))
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
  -- Solo responde si el llamador es el propio socio o dueño/staff autorizado de esa sucursal (evita oráculo por RPC directa)
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

-- Lectura de socios por parte del staff del gimnasio
create or replace function public.fn_staff_puede_ver_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = p_id_socio
      and (
        public.fn_dueno_posee_gimnasio(ms.id_gimnasio)
        or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
      )
  );
$$;

-- Escritura de datos personales permitidos de socios (EXCLUYE entrenador)
create or replace function public.fn_staff_puede_gestionar_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = p_id_socio
      and (
        public.fn_dueno_posee_gimnasio(ms.id_gimnasio)
        or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'recepcionista'])
      )
  );
$$;

-- Gestión de rutinas y lectura de progreso corporal del socio (EXCLUYE recepcionista)
create or replace function public.fn_staff_puede_gestionar_rutinas_socio(p_id_socio bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.membresia_socio ms
    where ms.id_socio = p_id_socio
      and ms.estado <> 'cancelada'
      and (
        public.fn_dueno_posee_gimnasio(ms.id_gimnasio)
        or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'entrenador'])
      )
  );
$$;

-- Permisos EXECUTE explícitos sobre helpers
revoke all on function public.fn_current_dueno_id() from public, anon;
grant execute on function public.fn_current_dueno_id() to authenticated, service_role;

revoke all on function public.fn_current_socio_id() from public, anon;
grant execute on function public.fn_current_socio_id() to authenticated, service_role;

revoke all on function public.fn_current_empleado_id() from public, anon;
grant execute on function public.fn_current_empleado_id() to authenticated, service_role;

revoke all on function public.fn_dueno_posee_gimnasio(bigint) from public, anon;
grant execute on function public.fn_dueno_posee_gimnasio(bigint) to authenticated, service_role;

revoke all on function public.fn_dueno_posee_sucursal(bigint) from public, anon;
grant execute on function public.fn_dueno_posee_sucursal(bigint) to authenticated, service_role;

revoke all on function public.fn_empleado_en_gimnasio(bigint, text[]) from public, anon;
grant execute on function public.fn_empleado_en_gimnasio(bigint, text[]) to authenticated, service_role;

revoke all on function public.fn_empleado_en_sucursal(bigint, text[]) from public, anon;
grant execute on function public.fn_empleado_en_sucursal(bigint, text[]) to authenticated, service_role;

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

-- ============================================================================
-- 1.5. RLS HABILITADO + REVOCACIÓN DE PRIVILEGIOS EXCESIVOS POR TABLA
-- ============================================================================
alter table public.dueno enable row level security;
alter table public.gimnasio enable row level security;
alter table public.sucursal enable row level security;
alter table public.socio enable row level security;
alter table public.empleado enable row level security;
alter table public.empleado_sucursal enable row level security;
alter table public.membresia_gimnasio enable row level security;
alter table public.membresia_socio enable row level security;
alter table public.pago enable row level security;
alter table public.asistencia_socio enable row level security;
alter table public.ejercicio enable row level security;
alter table public.rutina enable row level security;
alter table public.rutina_ejercicio enable row level security;

revoke all on
  public.dueno,
  public.gimnasio,
  public.sucursal,
  public.socio,
  public.empleado,
  public.empleado_sucursal,
  public.membresia_gimnasio,
  public.membresia_socio,
  public.pago,
  public.asistencia_socio,
  public.ejercicio,
  public.rutina,
  public.rutina_ejercicio
from public, anon, authenticated;

grant select, insert, update on public.dueno to authenticated;
grant select, insert, update, delete on public.gimnasio to authenticated;
grant select, insert, update, delete on public.sucursal to authenticated;
grant select, insert, update on public.socio to authenticated;
grant select, insert, update, delete on public.empleado to authenticated;
grant select, insert, update, delete on public.empleado_sucursal to authenticated;
grant select, insert, update, delete on public.membresia_gimnasio to authenticated;
-- membresia_socio: INSERT solo vía rpc_contratar_membresia / rpc_registrar_socio_gimnasio
grant select, update, delete on public.membresia_socio to authenticated;
-- pago: INSERT y UPDATE solo vía rpc_registrar_pago / rpc_actualizar_estado_pago / rpc_contratar_membresia
grant select on public.pago to authenticated;
-- asistencia_socio: INSERT y UPDATE solo vía rpc_registrar_ingreso/salida/anular_asistencia
grant select on public.asistencia_socio to authenticated;
grant select, insert, update, delete on public.ejercicio to authenticated;
grant select, insert, update, delete on public.rutina to authenticated;
grant select, insert, update, delete on public.rutina_ejercicio to authenticated;

grant all on
  public.dueno,
  public.gimnasio,
  public.sucursal,
  public.socio,
  public.empleado,
  public.empleado_sucursal,
  public.membresia_gimnasio,
  public.membresia_socio,
  public.pago,
  public.asistencia_socio,
  public.ejercicio,
  public.rutina,
  public.rutina_ejercicio
to service_role;

-- ============================================================================
-- 2. POLÍTICAS RLS: public.dueno
-- ============================================================================
drop policy if exists dueno_select_self on public.dueno;
create policy dueno_select_self on public.dueno
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists dueno_insert_self on public.dueno;
create policy dueno_insert_self on public.dueno
  for insert to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists dueno_update_self on public.dueno;
create policy dueno_update_self on public.dueno
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ============================================================================
-- 3. POLÍTICAS RLS: public.gimnasio (SIN acceso global de socio)
-- ============================================================================
drop policy if exists gimnasio_select_authorized on public.gimnasio;
create policy gimnasio_select_authorized on public.gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, null)
    or public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida', 'cancelada'])
  );

drop policy if exists gimnasio_insert_dueno on public.gimnasio;
create policy gimnasio_insert_dueno on public.gimnasio
  for insert to authenticated
  with check (id_dueno = public.fn_current_dueno_id());

drop policy if exists gimnasio_update_dueno on public.gimnasio;
create policy gimnasio_update_dueno on public.gimnasio
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio))
  with check (id_dueno = public.fn_current_dueno_id());

drop policy if exists gimnasio_delete_dueno on public.gimnasio;
create policy gimnasio_delete_dueno on public.gimnasio
  for delete to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio));

-- ============================================================================
-- 4. POLÍTICAS RLS: public.sucursal
-- ============================================================================
drop policy if exists sucursal_select_authorized on public.sucursal;
create policy sucursal_select_authorized on public.sucursal
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_sucursal(id_sucursal, null)
    or (
      estado = true
      and public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida'])
    )
    or exists (
      select 1
      from public.asistencia_socio a
      where a.id_sucursal = sucursal.id_sucursal
        and a.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists sucursal_insert_dueno on public.sucursal;
create policy sucursal_insert_dueno on public.sucursal
  for insert to authenticated
  with check (public.fn_dueno_posee_gimnasio(id_gimnasio));

drop policy if exists sucursal_update_dueno on public.sucursal;
create policy sucursal_update_dueno on public.sucursal
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio))
  with check (public.fn_dueno_posee_gimnasio(id_gimnasio));

drop policy if exists sucursal_delete_dueno on public.sucursal;
create policy sucursal_delete_dueno on public.sucursal
  for delete to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio));

-- ============================================================================
-- 5. POLÍTICAS RLS: public.socio
-- ============================================================================
drop policy if exists socio_select_authorized on public.socio;
create policy socio_select_authorized on public.socio
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.fn_staff_puede_ver_socio(id_socio)
  );

drop policy if exists socio_insert_authorized on public.socio;
create policy socio_insert_authorized on public.socio
  for insert to authenticated
  with check (
    -- Auto-registro del propio socio autenticado (alta de staff vinculada al gimnasio vía rpc_registrar_socio_gimnasio)
    auth_user_id = auth.uid()
    and estado = true
    and fecha_alta = current_date
  );

drop policy if exists socio_update_authorized on public.socio;
create policy socio_update_authorized on public.socio
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or public.fn_staff_puede_gestionar_socio(id_socio)
  )
  with check (
    auth_user_id = auth.uid()
    or public.fn_staff_puede_gestionar_socio(id_socio)
  );

-- ============================================================================
-- 6. POLÍTICAS RLS: public.empleado y public.empleado_sucursal
-- ============================================================================
drop policy if exists empleado_select_authorized on public.empleado;
create policy empleado_select_authorized on public.empleado
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  );

drop policy if exists empleado_insert_dueno on public.empleado;
create policy empleado_insert_dueno on public.empleado
  for insert to authenticated
  with check (
    id_gimnasio is not null
    and public.fn_dueno_posee_gimnasio(id_gimnasio)
  );

drop policy if exists empleado_update_dueno on public.empleado;
create policy empleado_update_dueno on public.empleado
  for update to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio))
  with check (
    id_gimnasio is not null
    and public.fn_dueno_posee_gimnasio(id_gimnasio)
  );

drop policy if exists empleado_delete_dueno on public.empleado;
create policy empleado_delete_dueno on public.empleado
  for delete to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio));

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
        and public.fn_dueno_posee_gimnasio(s.id_gimnasio)
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
        and public.fn_dueno_posee_gimnasio(s.id_gimnasio)
    )
  );

-- ============================================================================
-- 7. POLÍTICAS RLS: public.membresia_gimnasio (SIN acceso global de socio)
-- ============================================================================
drop policy if exists plan_select_authorized on public.membresia_gimnasio;
create policy plan_select_authorized on public.membresia_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, null)
    or (
      estado = true
      and public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida'])
    )
    or exists (
      select 1
      from public.membresia_socio ms
      where ms.id_membresia_gimnasio = membresia_gimnasio.id_membresia_gimnasio
        and ms.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists plan_write_dueno_o_admin on public.membresia_gimnasio;
create policy plan_write_dueno_o_admin on public.membresia_gimnasio
  for all to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador'])
  );

-- ============================================================================
-- 8. VISTAS CONTROLADAS DE CATÁLOGO PÚBLICO PARA SOCIOS AUTENTICADOS
-- ============================================================================
create or replace view public.vw_catalogo_gimnasios
with (security_barrier = true) as
  select
    g.id_gimnasio,
    g.nombre,
    g.telefono,
    g.estado
  from public.gimnasio g
  where g.estado = true;

create or replace view public.vw_catalogo_planes
with (security_barrier = true) as
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

-- ============================================================================
-- 9. POLÍTICAS RLS: public.membresia_socio (INSERT revocado; UPDATE solo staff)
-- ============================================================================
drop policy if exists membresia_socio_select_authorized on public.membresia_socio;
create policy membresia_socio_select_authorized on public.membresia_socio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista', 'entrenador'])
  );

drop policy if exists membresia_socio_insert_authorized on public.membresia_socio;

drop policy if exists membresia_socio_update_authorized on public.membresia_socio;
create policy membresia_socio_update_authorized on public.membresia_socio
  for update to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista'])
  )
  with check (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'recepcionista'])
  );

drop policy if exists membresia_socio_delete_dueno on public.membresia_socio;
create policy membresia_socio_delete_dueno on public.membresia_socio
  for delete to authenticated
  using (public.fn_dueno_posee_gimnasio(id_gimnasio));

-- ============================================================================
-- 10. POLÍTICAS RLS: public.pago (Solo SELECT; escrituras vía RPC)
-- ============================================================================
drop policy if exists pago_select_authorized on public.pago;
create policy pago_select_authorized on public.pago
  for select to authenticated
  using (
    exists (
      select 1
      from public.membresia_socio ms
      where ms.id_membresia_socio = pago.id_membresia_socio
        and (
          ms.id_socio = public.fn_current_socio_id()
          or public.fn_dueno_posee_gimnasio(ms.id_gimnasio)
          or public.fn_empleado_en_gimnasio(ms.id_gimnasio, array['administrador', 'recepcionista'])
        )
    )
  );

drop policy if exists pago_insert_authorized on public.pago;
drop policy if exists pago_update_authorized on public.pago;

-- ============================================================================
-- 11. POLÍTICAS RLS: public.asistencia_socio (Solo SELECT; ingreso/salida/anulación vía RPC)
-- ============================================================================
drop policy if exists asistencia_select_authorized on public.asistencia_socio;
create policy asistencia_select_authorized on public.asistencia_socio
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_dueno_posee_sucursal(id_sucursal)
    or public.fn_empleado_en_sucursal(id_sucursal, array['administrador', 'recepcionista', 'entrenador'])
  );

drop policy if exists asistencia_insert_authorized on public.asistencia_socio;
drop policy if exists asistencia_update_authorized on public.asistencia_socio;
drop policy if exists asistencia_delete_authorized on public.asistencia_socio;

-- ============================================================================
-- 12. POLÍTICAS RLS: public.ejercicio
-- ============================================================================
drop policy if exists ejercicio_select_authorized on public.ejercicio;
create policy ejercicio_select_authorized on public.ejercicio
  for select to authenticated
  using (
    (id_socio is not null and id_socio = public.fn_current_socio_id())
    or (
      id_gimnasio is not null and (
        public.fn_dueno_posee_gimnasio(id_gimnasio)
        or public.fn_empleado_en_gimnasio(id_gimnasio, null)
        or public.fn_socio_tiene_gimnasio(id_gimnasio, array['activa', 'pendiente', 'vencida'])
      )
    )
  );

drop policy if exists ejercicio_insert_authorized on public.ejercicio;
create policy ejercicio_insert_authorized on public.ejercicio
  for insert to authenticated
  with check (
    (id_socio = public.fn_current_socio_id() and id_gimnasio is null)
    or (
      id_gimnasio is not null and id_socio is null and (
        public.fn_dueno_posee_gimnasio(id_gimnasio)
        or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
      )
    )
  );

drop policy if exists ejercicio_update_authorized on public.ejercicio;
create policy ejercicio_update_authorized on public.ejercicio
  for update to authenticated
  using (
    (id_socio = public.fn_current_socio_id() and id_gimnasio is null)
    or (
      id_gimnasio is not null and id_socio is null and (
        public.fn_dueno_posee_gimnasio(id_gimnasio)
        or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
      )
    )
  )
  with check (
    (id_socio = public.fn_current_socio_id() and id_gimnasio is null)
    or (
      id_gimnasio is not null and id_socio is null and (
        public.fn_dueno_posee_gimnasio(id_gimnasio)
        or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
      )
    )
  );

drop policy if exists ejercicio_delete_authorized on public.ejercicio;
create policy ejercicio_delete_authorized on public.ejercicio
  for delete to authenticated
  using (
    (id_socio = public.fn_current_socio_id() and id_gimnasio is null)
    or (
      id_gimnasio is not null and id_socio is null and (
        public.fn_dueno_posee_gimnasio(id_gimnasio)
        or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
      )
    )
  );

-- ============================================================================
-- 13. POLÍTICAS RLS: public.rutina y public.rutina_ejercicio
--     Separadas de fn_staff_puede_ver_socio: EXCLUYEN recepcionistas.
-- ============================================================================
drop policy if exists rutina_select_authorized on public.rutina;
create policy rutina_select_authorized on public.rutina
  for select to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  );

drop policy if exists rutina_insert_authorized on public.rutina;
create policy rutina_insert_authorized on public.rutina
  for insert to authenticated
  with check (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  );

drop policy if exists rutina_update_authorized on public.rutina;
create policy rutina_update_authorized on public.rutina
  for update to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  )
  with check (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  );

drop policy if exists rutina_delete_authorized on public.rutina;
create policy rutina_delete_authorized on public.rutina
  for delete to authenticated
  using (
    id_socio = public.fn_current_socio_id()
    or public.fn_staff_puede_gestionar_rutinas_socio(id_socio)
  );

drop policy if exists rutina_ejercicio_all_authorized on public.rutina_ejercicio;
drop policy if exists rutina_ejercicio_select_authorized on public.rutina_ejercicio;
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
  );

drop policy if exists rutina_ejercicio_insert_authorized on public.rutina_ejercicio;
create policy rutina_ejercicio_insert_authorized on public.rutina_ejercicio
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rutina r
      where r.id_rutina = rutina_ejercicio.id_rutina
        and (
          r.id_socio = public.fn_current_socio_id()
          or public.fn_staff_puede_gestionar_rutinas_socio(r.id_socio)
        )
    )
  );

drop policy if exists rutina_ejercicio_update_authorized on public.rutina_ejercicio;
create policy rutina_ejercicio_update_authorized on public.rutina_ejercicio
  for update to authenticated
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
  with check (
    exists (
      select 1 from public.rutina r
      where r.id_rutina = rutina_ejercicio.id_rutina
        and (
          r.id_socio = public.fn_current_socio_id()
          or public.fn_staff_puede_gestionar_rutinas_socio(r.id_socio)
        )
    )
  );

drop policy if exists rutina_ejercicio_delete_authorized on public.rutina_ejercicio;
create policy rutina_ejercicio_delete_authorized on public.rutina_ejercicio
  for delete to authenticated
  using (
    exists (
      select 1 from public.rutina r
      where r.id_rutina = rutina_ejercicio.id_rutina
        and (
          r.id_socio = public.fn_current_socio_id()
          or public.fn_staff_puede_gestionar_rutinas_socio(r.id_socio)
        )
    )
  );

-- ============================================================================
-- 14. POLÍTICAS RLS: public.progreso (condicional segura si la tabla existe)
-- ============================================================================
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
    raise notice 'public.progreso no existe en este esquema; políticas RLS omitidas sin error.';
  end if;
end $$;

commit;
