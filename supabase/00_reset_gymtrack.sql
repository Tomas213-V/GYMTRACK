-- ============================================================================
-- GYMTRACK — 00_reset_gymtrack.sql
-- LIMPIEZA QUIRÚRGICA, AISLADA E IDEMPOTENTE (SIN CASCADE) DE OBJETOS GYMTRACK
--
-- PROPÓSITO:
--   Eliminar ÚNICAMENTE tablas, vistas, funciones/RPCs, triggers, políticas
--   RLS, índices, constraints y secuencias pertenecientes a GymTrack en public
--   (esquema legacy de 13 tablas, instalaciones parciales o modelo definitivo
--   de 20 tablas), dejando el esquema listo para ejecutar:
--     supabase/01_instalacion_definitiva.sql
--
-- GARANTÍAS DE AISLAMIENTO REAL:
--   1. NO utiliza DROP ... CASCADE en ninguna sentencia: todos los DROP usan
--      RESTRICT para que PostgreSQL bloquee cualquier borrado con dependencias
--      externas.
--   2. Ejecuta una auditoría previa sobre pg_catalog.pg_depend ANTES de borrar
--      nada: si cualquier objeto externo (vista, tabla con FK, función, trigger,
--      política, valor por defecto o tipo fuera de la lista explícita de
--      GymTrack) depende de un objeto GymTrack, ABORTA la transacción con un
--      mensaje claro listando cada dependencia externa.
--   3. NO ejecuta DROP SCHEMA public.
--   4. NO toca auth, auth.users, storage, realtime, extensions, vault,
--      graphql, pgbouncer, supabase_migrations, extensiones administradas ni
--      roles internos de Supabase.
--   5. Totalmente idempotente: funciona sobre esquema legacy, instalación
--      parcial, modelo definitivo o base ya limpia.
--
-- ADVERTENCIA:
--   - DESTRUCTIVO para los datos de las tablas propias de GymTrack en public.
--   - Ejecutar manualmente en Supabase SQL Editor únicamente tras confirmar
--     que no se requieren conservar los datos previos.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. AUDITORÍA PREVIA DE DEPENDENCIAS EXTERNAS (ABORTA ANTES DE BORRAR NADA)
-- ----------------------------------------------------------------------------
do $$
declare
  v_gymtrack_tables constant text[] := array[
    -- Legacy / obsoletas (9)
    'progreso', 'rutina_ejercicio', 'rutina', 'ejercicio', 'asistencia',
    'membresia', 'plan_membresia', 'usuario', 'cadena_gimnasios',
    -- Modelo definitivo (20)
    'rutinas_asignadas_socio_gimnasio', 'rutina_ejercicio_gimnasio',
    'rutina_ejercicio_socio', 'rutina_gimnasio', 'rutina_socio',
    'ejercicio_gimnasio', 'ejercicio_socio', 'asistencia_socio', 'pago',
    'membresia_socio', 'membresia_gimnasio', 'socio_gimnasio', 'socio',
    'empleado_sucursal', 'empleado', 'administrador_gimnasio',
    'administrador', 'sucursal', 'gimnasio', 'dueno'
  ];

  v_gymtrack_views constant text[] := array[
    'vw_catalogo_planes',
    'vw_catalogo_gimnasios'
  ];

  v_gymtrack_orphan_seqs constant text[] := array[
    'progreso_id_progreso_seq',
    'rutina_ejercicio_id_rutina_ejercicio_seq',
    'rutina_id_rutina_seq',
    'ejercicio_id_ejercicio_seq',
    'asistencia_id_asistencia_seq',
    'membresia_id_membresia_seq',
    'plan_membresia_id_plan_seq',
    'usuario_id_usuario_seq',
    'cadena_gimnasios_id_cadena_seq',
    'rutinas_asignadas_socio_gimnasio_id_rutina_asignada_seq',
    'rutina_ejercicio_gimnasio_id_rutina_ejercicio_gimnasio_seq',
    'rutina_ejercicio_socio_id_rutina_ejercicio_socio_seq',
    'rutina_gimnasio_id_rutina_gimnasio_seq',
    'rutina_socio_id_rutina_socio_seq',
    'ejercicio_gimnasio_id_ejercicio_gimnasio_seq',
    'ejercicio_socio_id_ejercicio_socio_seq',
    'asistencia_socio_id_asistencia_socio_seq',
    'pago_id_pago_seq',
    'membresia_socio_id_membresia_socio_seq',
    'membresia_gimnasio_id_membresia_gimnasio_seq',
    'socio_gimnasio_id_socio_gimnasio_seq',
    'socio_id_socio_seq',
    'empleado_sucursal_id_empleado_sucursal_seq',
    'empleado_id_empleado_seq',
    'administrador_gimnasio_id_administrador_gimnasio_seq',
    'administrador_id_administrador_seq',
    'sucursal_id_sucursal_seq',
    'gimnasio_id_gimnasio_seq',
    'dueno_id_dueno_seq'
  ];

  v_gymtrack_functions constant text[] := array[
    -- Helpers (fn_*)
    'fn_es_service_role',
    'fn_current_dueno_id',
    'fn_current_socio_id',
    'fn_current_empleado_id',
    'fn_current_administrador_id',
    'fn_dueno_posee_gimnasio',
    'fn_dueno_posee_sucursal',
    'fn_admin_posee_gimnasio',
    'fn_admin_posee_sucursal',
    'fn_empleado_en_gimnasio',
    'fn_empleado_en_sucursal',
    'fn_staff_puede_ver_empleado',
    'fn_staff_puede_gestionar_empleado',
    'fn_socio_asociado_gimnasio',
    'fn_socio_tiene_gimnasio',
    'fn_socio_puede_asistir_sucursal',
    'fn_staff_puede_ver_socio',
    'fn_staff_puede_gestionar_socio',
    'fn_staff_puede_gestionar_rutinas_socio',
    -- Funciones de triggers (trg_fn_* — definitivas e históricas)
    'trg_fn_validar_empleado_sucursal_gimnasio',
    'trg_fn_proteger_empleado_gimnasio_cambio',
    'trg_fn_proteger_sucursal_gimnasio_cambio',
    'trg_fn_proteger_campos_dueno',
    'trg_fn_proteger_campos_empleado',
    'trg_fn_proteger_campos_socio',
    'trg_fn_proteger_socio_gimnasio',
    'trg_fn_proteger_campos_administrador',
    'trg_fn_proteger_admin_gimnasio_cambio',
    'trg_fn_proteger_membresia_socio_inmutable',
    'trg_fn_proteger_pago_inmutable',
    'trg_fn_validar_comprobante_unico_gimnasio',
    'trg_fn_validar_asistencia_socio_gimnasio',
    'trg_fn_proteger_progreso',
    'trg_fn_proteger_propietario_ejercicio',
    'trg_fn_proteger_propietario_ejercicio_sep',
    'trg_fn_proteger_propietario_rutina',
    'trg_fn_proteger_propietario_rutina_sep',
    'trg_fn_validar_ejercicio_en_rutina',
    'trg_fn_validar_rutina_asignada',
    -- RPCs transaccionales (rpc_* — definitivas e históricas)
    'rpc_asociar_socio_gimnasio',
    'rpc_cambiar_estado_socio_gimnasio',
    'rpc_registrar_administrador_gimnasio',
    'rpc_registrar_empleado_sucursal',
    'rpc_registrar_pago',
    'rpc_actualizar_estado_pago',
    'rpc_contratar_membresia',
    'rpc_actualizar_estado_membresia',
    'rpc_registrar_socio_gimnasio',
    'rpc_registrar_ingreso_asistencia',
    'rpc_registrar_salida_asistencia',
    'rpc_anular_asistencia',
    'rpc_asignar_rutina_gimnasio_socio',
    'rpc_reasignar_responsable_rutina_asignada',
    'rpc_finalizar_rutina_asignada',
    'rpc_reordenar_rutina_ejercicios',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios',
    'rpc_vincular_identidad_perfil'
  ];

  v_gym_rel_oids      oid[];
  v_gym_toast_oids    oid[];
  v_gym_idx_oids      oid[];
  v_gym_seq_oids      oid[];
  v_gym_type_oids     oid[];
  v_gym_func_oids     oid[];
  v_gym_trigger_oids  oid[];
  v_gym_policy_oids   oid[];
  v_gym_con_oids      oid[];
  v_gym_rewrite_oids  oid[];
  v_gym_attrdef_oids  oid[];
  v_gym_stat_oids     oid[];
  v_target_oids       oid[];
  v_ext_deps          text;
  v_ext_count         integer := 0;
