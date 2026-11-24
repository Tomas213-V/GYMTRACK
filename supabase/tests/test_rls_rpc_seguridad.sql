-- ============================================================================
-- GYMTRACK — SUITE TRANSACCIONAL DE PRUEBAS RLS, PRIVILEGIOS Y RPCs
--
-- Diseñada para ejecutarse contra el esquema reconstruido desde cero:
--   supabase/01_instalacion_definitiva.sql
--
-- Cobertura:
--   1. Identidad (socio, dueño, admin gym, admin sucursal, recepcionista,
--      entrenador, anon, service_role, rpc_vincular_identidad_perfil,
--      rpc_registrar_administrador_gimnasio, empleado reutilizable).
--   2. Aislamiento multi-tenant y ownership.
--   3. Membresías y pagos (contratación, renovación anticipada, post-vencimiento,
--      sobrepago bloqueado, pago parcial no activa, comprobante duplicado
--      por gimnasio incluso bajo service_role, anulación revierte a pendiente
--      sin perder historial, transición inválida, FK compuestas).
--   4. Asistencias (vigente, sin asociación, vencida, doble abierta en mismo
--      gimnasio bloqueada pero permitida en otro gimnasio, límite de 3 asistencias
--      por día y por gimnasio sumando sucursales e independiente por gimnasio,
--      salida ajena, anulación con auditoría anulada_por/anulada_en).
--   5. Rutinas, ejercicios separados, empleados reutilizables entre gimnasios y
--      preservación/reasignación del responsable histórico de rutinas.
--   6. Permisos ACL (directos vs heredados), secuencias, vistas vw_catalogo_*
--      y ausencia de progreso y objetos legacy.
--
-- SEGURIDAD DE EJECUCIÓN:
--   - Envuelto en BEGIN ... ROLLBACK; no persiste ningún dato ni modifica esquema.
--   - Ejecutar ÚNICAMENTE en staging o base de pruebas aislada después de
--     supabase/01_instalacion_definitiva.sql.
-- ============================================================================

begin;

-- Helpers temporales de test (se destruyen automáticamente al hacer ROLLBACK)
create or replace function pg_temp.set_jwt(
  p_role text,
  p_uid uuid default null,
  p_email text default null
)
returns void
language plpgsql
as $$
declare
  v_claims jsonb := '{}'::jsonb;
begin
  if p_role = 'anon' then
    perform pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
    perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
    perform pg_catalog.set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
    execute 'set local role anon';
  elsif p_role = 'authenticated' then
    if p_uid is null then
      raise exception 'pg_temp.set_jwt(authenticated) requiere p_uid.';
    end if;
    v_claims := jsonb_build_object('role', 'authenticated', 'sub', p_uid::text);
    if p_email is not null then
      v_claims := v_claims || jsonb_build_object('email', p_email);
    end if;
    perform pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
    perform pg_catalog.set_config('request.jwt.claim.sub', p_uid::text, true);
    perform pg_catalog.set_config('request.jwt.claims', v_claims::text, true);
    execute 'set local role authenticated';
  elsif p_role = 'service_role' then
    perform pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
    perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
    perform pg_catalog.set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
    execute 'set local role service_role';
  else
    perform pg_catalog.set_config('request.jwt.claim.role', '', true);
    perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
    perform pg_catalog.set_config('request.jwt.claims', '', true);
    execute 'reset role';
  end if;
end;
$$;

create or replace function pg_temp.assert_true(p_cond boolean, p_msg text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_cond, false) is not true then
    raise exception 'ASSERTION FAILED: %', p_msg;
  end if;
end;
$$;

create or replace function pg_temp.acl_tiene_privilegio_directo(
  p_acl aclitem[],
  p_owner oid,
  p_obj_type "char",
  p_rol text,
  p_priv text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_catalog.aclexplode(coalesce(p_acl, pg_catalog.acldefault(p_obj_type, p_owner))) a
    left join pg_catalog.pg_roles r on r.oid = a.grantee
    where a.privilege_type = p_priv
      and (
        (p_rol = 'PUBLIC' and a.grantee = 0::oid)
        or (p_rol <> 'PUBLIC' and r.rolname = p_rol)
      )
  );
$$;

create or replace function pg_temp.acl_tiene_privilegio_heredado(
  p_acl aclitem[],
  p_owner oid,
  p_obj_type "char",
  p_rol text,
  p_priv text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_catalog.aclexplode(coalesce(p_acl, pg_catalog.acldefault(p_obj_type, p_owner))) a
    left join pg_catalog.pg_roles r on r.oid = a.grantee
    where a.privilege_type = p_priv
      and p_rol <> 'PUBLIC'
      and (
        a.grantee = 0::oid
        or (
          a.grantee <> 0::oid
          and r.rolname is distinct from p_rol
          and pg_catalog.pg_has_role(p_rol, a.grantee, 'MEMBER')
        )
      )
  );
$$;

-- Ejecuta una sentencia bajo un rol/JWT específico esperando que falle
create or replace function pg_temp.assert_fails_as(
  p_role text,
  p_uid uuid,
  p_sql text,
  p_msg text
)
returns void
language plpgsql
as $$
declare
  v_failed boolean := false;
begin
  perform pg_temp.set_jwt(p_role, p_uid);
  begin
    execute p_sql;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.set_jwt('reset');

  if not v_failed then
    raise exception 'ASSERTION FAILED (se esperaba error y tuvo éxito): % | SQL: %', p_msg, p_sql;
  end if;
end;
$$;

do $$
declare
  -- UUIDs determinísticos de prueba (no existen fuera de esta transacción)
  v_uid_dueno_a      uuid := '11111111-1111-4111-8111-000000000001';
  v_uid_dueno_b      uuid := '11111111-1111-4111-8111-000000000002';
  v_uid_admin_org    uuid := '11111111-1111-4111-8111-000000000003';
  v_uid_admin_suc    uuid := '11111111-1111-4111-8111-000000000004';
  v_uid_recep_a1     uuid := '11111111-1111-4111-8111-000000000005';
  v_uid_trainer_a1   uuid := '11111111-1111-4111-8111-000000000006';
  v_uid_trainer_b1   uuid := '11111111-1111-4111-8111-000000000007';
  v_uid_socio_1      uuid := '11111111-1111-4111-8111-000000000008';
  v_uid_socio_2      uuid := '11111111-1111-4111-8111-000000000009';
  v_uid_unverified   uuid := '11111111-1111-4111-8111-000000000010';
  v_uid_multi_perfil uuid := '11111111-1111-4111-8111-000000000011';

  -- IDs de dominio
  v_id_dueno_a   bigint;
  v_id_dueno_b   bigint;
  v_id_gym_a     bigint;
  v_id_gym_b     bigint;
  v_id_gym_c     bigint;
  v_id_suc_a1    bigint;
  v_id_suc_a2    bigint;
  v_id_suc_b1    bigint;
  v_id_plan_a1   bigint;
  v_id_plan_b1   bigint;
  v_id_admin_org bigint;
  v_id_ag_a      bigint;
  v_id_ag_b      bigint;
  v_id_emp_adm   bigint;
  v_id_emp_rec   bigint;
  v_id_emp_trn_a bigint;
  v_id_emp_trn_b bigint;
  v_id_socio_1   bigint;
  v_id_socio_2   bigint;
  v_id_socio_multi bigint;

  v_sg_s1_a      public.socio_gimnasio%rowtype;
  v_sg_s1_b      public.socio_gimnasio%rowtype;
  v_res_json     jsonb;
  v_cnt          integer;
  v_m1           public.membresia_socio%rowtype;
  v_m2           public.membresia_socio%rowtype;
  v_m3           public.membresia_socio%rowtype;
  v_m_pend       public.membresia_socio%rowtype;
  v_m_exp        public.membresia_socio%rowtype;
  v_p1           public.pago%rowtype;
  v_p2           public.pago%rowtype;
  v_p_rech       public.pago%rowtype;
  v_a1           public.asistencia_socio%rowtype;
  v_a2           public.asistencia_socio%rowtype;
  v_a3           public.asistencia_socio%rowtype;
  v_ej_soc       bigint;
  v_rut_soc      bigint;
  v_res1         bigint;
  v_res2         bigint;
  v_ej_gym_a     bigint;
  v_rut_gym_a    bigint;
  v_reg1         bigint;
  v_reg2         bigint;
  v_asig1        public.rutinas_asignadas_socio_gimnasio%rowtype;
  v_asig2        public.rutinas_asignadas_socio_gimnasio%rowtype;
  v_estado_m     varchar;
