-- ============================================================================
-- GYMTRACK — 02_verificacion_instalacion.sql
-- SCRIPT DE VERIFICACIÓN POST-INSTALACIÓN (SOLO LECTURA, ACOTADO A GYMTRACK)
--
-- PROPÓSITO:
--   Comprobar exhaustivamente, sin modificar datos ni esquema y SIN depender
--   de conteos globales de objetos ajenos en public, que
--   supabase/01_instalacion_definitiva.sql se aplicó correctamente.
--
-- COBERTURA (EXCLUSIVAMENTE OBJETOS DE GYMTRACK):
--   1. Las 20 tablas definitivas creadas y con RLS habilitado.
--   2. Ausencia de las 9 tablas legacy/prohibidas (incl. progreso y
--      cadena_gimnasios) y ausencia de empleado.id_gimnasio.
--   3. Las 8 FKs compuestas anti-cruce y los 7 índices únicos/parciales clave.
--   4. Las 52 funciones/RPCs/triggers de GymTrack con search_path fijo
--      (pg_catalog, public), SECURITY DEFINER en las 48 correspondientes y
--      OWNER = postgres cuando el rol existe.
--   5. Los 17 triggers exactos en las tablas de GymTrack.
--   6. Las 2 vistas de catálogo (vw_catalogo_gimnasios, vw_catalogo_planes):
--      - security_barrier = true y security_invoker = false (propiedad postgres).
--      - Proyección exacta de columnas (cero email, cero id_dueno, cero PII).
--      - ACL estricta: sin privilegios para PUBLIC ni anon; solo SELECT
--        (sin INSERT/UPDATE/DELETE) para authenticated y service_role.
--   7. Las 43 políticas RLS exactas en las 20 tablas GymTrack y cero políticas
--      permisivas USING (true) / WITH CHECK (true).
--   8. ACLs exactas vía pg_catalog.aclexplode + pg_catalog.acldefault (nunca
--      has_*_privilege('public', ...)) en funciones, vistas, tablas críticas
--      solo-RPC, tablas con acceso restringido a anon y las 20 secuencias
--      IDENTITY de GymTrack (15 con USAGE/SELECT a authenticated vs 5 solo-RPC).
--
-- USO:
--   Ejecutar en Supabase SQL Editor inmediatamente después de:
--     1) supabase/00_reset_gymtrack.sql
--     2) supabase/01_instalacion_definitiva.sql
-- ============================================================================