begin
  -- Recolectar tablas y vistas propias de GymTrack en public
  select coalesce(array_agg(c.oid), array[]::oid[])
    into v_gym_rel_oids
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and (
      (c.relkind in ('r', 'p') and c.relname = any(v_gymtrack_tables))
      or (c.relkind = 'v' and c.relname = any(v_gymtrack_views))
    );

  -- Tablas TOAST internas de tablas GymTrack
  select coalesce(array_agg(c.reltoastrelid), array[]::oid[])
    into v_gym_toast_oids
  from pg_catalog.pg_class c
  where c.oid = any(v_gym_rel_oids)
    and c.reltoastrelid <> 0;

  -- Índices de tablas GymTrack y de sus tablas TOAST
  select coalesce(array_agg(i.indexrelid), array[]::oid[])
    into v_gym_idx_oids
  from pg_catalog.pg_index i
  where i.indrelid = any(v_gym_rel_oids || v_gym_toast_oids);

  -- Secuencias propias (IDENTITY/SERIAL asociadas a tablas GymTrack + huérfanas explícitas)
  select coalesce(array_agg(distinct s.oid), array[]::oid[])
    into v_gym_seq_oids
  from pg_catalog.pg_class s
  join pg_catalog.pg_namespace n on n.oid = s.relnamespace
  where s.relkind = 'S'
    and n.nspname = 'public'
    and (
      s.relname = any(v_gymtrack_orphan_seqs)
      or exists (
        select 1
        from pg_catalog.pg_depend dep
        where dep.classid = 'pg_catalog.pg_class'::regclass
          and dep.objid = s.oid
          and dep.refclassid = 'pg_catalog.pg_class'::regclass
          and dep.refobjid = any(v_gym_rel_oids)
          and dep.deptype in ('a', 'i')
      )
    );

  -- Tipos de fila y tipos arreglo internos de tablas/vistas/TOAST GymTrack
  select coalesce(array_agg(distinct t.oid), array[]::oid[])
    into v_gym_type_oids
  from pg_catalog.pg_type t
  where t.typrelid = any(v_gym_rel_oids || v_gym_toast_oids)
     or t.typelem in (
       select t2.oid
       from pg_catalog.pg_type t2
       where t2.typrelid = any(v_gym_rel_oids || v_gym_toast_oids)
     );

  -- Funciones explícitas de GymTrack en public
  select coalesce(array_agg(p.oid), array[]::oid[])
    into v_gym_func_oids
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(v_gymtrack_functions);

  -- Objetos internos propiedad de las tablas/vistas GymTrack
  select coalesce(array_agg(t.oid), array[]::oid[])
    into v_gym_trigger_oids
  from pg_catalog.pg_trigger t
  where t.tgrelid = any(v_gym_rel_oids);

  select coalesce(array_agg(pol.oid), array[]::oid[])
    into v_gym_policy_oids
  from pg_catalog.pg_policy pol
  where pol.polrelid = any(v_gym_rel_oids);

  select coalesce(array_agg(con.oid), array[]::oid[])
    into v_gym_con_oids
  from pg_catalog.pg_constraint con
  where con.conrelid = any(v_gym_rel_oids);

  select coalesce(array_agg(rw.oid), array[]::oid[])
    into v_gym_rewrite_oids
  from pg_catalog.pg_rewrite rw
  where rw.ev_class = any(v_gym_rel_oids);

  select coalesce(array_agg(ad.oid), array[]::oid[])
    into v_gym_attrdef_oids
  from pg_catalog.pg_attrdef ad
  where ad.adrelid = any(v_gym_rel_oids);

  select coalesce(array_agg(stx.oid), array[]::oid[])
    into v_gym_stat_oids
  from pg_catalog.pg_statistic_ext stx
  where stx.stxrelid = any(v_gym_rel_oids);

  v_target_oids := v_gym_rel_oids || v_gym_seq_oids || v_gym_type_oids || v_gym_func_oids;

  if coalesce(array_length(v_target_oids, 1), 0) = 0 then
    raise notice 'Pre-chequeo OK: no existen objetos previos de GymTrack en public.';
    return;
  end if;

  -- Buscar cualquier dependencia externa sobre objetos de GymTrack
  with ext as (
    select distinct
      pg_catalog.pg_describe_object(d.classid, d.objid, d.objsubid) as objeto_externo,
      pg_catalog.pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as objeto_gymtrack
    from pg_catalog.pg_depend d
    where d.refobjid = any(v_target_oids)
      and d.deptype in ('n', 'a', 'i')
      and not (
        (d.classid = 'pg_catalog.pg_class'::regclass
          and d.objid = any(v_gym_rel_oids || v_gym_toast_oids || v_gym_idx_oids || v_gym_seq_oids))
        or (d.classid = 'pg_catalog.pg_proc'::regclass
          and d.objid = any(v_gym_func_oids))
        or (d.classid = 'pg_catalog.pg_type'::regclass
          and d.objid = any(v_gym_type_oids))
        or (d.classid = 'pg_catalog.pg_trigger'::regclass
          and d.objid = any(v_gym_trigger_oids))
        or (d.classid = 'pg_catalog.pg_policy'::regclass
          and d.objid = any(v_gym_policy_oids))
        or (d.classid = 'pg_catalog.pg_constraint'::regclass
          and d.objid = any(v_gym_con_oids))
        or (d.classid = 'pg_catalog.pg_rewrite'::regclass
          and d.objid = any(v_gym_rewrite_oids))
        or (d.classid = 'pg_catalog.pg_attrdef'::regclass
          and d.objid = any(v_gym_attrdef_oids))
        or (d.classid = 'pg_catalog.pg_statistic_ext'::regclass
          and d.objid = any(v_gym_stat_oids))
      )
  )
  select count(*), string_agg('  - ' || objeto_externo || ' -> depende de -> ' || objeto_gymtrack, E'\n' order by objeto_externo)
    into v_ext_count, v_ext_deps
  from ext;

  if v_ext_count > 0 then
    raise exception E'RESET ABORTADO: Se detectaron % dependencia(s) externa(s) sobre objetos de GymTrack.\nNo se eliminó ningún objeto. Revise o elimine manualmente estas dependencias antes de reintentar:\n%',
      v_ext_count, v_ext_deps;
  end if;

  raise notice 'Pre-chequeo de dependencias externas OK: 0 dependencias ajenas detectadas.';