begin
  -- ==========================================================================
  -- 0. SEED DE USUARIOS AUTH Y FIXTURES BASE (bajo rol administrador SQL)
  -- ==========================================================================
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_uid_dueno_a,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_dueno_a@gymtrack.test',      '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_dueno_b,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_dueno_b@gymtrack.test',      '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_admin_org,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_admin_org@gymtrack.test',    '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_admin_suc,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_admin_suc@gymtrack.test',    '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_recep_a1,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_recep_a1@gymtrack.test',     '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_trainer_a1,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_trainer_a1@gymtrack.test',   '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_trainer_b1,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_trainer_b1@gymtrack.test',   '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_socio_1,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_socio_1@gymtrack.test',      '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_socio_2,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_socio_2@gymtrack.test',      '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_unverified,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_unverified@gymtrack.test',   '$2a$10$test', null,  '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_uid_multi_perfil, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sec_multi_perfil@gymtrack.test', '$2a$10$test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.dueno (auth_user_id, nombre, apellido, email)
  values (v_uid_dueno_a, 'Dueño', 'Alfa', 'sec_dueno_a@gymtrack.test')
  returning id_dueno into v_id_dueno_a;

  insert into public.dueno (auth_user_id, nombre, apellido, email)
  values (v_uid_dueno_b, 'Dueño', 'Beta', 'sec_dueno_b@gymtrack.test')
  returning id_dueno into v_id_dueno_b;

  insert into public.gimnasio (nombre, id_dueno, estado) values ('Gym A', v_id_dueno_a, true) returning id_gimnasio into v_id_gym_a;
  insert into public.gimnasio (nombre, id_dueno, estado) values ('Gym B', v_id_dueno_b, true) returning id_gimnasio into v_id_gym_b;
  insert into public.gimnasio (nombre, id_dueno, estado) values ('Gym C', v_id_dueno_b, true) returning id_gimnasio into v_id_gym_c;

  insert into public.sucursal (direccion, id_gimnasio, estado) values ('Sucursal A1', v_id_gym_a, true) returning id_sucursal into v_id_suc_a1;
  insert into public.sucursal (direccion, id_gimnasio, estado) values ('Sucursal A2', v_id_gym_a, true) returning id_sucursal into v_id_suc_a2;
  insert into public.sucursal (direccion, id_gimnasio, estado) values ('Sucursal B1', v_id_gym_b, true) returning id_sucursal into v_id_suc_b1;

  insert into public.membresia_gimnasio (nombre, precio, duracion_dias, estado, id_gimnasio)
  values ('Plan A Mensual', 20000, 30, true, v_id_gym_a)
  returning id_membresia_gimnasio into v_id_plan_a1;

  insert into public.membresia_gimnasio (nombre, precio, duracion_dias, estado, id_gimnasio)
  values ('Plan B Mensual', 30000, 30, true, v_id_gym_b)
  returning id_membresia_gimnasio into v_id_plan_b1;

  insert into public.administrador (auth_user_id, nombre, apellido, email, estado)
  values (v_uid_admin_org, 'Admin', 'Org', 'sec_admin_org@gymtrack.test', true)
  returning id_administrador into v_id_admin_org;

  insert into public.administrador_gimnasio (id_administrador, id_gimnasio, estado)
  values (v_id_admin_org, v_id_gym_a, true) returning id_administrador_gimnasio into v_id_ag_a;
  insert into public.administrador_gimnasio (id_administrador, id_gimnasio, estado)
  values (v_id_admin_org, v_id_gym_b, true) returning id_administrador_gimnasio into v_id_ag_b;

  insert into public.empleado (auth_user_id, nombre, apellido, email, estado)
  values (v_uid_admin_suc, 'Admin', 'SucA1', 'sec_admin_suc@gymtrack.test', true)
  returning id_empleado into v_id_emp_adm;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado) values ('administrador', v_id_emp_adm, v_id_suc_a1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, email, estado)
  values (v_uid_recep_a1, 'Recep', 'A1', 'sec_recep_a1@gymtrack.test', true)
  returning id_empleado into v_id_emp_rec;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado) values ('recepcionista', v_id_emp_rec, v_id_suc_a1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, email, estado)
  values (v_uid_trainer_a1, 'Trainer', 'A1', 'sec_trainer_a1@gymtrack.test', true)
  returning id_empleado into v_id_emp_trn_a;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado) values ('entrenador', v_id_emp_trn_a, v_id_suc_a1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, email, estado)
  values (v_uid_trainer_b1, 'Trainer', 'B1', 'sec_trainer_b1@gymtrack.test', true)
  returning id_empleado into v_id_emp_trn_b;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado) values ('entrenador', v_id_emp_trn_b, v_id_suc_b1, true);

  insert into public.socio (auth_user_id, nombre, apellido, dni, email, estado)
  values (v_uid_socio_1, 'Socio', 'Uno', 'SEC-DNI-001', 'sec_socio_1@gymtrack.test', true)
  returning id_socio into v_id_socio_1;

  insert into public.socio (auth_user_id, nombre, apellido, dni, email, estado)
  values (v_uid_socio_2, 'Socio', 'Dos', 'SEC-DNI-002', 'sec_socio_2@gymtrack.test', true)
  returning id_socio into v_id_socio_2;

  -- Perfiles sin vincular para probar rpc_vincular_identidad_perfil (unverified + multi-perfil)
  insert into public.socio (auth_user_id, nombre, apellido, dni, email, estado)
  values (null, 'No', 'Verif', 'SEC-DNI-UNV', 'sec_unverified@gymtrack.test', true);

  insert into public.socio (auth_user_id, nombre, apellido, dni, email, estado)
  values (null, 'Multi', 'Perfil', 'SEC-DNI-MP', 'sec_multi_perfil@gymtrack.test', true)
  returning id_socio into v_id_socio_multi;

  insert into public.empleado (auth_user_id, nombre, apellido, email, estado)
  values (null, 'Multi', 'Emp', 'sec_multi_perfil@gymtrack.test', true);

  -- ==========================================================================
  -- 1. IDENTIDAD Y SERVICE_ROLE / ANON / VINCULACIÓN
  -- ==========================================================================
  -- 1.1 anon bloqueado en tablas, vistas de catálogo y RPCs
  perform pg_temp.assert_fails_as('anon', null, 'select count(*) from public.socio', 'anon no puede leer public.socio');
  perform pg_temp.assert_fails_as('anon', null, 'select count(*) from public.vw_catalogo_gimnasios', 'anon no tiene SELECT en vw_catalogo_gimnasios');
  perform pg_temp.assert_fails_as('anon', null, 'select count(*) from public.vw_catalogo_planes', 'anon no tiene SELECT en vw_catalogo_planes');
  perform pg_temp.assert_fails_as('anon', null, format('select public.rpc_asociar_socio_gimnasio(%s, %s)', v_id_gym_a, v_id_socio_1), 'anon no puede invocar rpc_asociar_socio_gimnasio');

  -- 1.2 fn_es_service_role() bloqueado para authenticated y spoofing de JWT rechazado
  perform pg_temp.assert_fails_as('authenticated', v_uid_socio_1, 'select public.fn_es_service_role()', 'authenticated no puede invocar fn_es_service_role');

  perform pg_temp.set_jwt('service_role');
  perform pg_temp.assert_true(public.fn_es_service_role() = true, 'service_role genuino con auth.uid() IS NULL debe devolver true');
  -- Claims contradictorias (claim.role = service_role vs JSON claims con sub/authenticated) deben rechazarse
  perform pg_catalog.set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', v_uid_socio_1::text)::text, true);
  perform pg_temp.assert_true(public.fn_es_service_role() = false, 'Claims JSON con role=authenticated/sub no nulo deben invalidar fn_es_service_role');
  -- JSON inválido o no-objeto en request.jwt.claims tampoco debe aprobar service_role ni lanzar excepción
  perform pg_catalog.set_config('request.jwt.claims', 'no-es-json', true);
  perform pg_temp.assert_true(public.fn_es_service_role() = false, 'request.jwt.claims malformado sin llaves debe devolver false');
  perform pg_catalog.set_config('request.jwt.claims', '{malformed: json}', true);
  perform pg_temp.assert_true(public.fn_es_service_role() = false, 'request.jwt.claims con llaves y JSON inválido debe devolver false sin error');
  perform pg_catalog.set_config('request.jwt.claims', '["service_role"]', true);
  perform pg_temp.assert_true(public.fn_es_service_role() = false, 'request.jwt.claims no-objeto JSON debe devolver false');
  perform pg_temp.set_jwt('reset');

  -- Admin organizacional NO puede alterar empleado.auth_user_id ni cambiar gimnasio de empleado
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_admin_org,
    format('update public.empleado set auth_user_id = %L where id_empleado = %s', v_uid_admin_org, v_id_emp_rec),
    'Admin no puede apropiarse de empleado.auth_user_id'
  );

  -- rpc_registrar_administrador_gimnasio: Dueño A puede crear y asignar atómicamente; tercero no dueño falla
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_res_json := public.rpc_registrar_administrador_gimnasio(v_id_gym_a, 'Nuevo', 'AdminA', 'sec_nuevo_admin_a@gymtrack.test', '99111222', null);
  perform pg_temp.assert_true((v_res_json ->> 'creado')::boolean = true, 'Dueño A crea y asigna administrador organizacional vía RPC');
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_b,
    format($q$select public.rpc_registrar_administrador_gimnasio(%s, 'Hack', 'Admin', 'sec_hack_adm@gymtrack.test')$q$, v_id_gym_a),
    'Dueño B no puede registrar administrador en Gym A'
  );

  -- Protección por columna en gimnasio: dueño no puede mutar id_dueno
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('update public.gimnasio set id_dueno = %s where id_gimnasio = %s', v_id_dueno_b, v_id_gym_a),
    'Dueño A no puede transferir id_dueno por privilegio de columna'
  );

  -- 1.3 rpc_vincular_identidad_perfil exige correo verificado, permite multi-perfil y bloquea robo de perfil ajeno
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_unverified,
    $q$select public.rpc_vincular_identidad_perfil('socio')$q$,
    'No debe vincular perfil cuando email_confirmed_at IS NULL'
  );

  perform pg_temp.set_jwt('authenticated', v_uid_multi_perfil, 'sec_multi_perfil@gymtrack.test');
  v_res_json := public.rpc_vincular_identidad_perfil('socio');
  perform pg_temp.assert_true((v_res_json ->> 'vinculado')::boolean, 'Multi-perfil vincula socio');
  v_res_json := public.rpc_vincular_identidad_perfil('empleado');
  perform pg_temp.assert_true((v_res_json ->> 'vinculado')::boolean, 'Multi-perfil vincula también empleado con el mismo auth_user_id');
  perform pg_temp.set_jwt('reset');

  -- Socio 2 no puede vincular un perfil socio ajeno ni alterar auth_user_id
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_2,
    format('update public.socio set auth_user_id = %L where id_socio = %s', v_uid_socio_2, v_id_socio_1),
    'Socio no puede modificar auth_user_id por privilegio ni trigger'
  );

  -- ==========================================================================
  -- 2. AISLAMIENTO MULTI-TENANT Y ASOCIACIONES socio_gimnasio
  -- ==========================================================================
  -- Socio 1 NO puede auto-asociarse directamente en socio_gimnasio ni vía RPC
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('insert into public.socio_gimnasio (id_socio, id_gimnasio) values (%s, %s)', v_id_socio_1, v_id_gym_a),
    'Socio no puede hacer INSERT directo en socio_gimnasio'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('select public.rpc_asociar_socio_gimnasio(%s, %s)', v_id_gym_a, v_id_socio_1),
    'Socio no puede auto-asociarse mediante rpc_asociar_socio_gimnasio'
  );

  -- Dueño A asocia a Socio 1 en Gym A; Recepcionista de Gym B / Dueño B asocia Socio 1 en Gym B
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_sg_s1_a := public.rpc_asociar_socio_gimnasio(v_id_gym_a, v_id_socio_1);
  perform pg_temp.set_jwt('reset');

  perform pg_temp.set_jwt('authenticated', v_uid_dueno_b);
  v_sg_s1_b := public.rpc_asociar_socio_gimnasio(v_id_gym_b, v_id_socio_1);
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_true(v_sg_s1_a.id_socio = v_id_socio_1 and v_sg_s1_a.id_gimnasio = v_id_gym_a, 'Socio 1 asociado a Gym A');
  perform pg_temp.assert_true(v_sg_s1_b.id_socio = v_id_socio_1 and v_sg_s1_b.id_gimnasio = v_id_gym_b, 'Mismo socio 1 asociado a Gym B con una sola cuenta');

  -- Aislamiento: Socio 1 ve Gym A y B pero NO Gym C
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  select count(*) into v_cnt from public.gimnasio where id_gimnasio in (v_id_gym_a, v_id_gym_b, v_id_gym_c);
  perform pg_temp.assert_true(v_cnt = 2, 'Socio 1 solo debe ver los 2 gimnasios donde está asociado (no Gym C)');
  -- Catálogo controlado (vistas) visible para authenticated (solo activos, solo lectura, sin PII)
  select count(*) into v_cnt from public.vw_catalogo_gimnasios where id_gimnasio in (v_id_gym_a, v_id_gym_b, v_id_gym_c);
  perform pg_temp.assert_true(v_cnt = 3, 'vw_catalogo_gimnasios muestra catálogo activo controlado');
  perform pg_temp.set_jwt('reset');

  -- Comprobar que gimnasios inactivos y planes inactivos NO se filtran en vw_catalogo_*
  update public.gimnasio set estado = false where id_gimnasio = v_id_gym_c;
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  select count(*) into v_cnt from public.vw_catalogo_gimnasios where id_gimnasio = v_id_gym_c;
  perform pg_temp.assert_true(v_cnt = 0, 'vw_catalogo_gimnasios no debe exponer gimnasios inactivos');
  perform pg_temp.set_jwt('reset');
  update public.gimnasio set estado = true where id_gimnasio = v_id_gym_c;

  -- authenticated no puede escribir (INSERT/UPDATE/DELETE) a través de las vistas de catálogo
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('update public.vw_catalogo_gimnasios set nombre = ''Hack'' where id_gimnasio = %s', v_id_gym_a),
    'authenticated no puede actualizar a través de vw_catalogo_gimnasios'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('delete from public.vw_catalogo_planes where id_gimnasio = %s', v_id_gym_a),
    'authenticated no puede eliminar a través de vw_catalogo_planes'
  );

  -- Admin Org ve Gym A (2 sucursales) y Gym B, NO Gym C; al desactivar Gym B conserva Gym A
  perform pg_temp.set_jwt('authenticated', v_uid_admin_org);
  select count(*) into v_cnt from public.sucursal where id_gimnasio = v_id_gym_a;
  perform pg_temp.assert_true(v_cnt = 2, 'Admin Org accede a todas las sucursales de Gym A');
  select count(*) into v_cnt from public.sucursal where id_gimnasio = v_id_gym_c;
  perform pg_temp.assert_true(v_cnt = 0, 'Admin Org no ve sucursales de Gym C');
  perform pg_temp.set_jwt('reset');

  perform pg_temp.set_jwt('authenticated', v_uid_dueno_b);
  update public.administrador_gimnasio set estado = false where id_administrador_gimnasio = v_id_ag_b;
  perform pg_temp.set_jwt('reset');

  perform pg_temp.set_jwt('authenticated', v_uid_admin_org);
  select count(*) into v_cnt from public.sucursal where id_gimnasio = v_id_gym_b;
  perform pg_temp.assert_true(v_cnt = 0, 'Admin Org pierde acceso a Gym B tras desactivación');
  select count(*) into v_cnt from public.sucursal where id_gimnasio = v_id_gym_a;
  perform pg_temp.assert_true(v_cnt = 2, 'Admin Org conserva acceso intacto a Gym A');
  perform pg_temp.set_jwt('reset');

  -- Recepcionista de Sucursal A1 solo ve Sucursal A1 y no Sucursal A2 ni Gym B
  perform pg_temp.set_jwt('authenticated', v_uid_recep_a1);
  select count(*) into v_cnt from public.sucursal;
  perform pg_temp.assert_true(v_cnt = 1, 'Recepcionista A1 limitado estrictamente a su sucursal');
  perform pg_temp.set_jwt('reset');

  -- Dueño B no puede alterar gimnasios ni socios ajenos de Gym A
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_b,
    format('select public.rpc_asociar_socio_gimnasio(%s, %s)', v_id_gym_a, v_id_socio_2),
    'Dueño B no puede asociar socios en Gym A'
  );

  -- Socio no puede cambiar su socio_gimnasio.estado; Dueño A sí puede desactivar y reactivar vía rpc_cambiar_estado_socio_gimnasio
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('select public.rpc_cambiar_estado_socio_gimnasio(%s, false)', v_sg_s1_a.id_socio_gimnasio),
    'Socio no puede modificar estado de su asociación socio_gimnasio'
  );
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_sg_s1_a := public.rpc_cambiar_estado_socio_gimnasio(v_sg_s1_a.id_socio_gimnasio, false);
  perform pg_temp.assert_true(v_sg_s1_a.estado = false, 'rpc_cambiar_estado_socio_gimnasio desactiva asociación');
  v_sg_s1_a := public.rpc_cambiar_estado_socio_gimnasio(v_sg_s1_a.id_socio_gimnasio, true);
  perform pg_temp.assert_true(v_sg_s1_a.estado = true, 'rpc_cambiar_estado_socio_gimnasio reactiva asociación');
  perform pg_temp.set_jwt('reset');

  -- ==========================================================================
  -- 3. MEMBRESÍAS Y PAGOS (STATE MACHINE, SOBREPAGO, PARCIALES, ANULACIÓN)
  -- ==========================================================================
  -- 3.1 Escritura directa en membresia_socio y pago bloqueada para authenticated
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, fecha_inicio, fecha_vencimiento, estado) values (%s, %s, %s, 1, 30, current_date, current_date + 30, ''activa'')', v_sg_s1_a.id_socio_gimnasio, v_id_plan_a1, v_id_gym_a),
    'INSERT directo en membresia_socio debe fallar'
  );

  -- 3.2 Contratación inicial con pago completo vía Recepcionista A1
  perform pg_temp.set_jwt('authenticated', v_uid_recep_a1);
  v_res_json := public.rpc_contratar_membresia(v_id_socio_1, v_id_plan_a1, current_date, 'activa', true, 'efectivo', 'aprobado', 'REC-INIT-1');
  select * into v_m1 from public.membresia_socio where id_membresia_socio = (v_res_json -> 'membresia_socio' ->> 'id_membresia_socio')::bigint;
  perform pg_temp.assert_true(v_m1.estado = 'activa', 'Primera contratación activa con pago aprobado');

  -- 3.3 Renovación anticipada encadena fecha_inicio = v_m1.fecha_vencimiento + 1
  v_res_json := public.rpc_contratar_membresia(v_id_socio_1, v_id_plan_a1, current_date, 'activa', true, 'transferencia', 'aprobado', 'REC-RENOV-1');
  select * into v_m2 from public.membresia_socio where id_membresia_socio = (v_res_json -> 'membresia_socio' ->> 'id_membresia_socio')::bigint;
  perform pg_temp.assert_true(v_m2.id_membresia_socio <> v_m1.id_membresia_socio, 'Renovación crea nueva fila preservando historial');
  perform pg_temp.assert_true(v_m2.fecha_inicio = (v_m1.fecha_vencimiento + 1), 'Renovación anticipada encadena fecha_vencimiento + 1');

  -- 3.4 Contratación pendiente y flujo de pago parcial -> completo -> sobrepago -> anulación
  --     Usamos Socio 2 asociado por Dueño A (sin membresía previa)
  perform pg_temp.set_jwt('reset');
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  perform public.rpc_asociar_socio_gimnasio(v_id_gym_a, v_id_socio_2);
  v_res_json := public.rpc_contratar_membresia(v_id_socio_2, v_id_plan_a1, current_date, 'pendiente', false);
  select * into v_m_pend from public.membresia_socio where id_membresia_socio = (v_res_json -> 'membresia_socio' ->> 'id_membresia_socio')::bigint;
  perform pg_temp.assert_true(v_m_pend.estado = 'pendiente' and v_m_pend.precio = 20000, 'Membresía nace pendiente con precio 20000');

  -- Pago parcial de 8000 aprobado NO debe activar la membresía (requiere 20000)
  v_p1 := public.rpc_registrar_pago(v_m_pend.id_membresia_socio, 8000, 'efectivo', 'aprobado', 'COMP-PARCIAL-1');
  select estado into v_estado_m from public.membresia_socio where id_membresia_socio = v_m_pend.id_membresia_socio;
  perform pg_temp.assert_true(v_estado_m = 'pendiente', 'Pago parcial (8000/20000) NO debe activar la membresía');

  -- Comprobante duplicado en mismo gimnasio debe fallar
  perform pg_temp.set_jwt('reset');
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_registrar_pago(%s, 12000, 'efectivo', 'aprobado', 'comp-parcial-1')$q$, v_m_pend.id_membresia_socio),
    'Comprobante duplicado en el mismo gimnasio debe rechazarse (case-insensitive)'
  );

  -- Sobrepago (8000 + 15000 = 23000 > 20000) debe fallar
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_registrar_pago(%s, 15000, 'efectivo', 'aprobado', 'COMP-EXCESO')$q$, v_m_pend.id_membresia_socio),
    'Sobrepago por encima del precio contratado debe rechazarse'
  );

  -- Pago complementario exacto (12000) completa 20000 y activa la membresía
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_p2 := public.rpc_registrar_pago(v_m_pend.id_membresia_socio, 12000, 'transferencia', 'aprobado', 'COMP-COMPLETA-2');
  select estado into v_estado_m from public.membresia_socio where id_membresia_socio = v_m_pend.id_membresia_socio;
  perform pg_temp.assert_true(v_estado_m = 'activa', 'Pago complementario completo (20000/20000) activa la membresía');

  -- Anular v_p2 revierte membresía a 'pendiente' SIN eliminar historial de pago ni membresía
  v_p2 := public.rpc_actualizar_estado_pago(v_p2.id_pago, 'anulado');
  select estado into v_estado_m from public.membresia_socio where id_membresia_socio = v_m_pend.id_membresia_socio;
  perform pg_temp.assert_true(v_estado_m = 'pendiente' and v_p2.estado = 'anulado', 'Anular pago aprobado revierte membresía a pendiente conservando historial');

  -- Pago rechazado y transiciones inválidas
  v_p_rech := public.rpc_registrar_pago(v_m_pend.id_membresia_socio, 12000, 'tarjeta', 'rechazado', 'COMP-RECH-1');
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_actualizar_estado_pago(%s, 'aprobado')$q$, v_p2.id_pago),
    'No se puede reactivar un pago anulado'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_actualizar_estado_pago(%s, 'aprobado')$q$, v_p_rech.id_pago),
    'Un pago rechazado no puede pasar a aprobado'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('update public.membresia_socio set estado = ''activa'' where id_membresia_socio = %s', v_m_pend.id_membresia_socio),
    'UPDATE directo en membresia_socio debe fallar'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_2,
    format($q$select public.rpc_actualizar_estado_membresia(%s, 'activa', null)$q$, v_m_pend.id_membresia_socio),
    'Socio no puede invocar rpc_actualizar_estado_membresia'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_actualizar_estado_membresia(%s, 'activa', null)$q$, v_m_pend.id_membresia_socio),
    'rpc_actualizar_estado_membresia no debe activar membresía pendiente sin cobertura total aprobada (8000/20000)'
  );

  -- 3.4b Múltiples pagos aprobados y anulación en membresía vencida: conservar 'vencida'
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, fecha_inicio, fecha_vencimiento, estado)
  values (v_sg_s1_b.id_socio_gimnasio, v_id_plan_b1, v_id_gym_b, 30000, 30, current_date - 45, current_date - 15, 'activa')
  returning * into v_m_exp;

  perform pg_temp.set_jwt('authenticated', v_uid_dueno_b);
  v_p1 := public.rpc_registrar_pago(v_m_exp.id_membresia_socio, 15000, 'efectivo', 'aprobado', 'COMP-EXP-1');
  v_p2 := public.rpc_registrar_pago(v_m_exp.id_membresia_socio, 15000, 'efectivo', 'aprobado', 'COMP-EXP-2');
  v_p2 := public.rpc_actualizar_estado_pago(v_p2.id_pago, 'anulado');
  select estado into v_estado_m from public.membresia_socio where id_membresia_socio = v_m_exp.id_membresia_socio;
  perform pg_temp.assert_true(v_estado_m = 'vencida', 'Anular pago de membresía ya vencida debe conservar estado vencida (no volver a pendiente)');
  perform pg_temp.set_jwt('reset');

  -- 3.5 Renovación post-vencimiento arranca desde current_date
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_b);
  v_res_json := public.rpc_contratar_membresia(v_id_socio_1, v_id_plan_b1, current_date, 'activa', true, 'efectivo', 'aprobado', 'REC-B-POST');
  select * into v_m3 from public.membresia_socio where id_membresia_socio = (v_res_json -> 'membresia_socio' ->> 'id_membresia_socio')::bigint;
  perform pg_temp.assert_true(v_m3.fecha_inicio = current_date, 'Renovación post-vencimiento comienza en current_date');
  perform pg_temp.set_jwt('reset');

  -- Integridad de FK compuesta: intentar cruzar socio_gimnasio de Gym A con plan de Gym B debe fallar
  perform pg_temp.assert_fails_as(
    'service_role',
    null,
    format('insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, fecha_inicio, fecha_vencimiento, estado) values (%s, %s, %s, 1000, 30, current_date, current_date + 30, ''activa'')', v_sg_s1_a.id_socio_gimnasio, v_id_plan_b1, v_id_gym_b),
    'FK compuesta fk_contrato_socio_gimnasio debe bloquear cruce de gimnasio'
  );

  -- Unicidad de comprobante en todo el gimnasio INCLUSO mediante service_role directo entre contratos distintos
  -- REC-INIT-1 pertenece a v_m1 (Gym A); intentar insertarlo en v_m2 (otra contratación del mismo Gym A) debe fallar
  perform pg_temp.assert_fails_as(
    'service_role',
    null,
    format($q$insert into public.pago (id_membresia_socio, monto, metodo_pago, estado, comprobante) values (%s, 1000, 'efectivo', 'aprobado', '  rec-init-1  ')$q$, v_m2.id_membresia_socio),
    'trg_validar_comprobante_unico_gimnasio debe bloquear comprobante duplicado entre contratos distintos del mismo gym incluso bajo service_role'
  );

  -- Mismo comprobante SÍ puede usarse en OTRO gimnasio independiente (Gym B -> v_m3)
  perform pg_temp.set_jwt('service_role');
  insert into public.pago (id_membresia_socio, monto, metodo_pago, estado, comprobante)
  values (v_m3.id_membresia_socio, 1, 'efectivo', 'rechazado', 'REC-INIT-1');
  perform pg_temp.set_jwt('reset');

  -- ==========================================================================
  -- 4. ASISTENCIAS (INGRESO, SALIDA, ANULACIÓN CON AUDITORÍA, MULTI-SUCURSAL)
  -- ==========================================================================
  -- 4.1 Socio 2 (membresía quedó pendiente) NO puede registrar asistencia
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_2,
    format('select public.rpc_registrar_ingreso_asistencia(%s, %s)', v_id_suc_a1, v_id_socio_2),
    'Socio sin membresía activa (pendiente) no puede ingresar'
  );

  -- Socio sin asociación (v_id_socio_multi en Gym A) tampoco puede ingresar
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_multi_perfil,
    format('select public.rpc_registrar_ingreso_asistencia(%s, %s)', v_id_suc_a1, v_id_socio_multi),
    'Socio sin asociación socio_gimnasio no puede ingresar'
  );

  -- 4.2 Ingreso válido de Socio 1 en Sucursal A1 (Gym A), rechazo de doble ingreso abierto en el mismo Gym A
  --     pero permiso de ingreso independiente en Sucursal B1 (Gym B)
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  v_a1 := public.rpc_registrar_ingreso_asistencia(v_id_suc_a1, v_id_socio_1);
  perform pg_temp.assert_true(v_a1.estado = 'presente' and v_a1.hora_salida is null, 'Asistencia abierta creada en Gym A');
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('select public.rpc_registrar_ingreso_asistencia(%s, %s)', v_id_suc_a2, v_id_socio_1),
    'Doble asistencia abierta simultánea en el mismo gimnasio (Sucursal A2 de Gym A) debe rechazarse'
  );

  -- El mismo socio puede registrar asistencia en otro gimnasio (Gym B) de forma independiente
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  v_a3 := public.rpc_registrar_ingreso_asistencia(v_id_suc_b1, v_id_socio_1);
  perform pg_temp.assert_true(v_a3.id_sucursal = v_id_suc_b1 and v_a3.estado = 'presente', 'Socio multi-gimnasio puede ingresar en Gym B con alcance por gimnasio');
  v_a3 := public.rpc_registrar_salida_asistencia(v_a3.id_asistencia_socio, v_id_socio_1);
  perform pg_temp.assert_true(v_a3.estado = 'finalizada', 'Socio cierra su primera asistencia del día en Gym B');
  perform pg_temp.set_jwt('reset');

  -- 4.3 Salida ajena rechazada; salida autorizada por Recepcionista A1
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_2,
    format('select public.rpc_registrar_salida_asistencia(%s, %s)', v_a1.id_asistencia_socio, v_id_socio_1),
    'Socio 2 no puede cerrar asistencia ajena'
  );

  perform pg_temp.set_jwt('authenticated', v_uid_recep_a1);
  v_a1 := public.rpc_registrar_salida_asistencia(v_a1.id_asistencia_socio, v_id_socio_1);
  perform pg_temp.assert_true(v_a1.estado = 'finalizada' and v_a1.hora_salida is not null, 'Recepcionista A1 cierra asistencia #1 de Gym A');
  perform pg_temp.set_jwt('reset');

  -- 4.4 Socio 1 ingresa en otra sucursal del mismo gimnasio (Sucursal A2)
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  v_a2 := public.rpc_registrar_ingreso_asistencia(v_id_suc_a2, v_id_socio_1);
  perform pg_temp.assert_true(v_a2.id_sucursal = v_id_suc_a2, 'Socio 1 puede ingresar en Sucursal A2 del mismo Gym A');
  perform pg_temp.set_jwt('reset');

  -- Recepcionista de A1 NO puede operar ni anular asistencias de Sucursal A2
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_recep_a1,
    format($q$select public.rpc_anular_asistencia(%s, 'Fuera de sucursal')$q$, v_a2.id_asistencia_socio),
    'Recepcionista A1 no puede anular asistencias de Sucursal A2'
  );

  -- 4.5 Anulación por Dueño A registra anulada_por / anulada_en / motivo_anulacion y prohíbe re-anular
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_a2 := public.rpc_anular_asistencia(v_a2.id_asistencia_socio, 'Ingreso de prueba duplicado');
  perform pg_temp.assert_true(
    v_a2.estado = 'anulada'
    and v_a2.anulada_por = v_uid_dueno_a
    and v_a2.anulada_en is not null
    and v_a2.motivo_anulacion = 'Ingreso de prueba duplicado',
    'Anulación debe registrar trazabilidad completa (anulada_por, anulada_en, motivo_anulacion)'
  );
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format($q$select public.rpc_anular_asistencia(%s, 'Segunda vez')$q$, v_a2.id_asistencia_socio),
    'No se puede re-anular una asistencia ya anulada'
  );

  -- 4.6 Límite de 3 asistencias por día y por gimnasio (sumando Sucursal A1 + Sucursal A2, conservando historial):
  --     Socio 1 ya tiene 1 asistencia válida ('finalizada') hoy en Gym A (la anulada no consume cupo).
  --     Registra la 2da en Sucursal A2 y la 3ra en Sucursal A1; la 4ta en Gym A debe rechazarse,
  --     pero en el mismo día puede seguir asistiendo a Gym B.
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  v_a2 := public.rpc_registrar_ingreso_asistencia(v_id_suc_a2, v_id_socio_1);
  v_a2 := public.rpc_registrar_salida_asistencia(v_a2.id_asistencia_socio, v_id_socio_1);
  perform pg_temp.assert_true(v_a2.estado = 'finalizada', '2da asistencia diaria válida en Gym A (Sucursal A2) finalizada');

  v_a3 := public.rpc_registrar_ingreso_asistencia(v_id_suc_a1, v_id_socio_1);
  v_a3 := public.rpc_registrar_salida_asistencia(v_a3.id_asistencia_socio, v_id_socio_1);
  perform pg_temp.assert_true(v_a3.estado = 'finalizada', '3ra asistencia diaria válida en Gym A (Sucursal A1) finalizada');
  perform pg_temp.set_jwt('reset');

  -- 4ta asistencia del día en Gym A rechazada por RPC (tanto en Sucursal A1 como en Sucursal A2)
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('select public.rpc_registrar_ingreso_asistencia(%s, %s)', v_id_suc_a2, v_id_socio_1),
    '4ta asistencia del mismo día en el mismo gimnasio (sumando sucursales) debe rechazarse'
  );
  perform pg_temp.assert_fails_as(
    'service_role',
    null,
    format('insert into public.asistencia_socio (id_socio, id_sucursal, estado) values (%s, %s, %L)', v_id_socio_1, v_id_suc_a1, 'presente'),
    'Trigger trg_validar_asistencia_socio_gimnasio también bloquea 4ta asistencia diaria bajo service_role'
  );

  -- Las 3 asistencias cerradas de Gym A se conservan como historial
  select count(*) into v_cnt
  from public.asistencia_socio a
  join public.sucursal s on s.id_sucursal = a.id_sucursal
  where a.id_socio = v_id_socio_1
    and s.id_gimnasio = v_id_gym_a
    and a.estado = 'finalizada';
  perform pg_temp.assert_true(v_cnt = 3, 'Las 3 asistencias cerradas en Gym A deben conservarse intactas como historial');

  -- En el mismo día, el mismo socio puede registrar su 2da asistencia en Gym B (límite independiente por gimnasio)
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  v_a3 := public.rpc_registrar_ingreso_asistencia(v_id_suc_b1, v_id_socio_1);
  v_a3 := public.rpc_registrar_salida_asistencia(v_a3.id_asistencia_socio, v_id_socio_1);
  perform pg_temp.assert_true(v_a3.id_sucursal = v_id_suc_b1 and v_a3.estado = 'finalizada', 'Socio puede asistir a Gym B en el mismo día pese a haber alcanzado el tope de 3 en Gym A');
  perform pg_temp.set_jwt('reset');

  -- Bloqueo de escritura directa en asistencia_socio
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format('insert into public.asistencia_socio (id_socio, id_sucursal) values (%s, %s)', v_id_socio_1, v_id_suc_a1),
    'INSERT directo en asistencia_socio bloqueado'
  );

  -- ==========================================================================
  -- 5. RUTINAS Y EJERCICIOS SEPARADOS
  -- ==========================================================================
  -- 5.1 Socio 1 crea su ejercicio personal, rutina personal y la reordena vía RPC
  perform pg_temp.set_jwt('authenticated', v_uid_socio_1);
  insert into public.ejercicio_socio (id_socio, nombre) values (v_id_socio_1, 'Flexión Diamante') returning id_ejercicio_socio into v_ej_soc;
  insert into public.rutina_socio (id_socio, nombre) values (v_id_socio_1, 'Calistenia Casa') returning id_rutina_socio into v_rut_soc;
  insert into public.rutina_ejercicio_socio (id_rutina_socio, id_socio, id_ejercicio_socio, series, repeticiones, orden)
  values (v_rut_soc, v_id_socio_1, v_ej_soc, 4, 12, 1) returning id_rutina_ejercicio_socio into v_res1;
  insert into public.ejercicio_socio (id_socio, nombre) values (v_id_socio_1, 'Fondos') returning id_ejercicio_socio into v_res2;
  insert into public.rutina_ejercicio_socio (id_rutina_socio, id_socio, id_ejercicio_socio, series, repeticiones, orden)
  values (v_rut_soc, v_id_socio_1, v_res2, 3, 10, 2) returning id_rutina_ejercicio_socio into v_res2;

  perform public.rpc_reordenar_rutina_socio_ejercicios(v_rut_soc, array[v_res2, v_res1]);
  perform pg_temp.set_jwt('reset');

  -- 5.2 Socio y Recepcionista NO pueden crear ni asignar rutinas de gimnasio
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_socio_1,
    format($q$insert into public.rutina_gimnasio (id_gimnasio, nombre) values (%s, 'Hack')$q$, v_id_gym_a),
    'Socio no puede crear rutina_gimnasio'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_recep_a1,
    format($q$insert into public.rutina_gimnasio (id_gimnasio, nombre) values (%s, 'RecepHack')$q$, v_id_gym_a),
    'Recepcionista no puede crear rutina_gimnasio'
  );

  -- 5.3 Entrenador de Gym A crea rutina_gimnasio, la reordena y asigna -> registra id_empleado_responsable
  perform pg_temp.set_jwt('authenticated', v_uid_trainer_a1);
  insert into public.ejercicio_gimnasio (id_gimnasio, nombre) values (v_id_gym_a, 'Sentadilla Barra') returning id_ejercicio_gimnasio into v_ej_gym_a;
  insert into public.rutina_gimnasio (id_gimnasio, nombre, estado) values (v_id_gym_a, 'Fuerza Base A', true) returning id_rutina_gimnasio into v_rut_gym_a;
  insert into public.rutina_ejercicio_gimnasio (id_rutina_gimnasio, id_gimnasio, id_ejercicio_gimnasio, series, repeticiones, orden)
  values (v_rut_gym_a, v_id_gym_a, v_ej_gym_a, 5, 5, 1) returning id_rutina_ejercicio_gimnasio into v_reg1;
  insert into public.ejercicio_gimnasio (id_gimnasio, nombre) values (v_id_gym_a, 'Peso Muerto') returning id_ejercicio_gimnasio into v_reg2;
  insert into public.rutina_ejercicio_gimnasio (id_rutina_gimnasio, id_gimnasio, id_ejercicio_gimnasio, series, repeticiones, orden)
  values (v_rut_gym_a, v_id_gym_a, v_reg2, 3, 5, 2) returning id_rutina_ejercicio_gimnasio into v_reg2;

  perform public.rpc_reordenar_rutina_gimnasio_ejercicios(v_rut_gym_a, array[v_reg2, v_reg1]);
  v_asig1 := public.rpc_asignar_rutina_gimnasio_socio(v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio, current_date + 30, 'Fase 1');
  perform pg_temp.assert_true(v_asig1.id_empleado_responsable = v_id_emp_trn_a, 'Debe atribuir id_empleado_responsable al entrenador autorizante');
  perform pg_temp.set_jwt('reset');

  -- 5.4 Asignación duplicada activa rechazada; Recepcionista y Entrenador Gym B bloqueados
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_trainer_a1,
    format('select public.rpc_asignar_rutina_gimnasio_socio(%s, %s)', v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio),
    'No debe duplicar asignación activa de misma rutina al mismo socio_gimnasio'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_recep_a1,
    format('select public.rpc_asignar_rutina_gimnasio_socio(%s, %s)', v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio),
    'Recepcionista bloqueado para asignar rutinas'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_trainer_b1,
    format('select public.rpc_asignar_rutina_gimnasio_socio(%s, %s)', v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio),
    'Entrenador de Gym B bloqueado para asignar rutina de Gym A'
  );

  -- 5.5 Empleados reutilizables entre gimnasios y ciclo completo del responsable de rutinas:
  --     a) Escritura directa en rutinas_asignadas_socio_gimnasio bloqueada (solo vía RPC)
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_trainer_a1,
    format('update public.rutinas_asignadas_socio_gimnasio set estado = false where id_rutina_asignada = %s', v_asig1.id_rutina_asignada),
    'Escritura directa en rutinas_asignadas_socio_gimnasio bloqueada (solo vía RPC)'
  );

  --     b) El entrenador v_id_emp_trn_a (activo en Sucursal A1) NO tiene acceso a Sucursal A2 por el solo hecho de tener identidad de empleado
  perform pg_temp.set_jwt('authenticated', v_uid_trainer_a1);
  perform pg_temp.assert_true(
    public.fn_empleado_en_sucursal(v_id_suc_a1, array['entrenador']) = true
    and public.fn_empleado_en_sucursal(v_id_suc_a2, null) = false,
    'Empleado solo accede a sucursales donde tiene asignación activa y rol autorizado'
  );
  perform pg_temp.set_jwt('reset');

  --     c) Dueño B incorpora al mismo empleado v_id_emp_trn_a en Sucursal B1 (Gym B) reutilizando su id_empleado sin duplicar identidad/Auth
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_b);
  v_res_json := public.rpc_registrar_empleado_sucursal(v_id_suc_b1, 'entrenador', null, null, null, 'sec_trainer_a1@gymtrack.test', null, null);
  perform pg_temp.assert_true(
    (v_res_json ->> 'creado')::boolean = false
    and (v_res_json -> 'empleado' ->> 'id_empleado')::bigint = v_id_emp_trn_a,
    'rpc_registrar_empleado_sucursal debe reutilizar el mismo id_empleado al incorporarse a otro gimnasio'
  );
  perform pg_temp.set_jwt('reset');

  --     d) Dueño A no puede desactivar globalmente empleado.estado = false mientras el empleado trabaja activamente en Gym B
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('update public.empleado set estado = false where id_empleado = %s', v_id_emp_trn_a),
    'Dueño A no puede desactivar globalmente a un empleado que tiene asignación activa en Gym B'
  );

  --     e) Al dejar Gym A, Dueño A desactiva su asignación en empleado_sucursal de Sucursal A1 sin eliminar el empleado
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  update public.empleado_sucursal
  set estado = false
  where id_empleado = v_id_emp_trn_a
    and id_sucursal = v_id_suc_a1;
  perform pg_temp.set_jwt('reset');

  --     f) El empleado desactivado en Gym A ya NO puede finalizar ni modificar rutinas de Gym A, pero sigue trabajando en Gym B
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_trainer_a1,
    format('select public.rpc_finalizar_rutina_asignada(%s)', v_asig1.id_rutina_asignada),
    'Empleado con asignación desactivada en Gym A no puede autorizar cierre de rutina en Gym A'
  );
  perform pg_temp.set_jwt('authenticated', v_uid_trainer_a1);
  perform pg_temp.assert_true(
    public.fn_empleado_en_gimnasio(v_id_gym_a, null) = false
    and public.fn_empleado_en_gimnasio(v_id_gym_b, array['entrenador']) = true,
    'Al desactivar su asignación en Gym A pierde acceso a Gym A y conserva acceso activo en Gym B'
  );
  perform pg_temp.set_jwt('reset');

  --     g) Permitir finalizar una rutina ya asignada aunque su responsable haya sido desactivado, conservando el responsable histórico
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_asig1 := public.rpc_finalizar_rutina_asignada(v_asig1.id_rutina_asignada, current_date, 'Finalizada tras baja del entrenador');
  perform pg_temp.assert_true(
    v_asig1.estado = false
    and v_asig1.id_empleado_responsable = v_id_emp_trn_a,
    'Al finalizar rutina con responsable desactivado debe permitir el cierre y conservar id_empleado_responsable histórico'
  );
  perform pg_temp.set_jwt('reset');

  --     h) Un empleado desactivado en Gym A NO puede recibir nuevas asignaciones en Gym A
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('select public.rpc_asignar_rutina_gimnasio_socio(%s, %s, null, %L, %s)', v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio, 'Intento inválido', v_id_emp_trn_a),
    'Un empleado desactivado en el gimnasio no puede recibir nuevas asignaciones de rutina'
  );

  --     i) Reasignación de rutina activa a un entrenador activo y autorizado (y rechazo si el nuevo responsable no está activo/autorizado)
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  -- Dueño A incorpora a v_id_emp_trn_b también en Sucursal A1 y reactiva temporalmente a v_id_emp_trn_a para crear v_asig2
  perform public.rpc_registrar_empleado_sucursal(v_id_suc_a1, 'entrenador', null, null, null, null, null, v_id_emp_trn_b);
  update public.empleado_sucursal set estado = true where id_empleado = v_id_emp_trn_a and id_sucursal = v_id_suc_a1;
  v_asig2 := public.rpc_asignar_rutina_gimnasio_socio(v_rut_gym_a, v_sg_s1_a.id_socio_gimnasio, null, 'Ciclo activo 2', v_id_emp_trn_a);
  perform pg_temp.assert_true(v_asig2.id_empleado_responsable = v_id_emp_trn_a, 'Nueva asignación activa atribuida a Trainer A1');
  -- Trainer A1 vuelve a quedar desactivado en Gym A
  update public.empleado_sucursal set estado = false where id_empleado = v_id_emp_trn_a and id_sucursal = v_id_suc_a1;
  perform pg_temp.set_jwt('reset');

  -- Trainer A1 (desactivado en Gym A) no puede reasignar; tampoco se puede reasignar a recepcionista ni a empleado desactivado
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_trainer_a1,
    format('select public.rpc_reasignar_responsable_rutina_asignada(%s, %s)', v_asig2.id_rutina_asignada, v_id_emp_trn_b),
    'Entrenador desactivado no puede ejecutar reasignación'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('select public.rpc_reasignar_responsable_rutina_asignada(%s, %s)', v_asig2.id_rutina_asignada, v_id_emp_rec),
    'No se puede reasignar rutina a un recepcionista'
  );
  perform pg_temp.assert_fails_as(
    'authenticated',
    v_uid_dueno_a,
    format('select public.rpc_reasignar_responsable_rutina_asignada(%s, %s)', v_asig2.id_rutina_asignada, v_id_emp_trn_a),
    'No se puede reasignar rutina a un entrenador desactivado en el gimnasio'
  );

  -- Reasignación exitosa al entrenador activo v_id_emp_trn_b en Gym A
  perform pg_temp.set_jwt('authenticated', v_uid_dueno_a);
  v_asig2 := public.rpc_reasignar_responsable_rutina_asignada(v_asig2.id_rutina_asignada, v_id_emp_trn_b, 'Reasignado a Trainer B1 activo en Gym A');
  perform pg_temp.assert_true(
    v_asig2.id_empleado_responsable = v_id_emp_trn_b
    and v_asig2.estado = true,
    'rpc_reasignar_responsable_rutina_asignada debe permitir reasignar a un entrenador activo y autorizado'
  );
  perform pg_temp.set_jwt('reset');

  perform pg_temp.assert_fails_as(
    'service_role',
    null,
    format('update public.sucursal set id_gimnasio = %s where id_sucursal = %s', v_id_gym_b, v_id_suc_a1),
    'service_role no puede reasignar una sucursal con empleados/asistencias a otro gimnasio'
  );

  -- ==========================================================================
  -- 6. PERMISOS Y CATÁLOGO DE SEGURIDAD POSTGRESQL (ACOTADO A OBJETOS GYMTRACK)
  -- ==========================================================================
  -- 6.1 Las 20 tablas definitivas de GymTrack tienen RLS habilitado
  select count(*) into v_cnt
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename in (
      'dueno', 'gimnasio', 'sucursal', 'administrador', 'administrador_gimnasio',
      'empleado', 'empleado_sucursal', 'socio', 'socio_gimnasio',
      'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
      'ejercicio_socio', 'ejercicio_gimnasio', 'rutina_socio', 'rutina_gimnasio',
      'rutina_ejercicio_socio', 'rutina_ejercicio_gimnasio',
      'rutinas_asignadas_socio_gimnasio'
    )
    and rowsecurity = false;
  perform pg_temp.assert_true(v_cnt = 0, 'Las 20 tablas definitivas de GymTrack deben tener rowsecurity = true');

  -- 6.2 Ninguna política permisiva USING (true) o WITH CHECK (true) en tablas GymTrack
  select count(*) into v_cnt
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in (
      'dueno', 'gimnasio', 'sucursal', 'administrador', 'administrador_gimnasio',
      'empleado', 'empleado_sucursal', 'socio', 'socio_gimnasio',
      'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
      'ejercicio_socio', 'ejercicio_gimnasio', 'rutina_socio', 'rutina_gimnasio',
      'rutina_ejercicio_socio', 'rutina_ejercicio_gimnasio',
      'rutinas_asignadas_socio_gimnasio'
    )
    and (
      lower(btrim(coalesce(qual, ''))) in ('true', '(true)')
      or lower(btrim(coalesce(with_check, ''))) in ('true', '(true)')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'No deben existir políticas RLS USING (true) / WITH CHECK (true) en tablas GymTrack');

  -- 6.3 ACL exacto de funciones (PUBLIC directo vs anon heredado/directo vs authenticated vs service_role)
  -- a) Ninguna función fn_%, rpc_% o trg_fn_% debe conceder EXECUTE directa a PUBLIC
  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'fn\_%' or p.proname like 'rpc\_%' or p.proname like 'trg\_fn\_%')
    and pg_temp.acl_tiene_privilegio_directo(p.proacl, p.proowner, 'f'::"char", 'PUBLIC', 'EXECUTE');
  perform pg_temp.assert_true(v_cnt = 0, 'Ninguna función pública de seguridad/RPC/trigger debe otorgar EXECUTE directa a PUBLIC');

  -- b) anon sin EXECUTE ni directo ni heredado (via PUBLIC o rol miembro)
  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'fn\_%' or p.proname like 'rpc\_%' or p.proname like 'trg\_fn\_%')
    and (
      pg_temp.acl_tiene_privilegio_directo(p.proacl, p.proowner, 'f'::"char", 'anon', 'EXECUTE')
      or pg_temp.acl_tiene_privilegio_heredado(p.proacl, p.proowner, 'f'::"char", 'anon', 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'anon no debe tener EXECUTE directo ni heredado sobre fn_%, rpc_% ni trg_fn_%');

  -- c) authenticated: sin EXECUTE directo ni heredado en trg_fn_% ni fn_es_service_role;
  --    con EXECUTE DIRECTO (sin herencia desde PUBLIC) en el resto de fn_% y rpc_%
  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'trg\_fn\_%' or p.proname = 'fn_es_service_role')
    and (
      pg_temp.acl_tiene_privilegio_directo(p.proacl, p.proowner, 'f'::"char", 'authenticated', 'EXECUTE')
      or pg_temp.acl_tiene_privilegio_heredado(p.proacl, p.proowner, 'f'::"char", 'authenticated', 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'authenticated no debe tener EXECUTE directo ni heredado sobre triggers ni fn_es_service_role');

  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'fn\_%' or p.proname like 'rpc\_%')
    and p.proname <> 'fn_es_service_role'
    and (
      not pg_temp.acl_tiene_privilegio_directo(p.proacl, p.proowner, 'f'::"char", 'authenticated', 'EXECUTE')
      or pg_temp.acl_tiene_privilegio_heredado(p.proacl, p.proowner, 'f'::"char", 'authenticated', 'EXECUTE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'authenticated debe tener EXECUTE directo (no heredado) en helpers y RPCs');

  -- d) service_role: con EXECUTE DIRECTO (no heredado de PUBLIC ni otros roles) en fn_es_service_role, fn_% y rpc_%
  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'fn\_%' or p.proname like 'rpc\_%')
    and (
      not pg_temp.acl_tiene_privilegio_directo(p.proacl, p.proowner, 'f'::"char", 'service_role', 'EXECUTE')
      or pg_temp.acl_tiene_privilegio_heredado(p.proacl, p.proowner, 'f'::"char", 'service_role', 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'service_role debe tener EXECUTE directo y efectivo sobre fn_% y rpc_% sin depender de PUBLIC');

  -- 6.4 Toda función SECURITY DEFINER en public tiene search_path fijado
  select count(*) into v_cnt
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and (p.proname like 'fn\_%' or p.proname like 'rpc\_%' or p.proname like 'trg\_fn\_%')
    and (p.proconfig is null or not exists (
      select 1 from pg_catalog.unnest(p.proconfig) cfg where cfg like 'search_path=%'
    ));
  perform pg_temp.assert_true(v_cnt = 0, 'Todas las funciones SECURITY DEFINER deben fijar search_path');

  -- 6.5 ACL exacto de las 20 secuencias IDENTITY de GymTrack (PUBLIC directo vs anon directo/heredado vs authenticated vs service_role)
  -- a) PUBLIC y anon sin USAGE/SELECT/UPDATE ni directo ni heredado en ninguna secuencia de GymTrack
  select count(*) into v_cnt
  from (values
    ('public.dueno', 'id_dueno'),
    ('public.gimnasio', 'id_gimnasio'),
    ('public.sucursal', 'id_sucursal'),
    ('public.administrador', 'id_administrador'),
    ('public.administrador_gimnasio', 'id_administrador_gimnasio'),
    ('public.empleado', 'id_empleado'),
    ('public.empleado_sucursal', 'id_empleado_sucursal'),
    ('public.socio', 'id_socio'),
    ('public.socio_gimnasio', 'id_socio_gimnasio'),
    ('public.membresia_gimnasio', 'id_membresia_gimnasio'),
    ('public.membresia_socio', 'id_membresia_socio'),
    ('public.pago', 'id_pago'),
    ('public.asistencia_socio', 'id_asistencia_socio'),
    ('public.ejercicio_socio', 'id_ejercicio_socio'),
    ('public.ejercicio_gimnasio', 'id_ejercicio_gimnasio'),
    ('public.rutina_socio', 'id_rutina_socio'),
    ('public.rutina_gimnasio', 'id_rutina_gimnasio'),
    ('public.rutina_ejercicio_socio', 'id_rutina_ejercicio_socio'),
    ('public.rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio'),
    ('public.rutinas_asignadas_socio_gimnasio', 'id_rutina_asignada')
  ) as t(tbl, col)
  join pg_catalog.pg_class c on c.oid = pg_catalog.pg_get_serial_sequence(t.tbl, t.col)::regclass
  where (
      pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'PUBLIC', 'USAGE')
      or pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'PUBLIC', 'SELECT')
      or pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'PUBLIC', 'UPDATE')
      or pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'anon', 'USAGE')
      or pg_temp.acl_tiene_privilegio_heredado(c.relacl, c.relowner, 's'::"char", 'anon', 'USAGE')
      or pg_catalog.has_sequence_privilege('anon', c.oid, 'USAGE')
      or pg_catalog.has_sequence_privilege('anon', c.oid, 'SELECT')
      or pg_catalog.has_sequence_privilege('anon', c.oid, 'UPDATE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'Secuencias de GymTrack sin privilegios directos a PUBLIC ni directos/heredados a anon');

  -- b) authenticated sin UPDATE (directo ni heredado) en ninguna secuencia de GymTrack y sin USAGE/SELECT en tablas solo-RPC
  select count(*) into v_cnt
  from (values
    ('public.dueno', 'id_dueno'),
    ('public.gimnasio', 'id_gimnasio'),
    ('public.sucursal', 'id_sucursal'),
    ('public.administrador', 'id_administrador'),
    ('public.administrador_gimnasio', 'id_administrador_gimnasio'),
    ('public.empleado', 'id_empleado'),
    ('public.empleado_sucursal', 'id_empleado_sucursal'),
    ('public.socio', 'id_socio'),
    ('public.socio_gimnasio', 'id_socio_gimnasio'),
    ('public.membresia_gimnasio', 'id_membresia_gimnasio'),
    ('public.membresia_socio', 'id_membresia_socio'),
    ('public.pago', 'id_pago'),
    ('public.asistencia_socio', 'id_asistencia_socio'),
    ('public.ejercicio_socio', 'id_ejercicio_socio'),
    ('public.ejercicio_gimnasio', 'id_ejercicio_gimnasio'),
    ('public.rutina_socio', 'id_rutina_socio'),
    ('public.rutina_gimnasio', 'id_rutina_gimnasio'),
    ('public.rutina_ejercicio_socio', 'id_rutina_ejercicio_socio'),
    ('public.rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio'),
    ('public.rutinas_asignadas_socio_gimnasio', 'id_rutina_asignada')
  ) as t(tbl, col)
  join pg_catalog.pg_class c on c.oid = pg_catalog.pg_get_serial_sequence(t.tbl, t.col)::regclass
  where (
      pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'authenticated', 'UPDATE')
      or pg_temp.acl_tiene_privilegio_heredado(c.relacl, c.relowner, 's'::"char", 'authenticated', 'UPDATE')
      or pg_catalog.has_sequence_privilege('authenticated', c.oid, 'UPDATE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'authenticated no debe tener UPDATE (directo ni heredado) en ninguna secuencia de GymTrack');

  select count(*) into v_cnt
  from (values
    ('public.socio_gimnasio', 'id_socio_gimnasio'),
    ('public.membresia_socio', 'id_membresia_socio'),
    ('public.pago', 'id_pago'),
    ('public.asistencia_socio', 'id_asistencia_socio'),
    ('public.rutinas_asignadas_socio_gimnasio', 'id_rutina_asignada')
  ) as t(tbl, col)
  join pg_catalog.pg_class c on c.oid = pg_catalog.pg_get_serial_sequence(t.tbl, t.col)::regclass
  where pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'authenticated', 'USAGE')
     or pg_temp.acl_tiene_privilegio_heredado(c.relacl, c.relowner, 's'::"char", 'authenticated', 'USAGE')
     or pg_catalog.has_sequence_privilege('authenticated', c.oid, 'USAGE')
     or pg_catalog.has_sequence_privilege('authenticated', c.oid, 'SELECT');
  perform pg_temp.assert_true(v_cnt = 0, 'Secuencias de tablas solo-RPC sin USAGE/SELECT (directo ni heredado) para authenticated');

  -- c) authenticated con USAGE y SELECT DIRECTOS (no heredados de PUBLIC) en las 15 tablas con INSERT directo
  select count(*) into v_cnt
  from (values
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
    ('public.rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio')
  ) as t(tbl, col)
  join pg_catalog.pg_class c on c.oid = pg_catalog.pg_get_serial_sequence(t.tbl, t.col)::regclass
  where not pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'authenticated', 'USAGE')
     or not pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'authenticated', 'SELECT')
     or pg_temp.acl_tiene_privilegio_heredado(c.relacl, c.relowner, 's'::"char", 'authenticated', 'USAGE');
  perform pg_temp.assert_true(v_cnt = 0, 'authenticated debe tener USAGE y SELECT directos (sin herencia PUBLIC) en secuencias de inserción directa');

  -- d) service_role con USAGE y SELECT DIRECTOS (no heredados de PUBLIC) en las 20 secuencias de GymTrack
  select count(*) into v_cnt
  from (values
    ('public.dueno', 'id_dueno'),
    ('public.gimnasio', 'id_gimnasio'),
    ('public.sucursal', 'id_sucursal'),
    ('public.administrador', 'id_administrador'),
    ('public.administrador_gimnasio', 'id_administrador_gimnasio'),
    ('public.empleado', 'id_empleado'),
    ('public.empleado_sucursal', 'id_empleado_sucursal'),
    ('public.socio', 'id_socio'),
    ('public.socio_gimnasio', 'id_socio_gimnasio'),
    ('public.membresia_gimnasio', 'id_membresia_gimnasio'),
    ('public.membresia_socio', 'id_membresia_socio'),
    ('public.pago', 'id_pago'),
    ('public.asistencia_socio', 'id_asistencia_socio'),
    ('public.ejercicio_socio', 'id_ejercicio_socio'),
    ('public.ejercicio_gimnasio', 'id_ejercicio_gimnasio'),
    ('public.rutina_socio', 'id_rutina_socio'),
    ('public.rutina_gimnasio', 'id_rutina_gimnasio'),
    ('public.rutina_ejercicio_socio', 'id_rutina_ejercicio_socio'),
    ('public.rutina_ejercicio_gimnasio', 'id_rutina_ejercicio_gimnasio'),
    ('public.rutinas_asignadas_socio_gimnasio', 'id_rutina_asignada')
  ) as t(tbl, col)
  join pg_catalog.pg_class c on c.oid = pg_catalog.pg_get_serial_sequence(t.tbl, t.col)::regclass
  where (
      not pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'service_role', 'USAGE')
      or not pg_temp.acl_tiene_privilegio_directo(c.relacl, c.relowner, 's'::"char", 'service_role', 'SELECT')
      or pg_temp.acl_tiene_privilegio_heredado(c.relacl, c.relowner, 's'::"char", 'service_role', 'USAGE')
      or not pg_catalog.has_sequence_privilege('service_role', c.oid, 'USAGE')
    );
  perform pg_temp.assert_true(v_cnt = 0, 'service_role debe tener USAGE y SELECT directos en las 20 secuencias de GymTrack sin depender de PUBLIC');

  -- 6.6 Vistas de catálogo con security_barrier=true, security_invoker=false y sin columnas PII
  select count(*) into v_cnt
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and c.relname in ('vw_catalogo_gimnasios', 'vw_catalogo_planes')
    and c.reloptions @> array['security_barrier=true', 'security_invoker=false'];
  perform pg_temp.assert_true(v_cnt = 2, 'Vistas de catálogo deben tener security_barrier=true y security_invoker=false');

  perform pg_temp.assert_true(
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('vw_catalogo_gimnasios', 'vw_catalogo_planes')
        and column_name in ('email', 'id_dueno', 'dni', 'auth_user_id', 'fecha_registro')
    ),
    'Las vistas vw_catalogo_* no deben exponer email, id_dueno, dni, auth_user_id ni fecha_registro'
  );

  -- 6.7 Ausencia total de public.progreso, empleado.id_gimnasio y tablas/triggers legacy
  perform pg_temp.assert_true(
    to_regclass('public.progreso') is null
    and to_regclass('public.ejercicio') is null
    and to_regclass('public.rutina') is null
    and to_regclass('public.rutina_ejercicio') is null
    and to_regprocedure('public.trg_fn_validar_ejercicio_en_rutina()') is null
    and to_regprocedure('public.trg_fn_proteger_progreso()') is null
    and not exists (
      select 1
      from pg_catalog.pg_attribute a
      where a.attrelid = 'public.empleado'::regclass
        and a.attname = 'id_gimnasio'
        and not a.attisdropped
    ),
    'La instalación definitiva no debe contener public.progreso, empleado.id_gimnasio ni tablas/triggers legacy'
  );

  -- 6.8 Propietario postgres de funciones SECURITY DEFINER y vistas (cuando existe rol postgres)
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'postgres') then
    select count(*) into v_cnt
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and (p.proname like 'fn\_%' or p.proname like 'rpc\_%' or p.proname like 'trg\_fn\_%')
      and pg_catalog.pg_get_userbyid(p.proowner) <> 'postgres';
    perform pg_temp.assert_true(v_cnt = 0, 'Todas las funciones SECURITY DEFINER deben pertenecer a postgres');
  end if;

  raise notice 'OK — Suite completa de seguridad RLS/RPC GymTrack ejecutada sin fallos.';
end;
$$;

rollback;