do $$
declare
  v_expected_tables constant text[] := array[
    'dueno', 'gimnasio', 'sucursal', 'administrador', 'administrador_gimnasio',
    'empleado', 'empleado_sucursal', 'socio', 'socio_gimnasio',
    'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
    'ejercicio_socio', 'ejercicio_gimnasio', 'rutina_socio', 'rutina_gimnasio',
    'rutina_ejercicio_socio', 'rutina_ejercicio_gimnasio',
    'rutinas_asignadas_socio_gimnasio'
  ];

  v_forbidden_tables constant text[] := array[
    'progreso', 'cadena_gimnasios', 'usuario', 'plan_membresia', 'membresia',
    'asistencia', 'ejercicio', 'rutina', 'rutina_ejercicio'
  ];

  v_expected_fks constant text[] := array[
    'fk_contrato_socio_gimnasio',
    'fk_contrato_plan_gimnasio',
    'fk_res_rutina_socio',
    'fk_res_ejercicio_socio',
    'fk_reg_rutina_gym',
    'fk_reg_ejercicio_gym',
    'fk_rasg_rutina_gym',
    'fk_rasg_socio_gym'
  ];

  v_expected_unique_indexes constant text[] := array[
    'uq_pago_contrato_comprobante_activo',
    'uq_asistencia_abierta_socio_sucursal',
    'uq_rutina_asignada_activa',
    'uq_dueno_email_lower',
    'uq_administrador_email_lower',
    'uq_empleado_email_lower',
    'uq_socio_email_lower'
  ];

  v_expected_funcs constant text[] := array[
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
    'trg_fn_proteger_propietario_ejercicio_sep',
    'trg_fn_proteger_propietario_rutina_sep',
    'trg_fn_validar_rutina_asignada',
    'rpc_asociar_socio_gimnasio',
    'rpc_cambiar_estado_socio_gimnasio',
    'rpc_registrar_administrador_gimnasio',
    'rpc_registrar_pago',
    'rpc_actualizar_estado_pago',
    'rpc_contratar_membresia',
    'rpc_actualizar_estado_membresia',
    'rpc_registrar_socio_gimnasio',
    'rpc_registrar_empleado_sucursal',
    'rpc_registrar_ingreso_asistencia',
    'rpc_registrar_salida_asistencia',
    'rpc_anular_asistencia',
    'rpc_asignar_rutina_gimnasio_socio',
    'rpc_reasignar_responsable_rutina_asignada',
    'rpc_finalizar_rutina_asignada',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios',
    'rpc_vincular_identidad_perfil'
  ];

  v_forbidden_funcs constant text[] := array[
    'trg_fn_proteger_progreso',
    'trg_fn_proteger_empleado_gimnasio_cambio',
    'trg_fn_validar_ejercicio_en_rutina',
    'trg_fn_proteger_propietario_ejercicio',
    'trg_fn_proteger_propietario_rutina',
    'rpc_reordenar_rutina_ejercicios'
  ];

  v_invoker_funcs constant text[] := array[
    'trg_fn_proteger_propietario_ejercicio_sep',
    'trg_fn_proteger_propietario_rutina_sep',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios'
  ];

  v_expected_triggers constant text[] := array[
    'trg_validar_empleado_sucursal_gimnasio',
    'trg_proteger_sucursal_gimnasio_cambio',
    'trg_proteger_campos_dueno',
    'trg_proteger_campos_empleado',
    'trg_proteger_campos_socio',
    'trg_proteger_socio_gimnasio',
    'trg_proteger_campos_administrador',
    'trg_proteger_admin_gimnasio_cambio',
    'trg_proteger_membresia_socio_inmutable',
    'trg_proteger_pago_inmutable',
    'trg_validar_comprobante_unico_gimnasio',
    'trg_validar_asistencia_socio_gimnasio',
    'trg_proteger_ejercicio_socio',
    'trg_proteger_ejercicio_gimnasio',
    'trg_proteger_rutina_socio',
    'trg_proteger_rutina_gimnasio',
    'trg_validar_rutina_asignada'
  ];

  v_rpc_only_tables constant text[] := array[
    'socio_gimnasio',
    'membresia_socio',
    'pago',
    'asistencia_socio',
    'rutinas_asignadas_socio_gimnasio'
  ];

  v_errors         text[] := array[]::text[];
  v_count          integer;
  v_missing        text;
  v_bad            text;
  v_cols           text[];
  v_role_anon      oid;
  v_role_auth      oid;
  v_role_svc       oid;
  v_has_postgres   boolean;
  v_rec            record;
  v_seq_name       text;
  v_seq_oid        oid;
  v_has_public_acl boolean;
  v_has_anon_acl   boolean;
  v_has_auth_acl   boolean;
  v_has_auth_upd   boolean;
  v_has_svc_acl    boolean;