end $$;

-- ----------------------------------------------------------------------------
-- 1. ELIMINAR VISTAS DE GYMTRACK (RESTRICT, SIN CASCADE)
-- ----------------------------------------------------------------------------
drop view if exists public.vw_catalogo_planes restrict;
drop view if exists public.vw_catalogo_gimnasios restrict;

-- ----------------------------------------------------------------------------
-- 2. ELIMINAR POLÍTICAS RLS Y TRIGGERS SOLO DE TABLAS GYMTRACK (RESTRICT)
--    Desvincula las tablas GymTrack de fn_* y trg_fn_* antes de eliminar
--    funciones y tablas sin recurrir a CASCADE.
-- ----------------------------------------------------------------------------
do $$
declare
  v_gymtrack_tables constant text[] := array[
    'progreso', 'rutina_ejercicio', 'rutina', 'ejercicio', 'asistencia',
    'membresia', 'plan_membresia', 'usuario', 'cadena_gimnasios',
    'rutinas_asignadas_socio_gimnasio', 'rutina_ejercicio_gimnasio',
    'rutina_ejercicio_socio', 'rutina_gimnasio', 'rutina_socio',
    'ejercicio_gimnasio', 'ejercicio_socio', 'asistencia_socio', 'pago',
    'membresia_socio', 'membresia_gimnasio', 'socio_gimnasio', 'socio',
    'empleado_sucursal', 'empleado', 'administrador_gimnasio',
    'administrador', 'sucursal', 'gimnasio', 'dueno'
  ];
  v_pol record;
  v_trg record;
  v_pol_count integer := 0;
  v_trg_count integer := 0;