begin
  -- Resolver OIDs de roles estándar de Supabase
  select oid into v_role_anon from pg_catalog.pg_roles where rolname = 'anon';
  select oid into v_role_auth from pg_catalog.pg_roles where rolname = 'authenticated';
  select oid into v_role_svc  from pg_catalog.pg_roles where rolname = 'service_role';
  select exists (select 1 from pg_catalog.pg_roles where rolname = 'postgres') into v_has_postgres;

  -- 1. Verificar las 20 tablas definitivas
  select string_agg(t, ', ')
    into v_missing
  from unnest(v_expected_tables) as t
  where not exists (
    select 1 from pg_catalog.pg_tables pt
    where pt.schemaname = 'public' and pt.tablename = t
  );
  if v_missing is not null then
    v_errors := array_append(v_errors, '[TABLAS] Faltan tablas definitivas: ' || v_missing);
  end if;

  -- 2. Verificar ausencia de tablas/funciones legacy y de empleado.id_gimnasio
  select string_agg(tablename, ', ')
    into v_bad
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename = any(v_forbidden_tables);
  if v_bad is not null then
    v_errors := array_append(v_errors, '[LEGACY] Tablas prohibidas/legacy presentes en public: ' || v_bad);
  end if;

  select string_agg(p.proname, ', ')
    into v_bad
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(v_forbidden_funcs);
  if v_bad is not null then
    v_errors := array_append(v_errors, '[LEGACY] Funciones legacy presentes en public: ' || v_bad);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'empleado'
      and column_name = 'id_gimnasio'
  ) then
    v_errors := array_append(v_errors, '[MODELO] Existe la columna prohibida public.empleado.id_gimnasio.');
  end if;

  -- 3. Verificar RLS habilitado y ausencia de permisos a PUBLIC/anon en las 20 tablas
  select string_agg(c.relname, ', ')
    into v_bad
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = any(v_expected_tables)
    and not c.relrowsecurity;
  if v_bad is not null then
    v_errors := array_append(v_errors, '[RLS] Tablas GymTrack sin RLS habilitado: ' || v_bad);
  end if;

  for v_rec in
    select c.relname, c.relacl, c.relowner
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any(v_expected_tables)
  loop
    if exists (
      select 1
      from pg_catalog.aclexplode(coalesce(v_rec.relacl, pg_catalog.acldefault('r'::"char", v_rec.relowner))) a
      where a.grantee = 0::oid or (v_role_anon is not null and a.grantee = v_role_anon)
    ) then
      v_errors := array_append(v_errors, '[ACL TABLA] public.' || v_rec.relname || ' otorga privilegios a PUBLIC o anon.');
    end if;
  end loop;

  -- 4. Verificar las 8 FKs compuestas anti-cruce
  select string_agg(fk, ', ')
    into v_missing
  from unnest(v_expected_fks) as fk
  where not exists (
    select 1
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_namespace n on n.oid = con.connamespace
    where n.nspname = 'public'
      and con.contype = 'f'
      and con.conname = fk
  );
  if v_missing is not null then
    v_errors := array_append(v_errors, '[FK COMPUESTAS] Faltan FKs compuestas: ' || v_missing);
  end if;

  -- 5. Verificar los 7 índices únicos/parciales críticos
  select string_agg(idx, ', ')
    into v_missing
  from unnest(v_expected_unique_indexes) as idx
  where not exists (
    select 1
    from pg_catalog.pg_indexes i
    where i.schemaname = 'public'
      and i.indexname = idx
  );
  if v_missing is not null then
    v_errors := array_append(v_errors, '[ÍNDICES] Faltan índices únicos/parciales críticos: ' || v_missing);
  end if;

  -- 6. Verificar las 52 funciones, search_path, SECURITY DEFINER y OWNER
  select string_agg(fn, ', ')
    into v_missing
  from unnest(v_expected_funcs) as fn
  where not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = fn
  );
  if v_missing is not null then
    v_errors := array_append(v_errors, '[FUNCIONES] Faltan funciones/RPCs: ' || v_missing);
  end if;

  select string_agg(p.proname, ', ')
    into v_bad
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(v_expected_funcs)
    and (
      p.proconfig is null
      or not exists (
        select 1
        from unnest(p.proconfig) cfg
        where lower(replace(cfg, ' ', '')) = 'search_path=pg_catalog,public'
      )
    );
  if v_bad is not null then
    v_errors := array_append(v_errors, '[SEARCH_PATH] Funciones sin search_path = pg_catalog, public: ' || v_bad);
  end if;

  select string_agg(p.proname, ', ')
    into v_bad
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(v_expected_funcs)
    and not (p.proname = any(v_invoker_funcs))
    and not p.prosecdef;
  if v_bad is not null then
    v_errors := array_append(v_errors, '[SECURITY DEFINER] Funciones esperadas como SECURITY DEFINER sin prosecdef: ' || v_bad);
  end if;

  if v_has_postgres then
    select string_agg(p.proname, ', ')
      into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles r on r.oid = p.proowner
    where n.nspname = 'public'
      and p.proname = any(v_expected_funcs)
      and r.rolname <> 'postgres';
    if v_bad is not null then
      v_errors := array_append(v_errors, '[OWNER] Funciones cuyo propietario no es postgres: ' || v_bad);
    end if;
  end if;

  -- 7. Verificar los 17 triggers exactos sobre tablas GymTrack
  select string_agg(trg, ', ')
    into v_missing
  from unnest(v_expected_triggers) as trg
  where not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and c.relname = any(v_expected_tables)
      and t.tgname = trg
  );
  if v_missing is not null then
    v_errors := array_append(v_errors, '[TRIGGERS] Faltan triggers de GymTrack: ' || v_missing);
  end if;

  -- 8. Verificar vistas de catálogo (opciones, columnas sin PII, owner y ACLs)
  select count(*) into v_count
  from pg_catalog.pg_views
  where schemaname = 'public'
    and viewname in ('vw_catalogo_gimnasios', 'vw_catalogo_planes');
  if v_count <> 2 then
    v_errors := array_append(v_errors, '[VISTAS] Se esperaban 2 vistas vw_catalogo_* y se encontraron ' || v_count || '.');
  end if;

  -- Proyección exacta de columnas (cero email, cero id_dueno, cero PII)
  select array_agg(column_name::text order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'vw_catalogo_gimnasios';
  if v_cols is distinct from array['id_gimnasio', 'nombre', 'telefono', 'estado'] then
    v_errors := array_append(v_errors, '[VISTA COLUMNAS] vw_catalogo_gimnasios columnas inesperadas: ' || coalesce(array_to_string(v_cols, ', '), 'NULL'));
  end if;

  select array_agg(column_name::text order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'vw_catalogo_planes';
  if v_cols is distinct from array['id_membresia_gimnasio', 'id_gimnasio', 'nombre', 'descripcion', 'precio', 'duracion_dias', 'limite_asistencias_semanales', 'limite_asistencias_totales', 'estado'] then
    v_errors := array_append(v_errors, '[VISTA COLUMNAS] vw_catalogo_planes columnas inesperadas: ' || coalesce(array_to_string(v_cols, ', '), 'NULL'));
  end if;

  for v_rec in
    select c.relname, c.reloptions, c.relacl, c.relowner, pg_catalog.pg_get_userbyid(c.relowner) as owner_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in ('vw_catalogo_gimnasios', 'vw_catalogo_planes')
  loop
    if v_rec.reloptions is null
       or not ('security_barrier=true' = any(v_rec.reloptions))
       or not ('security_invoker=false' = any(v_rec.reloptions)) then
      v_errors := array_append(v_errors, '[VISTA OPCIONES] ' || v_rec.relname || ' debe tener (security_barrier=true, security_invoker=false).');
    end if;

    if v_has_postgres and v_rec.owner_name <> 'postgres' then
      v_errors := array_append(v_errors, '[VISTA OWNER] ' || v_rec.relname || ' pertenece a ' || v_rec.owner_name || ' en lugar de postgres.');
    end if;

    if exists (
      select 1
      from pg_catalog.aclexplode(coalesce(v_rec.relacl, pg_catalog.acldefault('r'::"char", v_rec.relowner))) a
      where a.grantee = 0::oid or (v_role_anon is not null and a.grantee = v_role_anon)
    ) then
      v_errors := array_append(v_errors, '[VISTA ACL] ' || v_rec.relname || ' otorga privilegios a PUBLIC o anon.');
    end if;

    if v_role_auth is not null then
      if not exists (
        select 1
        from pg_catalog.aclexplode(coalesce(v_rec.relacl, pg_catalog.acldefault('r'::"char", v_rec.relowner))) a
        where a.grantee = v_role_auth and a.privilege_type = 'SELECT'
      ) then
        v_errors := array_append(v_errors, '[VISTA ACL] ' || v_rec.relname || ' no concede SELECT a authenticated.');
      end if;

      if exists (
        select 1
        from pg_catalog.aclexplode(coalesce(v_rec.relacl, pg_catalog.acldefault('r'::"char", v_rec.relowner))) a
        where a.grantee = v_role_auth and a.privilege_type <> 'SELECT'
      ) then
        v_errors := array_append(v_errors, '[VISTA ACL] ' || v_rec.relname || ' concede privilegios de escritura a authenticated.');
      end if;
    end if;
  end loop;

  -- 9. Verificar las 43 políticas RLS de tablas GymTrack y cero permisivas
  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = any(v_expected_tables);
  if v_count <> 43 then
    v_errors := array_append(v_errors, '[POLÍTICAS RLS] Se esperaban 43 políticas RLS en tablas GymTrack y se encontraron ' || v_count || '.');
  end if;

  select string_agg(tablename || '.' || policyname, ', ')
    into v_bad
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = any(v_expected_tables)
    and (
      lower(btrim(coalesce(qual, ''))) in ('true', '(true)')
      or lower(btrim(coalesce(with_check, ''))) in ('true', '(true)')
    );
  if v_bad is not null then
    v_errors := array_append(v_errors, '[POLÍTICAS PERMISIVAS] Políticas con USING (true) o WITH CHECK (true): ' || v_bad);
  end if;

  -- 10. Verificar ACLs de las 52 funciones mediante aclexplode + acldefault
  for v_rec in
    select p.oid, p.proname, p.proowner, p.proacl
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(v_expected_funcs)
  loop
    select
      exists (
        select 1 from pg_catalog.aclexplode(coalesce(v_rec.proacl, pg_catalog.acldefault('f'::"char", v_rec.proowner))) a
        where a.grantee = 0::oid and a.privilege_type = 'EXECUTE'
      ),
      exists (
        select 1 from pg_catalog.aclexplode(coalesce(v_rec.proacl, pg_catalog.acldefault('f'::"char", v_rec.proowner))) a
        where v_role_anon is not null and a.grantee = v_role_anon and a.privilege_type = 'EXECUTE'
      ),
      exists (
        select 1 from pg_catalog.aclexplode(coalesce(v_rec.proacl, pg_catalog.acldefault('f'::"char", v_rec.proowner))) a
        where v_role_auth is not null and a.grantee = v_role_auth and a.privilege_type = 'EXECUTE'
      ),
      exists (
        select 1 from pg_catalog.aclexplode(coalesce(v_rec.proacl, pg_catalog.acldefault('f'::"char", v_rec.proowner))) a
        where v_role_svc is not null and a.grantee = v_role_svc and a.privilege_type = 'EXECUTE'
      )
    into v_has_public_acl, v_has_anon_acl, v_has_auth_acl, v_has_svc_acl;

    if v_has_public_acl then
      v_errors := array_append(v_errors, '[ACL FUNCIÓN] PUBLIC tiene EXECUTE directo en ' || v_rec.proname);
    end if;
    if v_has_anon_acl then
      v_errors := array_append(v_errors, '[ACL FUNCIÓN] anon tiene EXECUTE en ' || v_rec.proname);
    end if;

    if v_rec.proname = 'fn_es_service_role' then
      if v_has_auth_acl then
        v_errors := array_append(v_errors, '[ACL FUNCIÓN] authenticated NO debe tener EXECUTE en fn_es_service_role.');
      end if;
      if v_role_svc is not null and not v_has_svc_acl then
        v_errors := array_append(v_errors, '[ACL FUNCIÓN] service_role debe tener EXECUTE en fn_es_service_role.');
      end if;
    elsif v_rec.proname like 'trg_fn_%' then
      if v_has_auth_acl then
        v_errors := array_append(v_errors, '[ACL FUNCIÓN] authenticated NO debe tener EXECUTE en ' || v_rec.proname);
      end if;
    else
      if v_role_auth is not null and not v_has_auth_acl then
        v_errors := array_append(v_errors, '[ACL FUNCIÓN] authenticated debe tener EXECUTE en ' || v_rec.proname);
      end if;
      if v_role_svc is not null and not v_has_svc_acl then
        v_errors := array_append(v_errors, '[ACL FUNCIÓN] service_role debe tener EXECUTE en ' || v_rec.proname);
      end if;
    end if;
  end loop;

  -- 11. Verificar ACLs de las 20 secuencias IDENTITY de GymTrack y tablas solo-RPC
  for v_rec in
    select * from (values
      ('dueno', 'id_dueno', true),
      ('gimnasio', 'id_gimnasio', true),
      ('sucursal', 'id_sucursal', true),
      ('administrador', 'id_administrador', true),
      ('administrador_gimnasio', 'id_administrador_gimnasio', true),
      ('empleado', 'id_empleado', true),
      ('empleado_sucursal', 'id_empleado_sucursal', true),
      ('socio', 'id_socio', true),
      ('socio_gimnasio', 'id_socio_gimnasio', false),
      ('membresia_gimnasio', 'id_membresia_gimnasio', true),
      ('membresia_socio', 'id_membresia_socio', false),
      ('pago', 'id_pago', false),
      ('asistencia_socio', 'id_asistencia_socio', false),
      ('ejercicio_socio', 'id_ejercicio_socio', true),
      ('ejercicio_gimnasio', 'id_ejercicio_gimnasio', true),
      ('rutina_socio', 'id_rutina_socio', true),
      ('rutina_gimnasio', 'id_rutina_gimnasio', true),
      ('rutina_ejercicio_socio', 'id_rutina_ejercicio_socio', true),
      ('rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio', true),
      ('rutinas_asignadas_socio_gimnasio', 'id_rutina_asignada', false)
    ) as t(tbl, col, auth_expects_seq)
  loop
    v_seq_name := pg_catalog.pg_get_serial_sequence('public.' || v_rec.tbl, v_rec.col);
    if v_seq_name is null then
      v_errors := array_append(v_errors, '[SECUENCIA] No se encontró secuencia IDENTITY para public.' || v_rec.tbl || '.' || v_rec.col);
      continue;
    end if;
    v_seq_oid := to_regclass(v_seq_name);

    select
      exists (
        select 1 from pg_catalog.pg_class s,
             pg_catalog.aclexplode(coalesce(s.relacl, pg_catalog.acldefault('s'::"char", s.relowner))) a
        where s.oid = v_seq_oid and a.grantee = 0::oid
      ),
      exists (
        select 1 from pg_catalog.pg_class s,
             pg_catalog.aclexplode(coalesce(s.relacl, pg_catalog.acldefault('s'::"char", s.relowner))) a
        where s.oid = v_seq_oid and v_role_anon is not null and a.grantee = v_role_anon
      ),
      exists (
        select 1 from pg_catalog.pg_class s,
             pg_catalog.aclexplode(coalesce(s.relacl, pg_catalog.acldefault('s'::"char", s.relowner))) a
        where s.oid = v_seq_oid and v_role_auth is not null and a.grantee = v_role_auth and a.privilege_type = 'USAGE'
      ),
      exists (
        select 1 from pg_catalog.pg_class s,
             pg_catalog.aclexplode(coalesce(s.relacl, pg_catalog.acldefault('s'::"char", s.relowner))) a
        where s.oid = v_seq_oid and v_role_auth is not null and a.grantee = v_role_auth and a.privilege_type = 'UPDATE'
      ),
      exists (
        select 1 from pg_catalog.pg_class s,
             pg_catalog.aclexplode(coalesce(s.relacl, pg_catalog.acldefault('s'::"char", s.relowner))) a
        where s.oid = v_seq_oid and v_role_svc is not null and a.grantee = v_role_svc and a.privilege_type = 'USAGE'
      )
    into v_has_public_acl, v_has_anon_acl, v_has_auth_acl, v_has_auth_upd, v_has_svc_acl;

    if v_has_public_acl or v_has_anon_acl then
      v_errors := array_append(v_errors, '[ACL SECUENCIA] PUBLIC o anon tienen privilegios sobre ' || v_seq_name);
    end if;
    if v_has_auth_upd then
      v_errors := array_append(v_errors, '[ACL SECUENCIA] authenticated tiene UPDATE/setval sobre ' || v_seq_name);
    end if;
    if v_role_auth is not null and v_has_auth_acl <> v_rec.auth_expects_seq then
      v_errors := array_append(v_errors, '[ACL SECUENCIA] ' || v_seq_name || ': authenticated USAGE=' || v_has_auth_acl || ' (esperado=' || v_rec.auth_expects_seq || ')');
    end if;
    if v_role_svc is not null and not v_has_svc_acl then
      v_errors := array_append(v_errors, '[ACL SECUENCIA] service_role sin USAGE sobre ' || v_seq_name);
    end if;
  end loop;

  if v_role_auth is not null then
    for v_rec in
      select c.relname, c.relacl, c.relowner
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = any(v_rpc_only_tables)
    loop
      if exists (
        select 1
        from pg_catalog.aclexplode(coalesce(v_rec.relacl, pg_catalog.acldefault('r'::"char", v_rec.relowner))) a
        where a.grantee = v_role_auth
          and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
      ) then
        v_errors := array_append(v_errors, '[TABLA SOLO-RPC] authenticated tiene escritura directa sobre public.' || v_rec.relname);
      end if;
    end loop;
  end if;

  if coalesce(array_length(v_errors, 1), 0) > 0 then
    raise exception E'VERIFICACIÓN GYMTRACK FALLÓ CON % ERROR(ES):\n  - %',
      array_length(v_errors, 1),
      array_to_string(v_errors, E'\n  - ');
  end if;

  raise notice '================================================================';
  raise notice 'VERIFICACIÓN GYMTRACK OK (0 ERRORES, ACOTADO A OBJETOS GYMTRACK):';
  raise notice '  - 20/20 tablas definitivas con RLS habilitado y 0 acceso PUBLIC/anon';
  raise notice '  - 0 tablas/funciones legacy y 0 columna empleado.id_gimnasio';
  raise notice '  - 8/8 FKs compuestas anti-cruce y 7/7 índices únicos/parciales';
  raise notice '  - 52/52 funciones con search_path fijo, SECURITY DEFINER y OWNER postgres';
  raise notice '  - 17/17 triggers y 43/43 políticas RLS (0 permisivas)';
  raise notice '  - 2/2 vistas vw_catalogo_* (columnas sin PII, security_barrier=true, solo SELECT authenticated)';
  raise notice '  - ACLs exactas en funciones, vistas, tablas solo-RPC y 20/20 secuencias';
  raise notice '================================================================';
end $$;

-- ----------------------------------------------------------------------------
-- RESUMEN TABULAR DE SOLO LECTURA (ESTRICTAMENTE ACOTADO A OBJETOS GYMTRACK)
-- ----------------------------------------------------------------------------
with gym_meta as (
  select
    array[
      'dueno', 'gimnasio', 'sucursal', 'administrador', 'administrador_gimnasio',
      'empleado', 'empleado_sucursal', 'socio', 'socio_gimnasio',
      'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
      'ejercicio_socio', 'ejercicio_gimnasio', 'rutina_socio', 'rutina_gimnasio',
      'rutina_ejercicio_socio', 'rutina_ejercicio_gimnasio',
      'rutinas_asignadas_socio_gimnasio'
    ]::text[] as tables,
    array[
      'progreso', 'cadena_gimnasios', 'usuario', 'plan_membresia', 'membresia',
      'asistencia', 'ejercicio', 'rutina', 'rutina_ejercicio'
    ]::text[] as legacy_tables,
    array[
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
      'trg_fn_proteger_sucursal_gimnasio_cambio',
      'trg_fn_proteger_campos_dueno', 'trg_fn_proteger_campos_empleado',
      'trg_fn_proteger_campos_socio', 'trg_fn_proteger_socio_gimnasio',
      'trg_fn_proteger_campos_administrador', 'trg_fn_proteger_admin_gimnasio_cambio',
      'trg_fn_proteger_membresia_socio_inmutable', 'trg_fn_proteger_pago_inmutable',
      'trg_fn_validar_comprobante_unico_gimnasio',
      'trg_fn_validar_asistencia_socio_gimnasio',
      'trg_fn_proteger_propietario_ejercicio_sep',
      'trg_fn_proteger_propietario_rutina_sep',
      'trg_fn_validar_rutina_asignada',
      'rpc_asociar_socio_gimnasio', 'rpc_cambiar_estado_socio_gimnasio',
      'rpc_registrar_administrador_gimnasio', 'rpc_registrar_pago',
      'rpc_actualizar_estado_pago', 'rpc_contratar_membresia',
      'rpc_actualizar_estado_membresia', 'rpc_registrar_socio_gimnasio',
      'rpc_registrar_empleado_sucursal', 'rpc_registrar_ingreso_asistencia',
      'rpc_registrar_salida_asistencia', 'rpc_anular_asistencia',
      'rpc_asignar_rutina_gimnasio_socio', 'rpc_reasignar_responsable_rutina_asignada',
      'rpc_finalizar_rutina_asignada', 'rpc_reordenar_rutina_socio_ejercicios',
      'rpc_reordenar_rutina_gimnasio_ejercicios', 'rpc_vincular_identidad_perfil'
    ]::text[] as funcs
)
select 'tablas_gymtrack' as categoria, count(*) as obtenido, 20 as esperado,
       case when count(*) = 20 then 'OK' else 'ERROR' end as estado
from pg_catalog.pg_tables, gym_meta
where schemaname = 'public' and tablename = any(gym_meta.tables)
union all
select 'tablas_gymtrack_con_rls', count(*), 20,
       case when count(*) = 20 then 'OK' else 'ERROR' end
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace, gym_meta
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname = any(gym_meta.tables)
union all
select 'tablas_legacy_presentes', count(*), 0,
       case when count(*) = 0 then 'OK' else 'ERROR' end
from pg_catalog.pg_tables, gym_meta
where schemaname = 'public' and tablename = any(gym_meta.legacy_tables)
union all
select 'vistas_catalogo_gymtrack', count(*), 2,
       case when count(*) = 2 then 'OK' else 'ERROR' end
from pg_catalog.pg_views
where schemaname = 'public' and viewname in ('vw_catalogo_gimnasios', 'vw_catalogo_planes')
union all
select 'funciones_gymtrack', count(*), 52,
       case when count(*) = 52 then 'OK' else 'ERROR' end
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace, gym_meta
where n.nspname = 'public' and p.proname = any(gym_meta.funcs)
union all
select 'triggers_gymtrack', count(*), 17,
       case when count(*) = 17 then 'OK' else 'ERROR' end
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace, gym_meta
where n.nspname = 'public' and not t.tgisinternal and c.relname = any(gym_meta.tables)
union all
select 'politicas_rls_gymtrack', count(*), 43,
       case when count(*) = 43 then 'OK' else 'ERROR' end
from pg_catalog.pg_policies, gym_meta
where schemaname = 'public' and tablename = any(gym_meta.tables);