begin
  for v_pol in
    select pol.polname, c.relname as table_name
    from pg_catalog.pg_policy pol
    join pg_catalog.pg_class c on c.oid = pol.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any(v_gymtrack_tables)
    order by c.relname, pol.polname
  loop
    execute format('drop policy if exists %I on public.%I', v_pol.polname, v_pol.table_name);
    v_pol_count := v_pol_count + 1;
  end loop;

  for v_trg in
    select t.tgname, c.relname as table_name
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and c.relname = any(v_gymtrack_tables)
    order by c.relname, t.tgname
  loop
    execute format('drop trigger if exists %I on public.%I restrict', v_trg.tgname, v_trg.table_name);
    v_trg_count := v_trg_count + 1;
  end loop;

  raise notice 'GymTrack reset: % políticas RLS y % triggers propios eliminados (RESTRICT).', v_pol_count, v_trg_count;
end $$;

-- ----------------------------------------------------------------------------
-- 3. ELIMINAR FUNCIONES, HELPERS, TRIGGERS Y RPCs DE GYMTRACK (RESTRICT)
--    Se eliminan ANTES de las tablas porque varias RPCs retornan tipos de fila
--    de tablas GymTrack (ej. RETURNS public.pago).
-- ----------------------------------------------------------------------------
do $$
declare
  v_fn record;
  v_gymtrack_functions constant text[] := array[
    'fn_es_service_role',
    'fn_current_dueno_id',
    'fn_current_socio_id',
    'fn_current_empleado_id',
    'fn_current_administrador_id',
    'fn_dueno_posee_gimnasio',
    'fn_dueno_posee_sucursal',
    'fn_admin_posee_gimnasio',
    'fn_admin_posee_sucursal',
    'fn_empleado_en_gimnasio',
    'fn_empleado_en_sucursal',
    'fn_staff_puede_ver_empleado',
    'fn_staff_puede_gestionar_empleado',
    'fn_socio_asociado_gimnasio',
    'fn_socio_tiene_gimnasio',
    'fn_socio_puede_asistir_sucursal',
    'fn_staff_puede_ver_socio',
    'fn_staff_puede_gestionar_socio',
    'fn_staff_puede_gestionar_rutinas_socio',
    'trg_fn_validar_empleado_sucursal_gimnasio',
    'trg_fn_proteger_empleado_gimnasio_cambio',
    'trg_fn_proteger_sucursal_gimnasio_cambio',
    'trg_fn_proteger_campos_dueno',
    'trg_fn_proteger_campos_empleado',
    'trg_fn_proteger_campos_socio',
    'trg_fn_proteger_socio_gimnasio',
    'trg_fn_proteger_campos_administrador',
    'trg_fn_proteger_admin_gimnasio_cambio',
    'trg_fn_proteger_membresia_socio_inmutable',
    'trg_fn_proteger_pago_inmutable',
    'trg_fn_validar_comprobante_unico_gimnasio',
    'trg_fn_validar_asistencia_socio_gimnasio',
    'trg_fn_proteger_progreso',
    'trg_fn_proteger_propietario_ejercicio',
    'trg_fn_proteger_propietario_ejercicio_sep',
    'trg_fn_proteger_propietario_rutina',
    'trg_fn_proteger_propietario_rutina_sep',
    'trg_fn_validar_ejercicio_en_rutina',
    'trg_fn_validar_rutina_asignada',
    'rpc_asociar_socio_gimnasio',
    'rpc_cambiar_estado_socio_gimnasio',
    'rpc_registrar_administrador_gimnasio',
    'rpc_registrar_empleado_sucursal',
    'rpc_registrar_pago',
    'rpc_actualizar_estado_pago',
    'rpc_contratar_membresia',
    'rpc_actualizar_estado_membresia',
    'rpc_registrar_socio_gimnasio',
    'rpc_registrar_ingreso_asistencia',
    'rpc_registrar_salida_asistencia',
    'rpc_anular_asistencia',
    'rpc_asignar_rutina_gimnasio_socio',
    'rpc_reasignar_responsable_rutina_asignada',
    'rpc_finalizar_rutina_asignada',
    'rpc_reordenar_rutina_ejercicios',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios',
    'rpc_vincular_identidad_perfil'
  ];
  v_dropped integer := 0;
begin
  for v_fn in
    select
      n.nspname as schema_name,
      p.proname as func_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as func_args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_gymtrack_functions)
    order by p.proname, p.oid
  loop
    execute format(
      'drop function if exists %I.%I(%s) restrict',
      v_fn.schema_name,
      v_fn.func_name,
      v_fn.func_args
    );
    v_dropped := v_dropped + 1;
  end loop;

  raise notice 'GymTrack reset: % funciones/RPCs propias eliminadas en public (RESTRICT).', v_dropped;
end $$;

-- ----------------------------------------------------------------------------
-- 4. ELIMINAR CLAVES FORÁNEAS INTERNAS SOLO EN TABLAS GYMTRACK (RESTRICT)
--    Permite limpiar de forma idempotente cualquier grafo legacy/parcial sin
--    tocar FKs de tablas externas (si una tabla externa apunta a GymTrack, el
--    paso 5 abortará con RESTRICT).
-- ----------------------------------------------------------------------------
do $$
declare
  v_gymtrack_tables constant text[] := array[
    'progreso', 'rutina_ejercicio', 'rutina', 'ejercicio', 'asistencia',
    'membresia', 'plan_membresia', 'usuario', 'cadena_gimnasios',
    'rutinas_asignadas_socio_gimnasio', 'rutina_ejercicio_gimnasio',
    'rutina_ejercicio_socio', 'rutina_gimnasio', 'rutina_socio',
    'ejercicio_gimnasio', 'ejercicio_socio', 'asistencia_socio', 'pago',
    'membresia_socio', 'membresia_gimnasio', 'socio_gimnasio', 'socio',
    'empleado_sucursal', 'empleado', 'administrador_gimnasio',
    'administrador', 'sucursal', 'gimnasio', 'dueno'
  ];
  v_fk record;
  v_fk_count integer := 0;
begin
  for v_fk in
    select con.conname, c.relname as table_name
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and con.contype = 'f'
      and c.relname = any(v_gymtrack_tables)
    order by c.relname, con.conname
  loop
    execute format('alter table public.%I drop constraint if exists %I restrict', v_fk.table_name, v_fk.conname);
    v_fk_count := v_fk_count + 1;
  end loop;

  raise notice 'GymTrack reset: % FKs internas de tablas GymTrack eliminadas (RESTRICT).', v_fk_count;
end $$;

-- ----------------------------------------------------------------------------
-- 5. ELIMINAR TABLAS PROPIAS DE GYMTRACK (LEGACY + DEFINITIVAS) CON RESTRICT
--    Sus índices, PK/UNIQUE/CHECK, TOAST y secuencias IDENTITY propias se
--    eliminan automáticamente sin CASCADE; cualquier referencia externa
--    residual hará fallar el RESTRICT y revertirá la transacción completa.
-- ----------------------------------------------------------------------------

-- 5.1. Tablas legacy / obsoletas (9)
drop table if exists public.progreso restrict;
drop table if exists public.rutina_ejercicio restrict;
drop table if exists public.rutina restrict;
drop table if exists public.ejercicio restrict;
drop table if exists public.asistencia restrict;
drop table if exists public.membresia restrict;
drop table if exists public.plan_membresia restrict;
drop table if exists public.usuario restrict;
drop table if exists public.cadena_gimnasios restrict;

-- 5.2. Tablas del modelo definitivo (20)
drop table if exists public.rutinas_asignadas_socio_gimnasio restrict;
drop table if exists public.rutina_ejercicio_gimnasio restrict;
drop table if exists public.rutina_ejercicio_socio restrict;
drop table if exists public.rutina_gimnasio restrict;
drop table if exists public.rutina_socio restrict;
drop table if exists public.ejercicio_gimnasio restrict;
drop table if exists public.ejercicio_socio restrict;
drop table if exists public.asistencia_socio restrict;
drop table if exists public.pago restrict;
drop table if exists public.membresia_socio restrict;
drop table if exists public.membresia_gimnasio restrict;
drop table if exists public.socio_gimnasio restrict;
drop table if exists public.socio restrict;
drop table if exists public.empleado_sucursal restrict;
drop table if exists public.empleado restrict;
drop table if exists public.administrador_gimnasio restrict;
drop table if exists public.administrador restrict;
drop table if exists public.sucursal restrict;
drop table if exists public.gimnasio restrict;
drop table if exists public.dueno restrict;

-- ----------------------------------------------------------------------------
-- 6. SECUENCIAS HUÉRFANAS DE GYMTRACK (SOLO SI QUEDARAN SIN PROPIETARIO, RESTRICT)
-- ----------------------------------------------------------------------------
drop sequence if exists public.progreso_id_progreso_seq restrict;
drop sequence if exists public.rutina_ejercicio_id_rutina_ejercicio_seq restrict;
drop sequence if exists public.rutina_id_rutina_seq restrict;
drop sequence if exists public.ejercicio_id_ejercicio_seq restrict;
drop sequence if exists public.asistencia_id_asistencia_seq restrict;
drop sequence if exists public.membresia_id_membresia_seq restrict;
drop sequence if exists public.plan_membresia_id_plan_seq restrict;
drop sequence if exists public.usuario_id_usuario_seq restrict;
drop sequence if exists public.cadena_gimnasios_id_cadena_seq restrict;
drop sequence if exists public.rutinas_asignadas_socio_gimnasio_id_rutina_asignada_seq restrict;
drop sequence if exists public.rutina_ejercicio_gimnasio_id_rutina_ejercicio_gimnasio_seq restrict;
drop sequence if exists public.rutina_ejercicio_socio_id_rutina_ejercicio_socio_seq restrict;
drop sequence if exists public.rutina_gimnasio_id_rutina_gimnasio_seq restrict;
drop sequence if exists public.rutina_socio_id_rutina_socio_seq restrict;
drop sequence if exists public.ejercicio_gimnasio_id_ejercicio_gimnasio_seq restrict;
drop sequence if exists public.ejercicio_socio_id_ejercicio_socio_seq restrict;
drop sequence if exists public.asistencia_socio_id_asistencia_socio_seq restrict;
drop sequence if exists public.pago_id_pago_seq restrict;
drop sequence if exists public.membresia_socio_id_membresia_socio_seq restrict;
drop sequence if exists public.membresia_gimnasio_id_membresia_gimnasio_seq restrict;
drop sequence if exists public.socio_gimnasio_id_socio_gimnasio_seq restrict;
drop sequence if exists public.socio_id_socio_seq restrict;
drop sequence if exists public.empleado_sucursal_id_empleado_sucursal_seq restrict;
drop sequence if exists public.empleado_id_empleado_seq restrict;
drop sequence if exists public.administrador_gimnasio_id_administrador_gimnasio_seq restrict;
drop sequence if exists public.administrador_id_administrador_seq restrict;
drop sequence if exists public.sucursal_id_sucursal_seq restrict;
drop sequence if exists public.gimnasio_id_gimnasio_seq restrict;
drop sequence if exists public.dueno_id_dueno_seq restrict;

-- Nota sobre tipos ENUM / compuestos:
-- GymTrack utiliza constraints CHECK y no crea tipos CREATE TYPE personalizados en public.

-- ----------------------------------------------------------------------------
-- 7. VERIFICACIÓN POST-LIMPIEZA (ESTRICTAMENTE SOBRE OBJETOS GYMTRACK)
-- ----------------------------------------------------------------------------
do $$
declare
  v_rem_tables integer;
  v_rem_views  integer;
  v_rem_funcs  integer;
  v_gymtrack_tables constant text[] := array[
    'progreso', 'rutina_ejercicio', 'rutina', 'ejercicio', 'asistencia',
    'membresia', 'plan_membresia', 'usuario', 'cadena_gimnasios',
    'dueno', 'gimnasio', 'sucursal', 'administrador', 'administrador_gimnasio',
    'empleado', 'empleado_sucursal', 'socio', 'socio_gimnasio',
    'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
    'ejercicio_socio', 'ejercicio_gimnasio', 'rutina_socio', 'rutina_gimnasio',
    'rutina_ejercicio_socio', 'rutina_ejercicio_gimnasio',
    'rutinas_asignadas_socio_gimnasio'
  ];
  v_gymtrack_functions constant text[] := array[
    'fn_es_service_role', 'fn_current_dueno_id', 'fn_current_socio_id',
    'fn_current_empleado_id', 'fn_current_administrador_id',
    'fn_dueno_posee_gimnasio', 'fn_dueno_posee_sucursal',
    'fn_admin_posee_gimnasio', 'fn_admin_posee_sucursal',
    'fn_empleado_en_gimnasio', 'fn_empleado_en_sucursal',
    'fn_staff_puede_ver_empleado', 'fn_staff_puede_gestionar_empleado',
    'fn_socio_asociado_gimnasio', 'fn_socio_tiene_gimnasio',
    'fn_socio_puede_asistir_sucursal', 'fn_staff_puede_ver_socio',
    'fn_staff_puede_gestionar_socio', 'fn_staff_puede_gestionar_rutinas_socio',
    'trg_fn_validar_empleado_sucursal_gimnasio',
    'trg_fn_proteger_empleado_gimnasio_cambio',
    'trg_fn_proteger_sucursal_gimnasio_cambio',
    'trg_fn_proteger_campos_dueno', 'trg_fn_proteger_campos_empleado',
    'trg_fn_proteger_campos_socio', 'trg_fn_proteger_socio_gimnasio',
    'trg_fn_proteger_campos_administrador', 'trg_fn_proteger_admin_gimnasio_cambio',
    'trg_fn_proteger_membresia_socio_inmutable', 'trg_fn_proteger_pago_inmutable',
    'trg_fn_validar_comprobante_unico_gimnasio',
    'trg_fn_validar_asistencia_socio_gimnasio',
    'trg_fn_proteger_progreso', 'trg_fn_proteger_propietario_ejercicio',
    'trg_fn_proteger_propietario_ejercicio_sep',
    'trg_fn_proteger_propietario_rutina', 'trg_fn_proteger_propietario_rutina_sep',
    'trg_fn_validar_ejercicio_en_rutina', 'trg_fn_validar_rutina_asignada',
    'rpc_asociar_socio_gimnasio', 'rpc_cambiar_estado_socio_gimnasio',
    'rpc_registrar_administrador_gimnasio', 'rpc_registrar_empleado_sucursal',
    'rpc_registrar_pago', 'rpc_actualizar_estado_pago',
    'rpc_contratar_membresia', 'rpc_actualizar_estado_membresia',
    'rpc_registrar_socio_gimnasio', 'rpc_registrar_ingreso_asistencia',
    'rpc_registrar_salida_asistencia', 'rpc_anular_asistencia',
    'rpc_asignar_rutina_gimnasio_socio', 'rpc_reasignar_responsable_rutina_asignada',
    'rpc_finalizar_rutina_asignada', 'rpc_reordenar_rutina_ejercicios',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios', 'rpc_vincular_identidad_perfil'
  ];
begin
  select count(*) into v_rem_tables
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename = any(v_gymtrack_tables);

  select count(*) into v_rem_views
  from pg_catalog.pg_views
  where schemaname = 'public'
    and viewname in ('vw_catalogo_gimnasios', 'vw_catalogo_planes');

  select count(*) into v_rem_funcs
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(v_gymtrack_functions);

  if v_rem_tables > 0 or v_rem_views > 0 or v_rem_funcs > 0 then
    raise exception 'Reset incompleto: quedan % tablas, % vistas y % funciones de GymTrack en public.',
      v_rem_tables, v_rem_views, v_rem_funcs;
  end if;

  raise notice 'RESET GYMTRACK COMPLETADO OK (SIN CASCADE): 0 tablas, 0 vistas y 0 funciones propias restantes en public. auth/storage/realtime y objetos ajenos intactos.';
end $$;

commit;
