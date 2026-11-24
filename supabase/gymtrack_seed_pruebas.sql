-- ============================================================================
-- GYMTRACK — SCRIPT DE DATOS DE PRUEBA (SEED REPRODUCIBLE DESDE CERO)
--
-- PRERREQUISITOS Y SEPARACIÓN SUPABASE AUTH vs SQL:
--   1. Haber ejecutado previamente: supabase/01_instalacion_definitiva.sql
--   2. PASO A (SUPABASE AUTH — FUERA DE ESTE SQL):
--      Para iniciar sesión real desde FastAPI / Frontend, crear previamente
--      en Supabase Auth (Dashboard -> Authentication -> Users o Admin API con
--      email_confirm = true y contraseñas de prueba locales, nunca reales) los
--      siguientes correos ficticios:
--        - Dueño 1 (Norte Fit):         seed_dueno_norte@gymtrack.test
--        - Dueño 2 (Sur Power):         seed_dueno_sur@gymtrack.test
--        - Admin Organizacional:        seed_admin_org@gymtrack.test
--        - Empleado Admin Sucursal 1:   seed_admin_suc_norte@gymtrack.test
--        - Empleado Recepcionista 1:    seed_recep_norte@gymtrack.test
--        - Empleado Entrenador 1:       seed_trainer_norte@gymtrack.test
--        - Empleado Recepcionista 2:    seed_recep_sur@gymtrack.test
--        - Empleado Entrenador 2:       seed_trainer_sur@gymtrack.test
--        - Socio Multi-Gimnasio:        seed_socio_multi@gymtrack.test
--        - Socio Solo Norte Fit:        seed_socio_norte@gymtrack.test
--        - Socio Solo Sur Power:        seed_socio_sur@gymtrack.test
--        - Socio Asociación Inactiva:   seed_socio_baja@gymtrack.test
--   3. PASO B (ESTE SCRIPT SQL):
--      Inserta los registros de negocio. Si los correos ya existen en
--      auth.users, enlaza automáticamente su auth_user_id; si aún no existen,
--      deja auth_user_id = NULL para vinculación posterior mediante
--      public.rpc_vincular_identidad_perfil(p_perfil_tipo) tras verificar email.
--
-- SEGURIDAD:
--   - NO contiene credenciales reales ni datos de producción.
--   - NO ejecutar contra producción; diseñado para desarrollo / staging limpio.
-- ============================================================================

begin;

do $$
declare
  v_auth_dueno_1       uuid;
  v_auth_dueno_2       uuid;
  v_auth_admin_org     uuid;
  v_auth_admin_suc_1   uuid;
  v_auth_recep_1       uuid;
  v_auth_trainer_1     uuid;
  v_auth_recep_2       uuid;
  v_auth_trainer_2     uuid;
  v_auth_socio_multi   uuid;
  v_auth_socio_norte   uuid;
  v_auth_socio_sur     uuid;
  v_auth_socio_baja    uuid;

  v_id_dueno_1         bigint;
  v_id_dueno_2         bigint;
  v_id_gym_norte       bigint;
  v_id_gym_sur         bigint;
  v_id_suc_norte_1     bigint;
  v_id_suc_norte_2     bigint;
  v_id_suc_sur_1       bigint;
  v_id_admin_org       bigint;
  v_id_emp_n_admin     bigint;
  v_id_emp_n_recep     bigint;
  v_id_emp_n_train     bigint;
  v_id_emp_s_recep     bigint;
  v_id_emp_s_train     bigint;
  v_id_socio_multi     bigint;
  v_id_socio_norte     bigint;
  v_id_socio_sur       bigint;
  v_id_socio_baja      bigint;
  v_id_sg_multi_n      bigint;
  v_id_sg_multi_s      bigint;
  v_id_sg_norte        bigint;
  v_id_sg_sur          bigint;
  v_id_sg_baja_n       bigint;
  v_id_plan_n_mensual  bigint;
  v_id_plan_n_trim     bigint;
  v_id_plan_s_mensual  bigint;
  v_id_plan_s_libre    bigint;
  v_id_memb_multi_n1   bigint;
  v_id_memb_multi_n2   bigint;
  v_id_memb_multi_s1   bigint;
  v_id_memb_norte_pend bigint;
  v_id_memb_sur_venc   bigint;
  v_id_memb_baja_canc  bigint;
  v_id_ej_s_1          bigint;
  v_id_ej_s_2          bigint;
  v_id_rut_s_1         bigint;
  v_id_ej_gn_1         bigint;
  v_id_ej_gn_2         bigint;
  v_id_ej_gs_1         bigint;
  v_id_rut_gn_1        bigint;
  v_id_rut_gn_2        bigint;
  v_id_rut_gs_1        bigint;
begin
  if to_regclass('public.socio_gimnasio') is null or to_regclass('public.rutinas_asignadas_socio_gimnasio') is null then
    raise exception 'Falta instalar primero supabase/01_instalacion_definitiva.sql antes de ejecutar el seed.';
  end if;

  if exists (select 1 from public.dueno where email = 'seed_dueno_norte@gymtrack.test') then
    raise exception 'El seed de pruebas ya fue aplicado previamente en esta base.';
  end if;

  -- Resolver auth_user_id desde auth.users si los usuarios Auth ya fueron creados
  select id into v_auth_dueno_1     from auth.users where lower(email) = 'seed_dueno_norte@gymtrack.test' limit 1;
  select id into v_auth_dueno_2     from auth.users where lower(email) = 'seed_dueno_sur@gymtrack.test' limit 1;
  select id into v_auth_admin_org   from auth.users where lower(email) = 'seed_admin_org@gymtrack.test' limit 1;
  select id into v_auth_admin_suc_1 from auth.users where lower(email) = 'seed_admin_suc_norte@gymtrack.test' limit 1;
  select id into v_auth_recep_1     from auth.users where lower(email) = 'seed_recep_norte@gymtrack.test' limit 1;
  select id into v_auth_trainer_1   from auth.users where lower(email) = 'seed_trainer_norte@gymtrack.test' limit 1;
  select id into v_auth_recep_2     from auth.users where lower(email) = 'seed_recep_sur@gymtrack.test' limit 1;
  select id into v_auth_trainer_2   from auth.users where lower(email) = 'seed_trainer_sur@gymtrack.test' limit 1;
  select id into v_auth_socio_multi from auth.users where lower(email) = 'seed_socio_multi@gymtrack.test' limit 1;
  select id into v_auth_socio_norte from auth.users where lower(email) = 'seed_socio_norte@gymtrack.test' limit 1;
  select id into v_auth_socio_sur   from auth.users where lower(email) = 'seed_socio_sur@gymtrack.test' limit 1;
  select id into v_auth_socio_baja  from auth.users where lower(email) = 'seed_socio_baja@gymtrack.test' limit 1;

  -- 1. Dueños y Gimnasios independientes
  insert into public.dueno (auth_user_id, nombre, apellido, email)
  values (v_auth_dueno_1, 'Martín', 'Rivas', 'seed_dueno_norte@gymtrack.test')
  returning id_dueno into v_id_dueno_1;

  insert into public.dueno (auth_user_id, nombre, apellido, email)
  values (v_auth_dueno_2, 'Valeria', 'Gómez', 'seed_dueno_sur@gymtrack.test')
  returning id_dueno into v_id_dueno_2;

  insert into public.gimnasio (nombre, telefono, email, estado, id_dueno)
  values ('Gimnasio Norte Fit', '+54 11 4000-1100', 'contacto@nortefit.test', true, v_id_dueno_1)
  returning id_gimnasio into v_id_gym_norte;

  insert into public.gimnasio (nombre, telefono, email, estado, id_dueno)
  values ('Gimnasio Sur Power', '+54 11 4000-2200', 'contacto@surpower.test', true, v_id_dueno_2)
  returning id_gimnasio into v_id_gym_sur;

  -- 2. Sucursales
  insert into public.sucursal (direccion, telefono, descripcion, estado, id_gimnasio)
  values ('Av. Libertador 1250', '+54 11 4000-1101', 'Sede principal Norte Fit', true, v_id_gym_norte)
  returning id_sucursal into v_id_suc_norte_1;

  insert into public.sucursal (direccion, telefono, descripcion, estado, id_gimnasio)
  values ('Calle Sarmiento 480', '+54 11 4000-1102', 'Sede Parque Norte Fit', true, v_id_gym_norte)
  returning id_sucursal into v_id_suc_norte_2;

  insert into public.sucursal (direccion, telefono, descripcion, estado, id_gimnasio)
  values ('Av. Costanera 900', '+54 11 4000-2201', 'Sede única Sur Power', true, v_id_gym_sur)
  returning id_sucursal into v_id_suc_sur_1;

  -- 3. Administrador organizacional (multi-gimnasio: activo en Norte Fit, inactivo en Sur Power)
  insert into public.administrador (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_admin_org, 'Diego', 'Fernández', '30111222', 'seed_admin_org@gymtrack.test', '+54 9 11 5555-0001', true)
  returning id_administrador into v_id_admin_org;

  insert into public.administrador_gimnasio (id_administrador, id_gimnasio, estado)
  values
    (v_id_admin_org, v_id_gym_norte, true),
    (v_id_admin_org, v_id_gym_sur, false);

  -- 4. Empleados operativos (identidad personal reutilizable) y asignaciones a sucursal
  insert into public.empleado (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_admin_suc_1, 'Laura', 'Méndez', '32100101', 'seed_admin_suc_norte@gymtrack.test', '+54 9 11 5555-0101', true)
  returning id_empleado into v_id_emp_n_admin;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
  values ('administrador', v_id_emp_n_admin, v_id_suc_norte_1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_recep_1, 'Sofía', 'Paz', '33100102', 'seed_recep_norte@gymtrack.test', '+54 9 11 5555-0102', true)
  returning id_empleado into v_id_emp_n_recep;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
  values ('recepcionista', v_id_emp_n_recep, v_id_suc_norte_1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_trainer_1, 'Julián', 'Castro', '34100103', 'seed_trainer_norte@gymtrack.test', '+54 9 11 5555-0103', true)
  returning id_empleado into v_id_emp_n_train;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
  values
    ('entrenador', v_id_emp_n_train, v_id_suc_norte_1, true),
    ('entrenador', v_id_emp_n_train, v_id_suc_norte_2, true),
    ('entrenador', v_id_emp_n_train, v_id_suc_sur_1,   false);

  insert into public.empleado (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_recep_2, 'Camila', 'Vega', '35200201', 'seed_recep_sur@gymtrack.test', '+54 9 11 5555-0201', true)
  returning id_empleado into v_id_emp_s_recep;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
  values ('recepcionista', v_id_emp_s_recep, v_id_suc_sur_1, true);

  insert into public.empleado (auth_user_id, nombre, apellido, dni, email, telefono, estado)
  values (v_auth_trainer_2, 'Bruno', 'Sosa', '36200202', 'seed_trainer_sur@gymtrack.test', '+54 9 11 5555-0202', true)
  returning id_empleado into v_id_emp_s_train;
  insert into public.empleado_sucursal (rol, id_empleado, id_sucursal, estado)
  values ('entrenador', v_id_emp_s_train, v_id_suc_sur_1, true);

  -- 5. Socios y asociaciones socio_gimnasio (1 socio multi-gimnasio, 2 de gym único, 1 desactivado)
  insert into public.socio (auth_user_id, nombre, apellido, dni, telefono, email, estado)
  values (v_auth_socio_multi, 'Carlos', 'MultiGym', '40111001', '+54 9 11 6000-0001', 'seed_socio_multi@gymtrack.test', true)
  returning id_socio into v_id_socio_multi;

  insert into public.socio (auth_user_id, nombre, apellido, dni, telefono, email, estado)
  values (v_auth_socio_norte, 'Lucía', 'Pereyra', '40111002', '+54 9 11 6000-0002', 'seed_socio_norte@gymtrack.test', true)
  returning id_socio into v_id_socio_norte;

  insert into public.socio (auth_user_id, nombre, apellido, dni, telefono, email, estado)
  values (v_auth_socio_sur, 'Mateo', 'Domínguez', '40111003', '+54 9 11 6000-0003', 'seed_socio_sur@gymtrack.test', true)
  returning id_socio into v_id_socio_sur;

  insert into public.socio (auth_user_id, nombre, apellido, dni, telefono, email, estado)
  values (v_auth_socio_baja, 'Paula', 'Inactiva', '40111004', '+54 9 11 6000-0004', 'seed_socio_baja@gymtrack.test', true)
  returning id_socio into v_id_socio_baja;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (v_id_socio_multi, v_id_gym_norte, current_date - 20, true)
  returning id_socio_gimnasio into v_id_sg_multi_n;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (v_id_socio_multi, v_id_gym_sur, current_date - 10, true)
  returning id_socio_gimnasio into v_id_sg_multi_s;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (v_id_socio_norte, v_id_gym_norte, current_date - 5, true)
  returning id_socio_gimnasio into v_id_sg_norte;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (v_id_socio_sur, v_id_gym_sur, current_date - 50, true)
  returning id_socio_gimnasio into v_id_sg_sur;

  insert into public.socio_gimnasio (id_socio, id_gimnasio, fecha_alta, estado)
  values (v_id_socio_baja, v_id_gym_norte, current_date - 90, false)
  returning id_socio_gimnasio into v_id_sg_baja_n;

  -- 6. Planes (membresia_gimnasio)
  insert into public.membresia_gimnasio (nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado, id_gimnasio)
  values ('Mensual Libre Norte', 'Acceso total a todas las sedes de Norte Fit', 25000.00, 30, null, null, true, v_id_gym_norte)
  returning id_membresia_gimnasio into v_id_plan_n_mensual;

  insert into public.membresia_gimnasio (nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado, id_gimnasio)
  values ('Trimestral Norte 3x', 'Hasta 3 asistencias por semana durante 90 días', 65000.00, 90, 3, null, true, v_id_gym_norte)
  returning id_membresia_gimnasio into v_id_plan_n_trim;

  insert into public.membresia_gimnasio (nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado, id_gimnasio)
  values ('Mensual Sur Base', 'Acceso mensual a Sur Power', 22000.00, 30, 4, null, true, v_id_gym_sur)
  returning id_membresia_gimnasio into v_id_plan_s_mensual;

  insert into public.membresia_gimnasio (nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado, id_gimnasio)
  values ('Pase Libre Sur', 'Acceso ilimitado mensual Sur Power', 30000.00, 30, null, null, true, v_id_gym_sur)
  returning id_membresia_gimnasio into v_id_plan_s_libre;

  -- 7. Contrataciones (membresia_socio)
  -- Carlos MultiGym en Norte: activa vigente + renovación anticipada encadenada
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_multi_n, v_id_plan_n_mensual, v_id_gym_norte, 25000.00, 30, null, null, current_date - 15, current_date + 15, 'activa')
  returning id_membresia_socio into v_id_memb_multi_n1;

  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_multi_n, v_id_plan_n_trim, v_id_gym_norte, 65000.00, 90, 3, null, current_date + 16, current_date + 106, 'activa')
  returning id_membresia_socio into v_id_memb_multi_n2;

  -- Carlos MultiGym también activo en Sur Power
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_multi_s, v_id_plan_s_libre, v_id_gym_sur, 30000.00, 30, null, null, current_date - 5, current_date + 25, 'activa')
  returning id_membresia_socio into v_id_memb_multi_s1;

  -- Lucía Norte con contratación pendiente (pago parcial + pago pendiente)
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_norte, v_id_plan_n_mensual, v_id_gym_norte, 25000.00, 30, null, null, current_date, current_date + 30, 'pendiente')
  returning id_membresia_socio into v_id_memb_norte_pend;

  -- Mateo Sur con membresía vencida histórica
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_sur, v_id_plan_s_mensual, v_id_gym_sur, 22000.00, 30, 4, null, current_date - 45, current_date - 15, 'vencida')
  returning id_membresia_socio into v_id_memb_sur_venc;

  -- Paula Baja con membresía cancelada histórica
  insert into public.membresia_socio (id_socio_gimnasio, id_membresia_gimnasio, id_gimnasio, precio, duracion_dias_contratados, limite_asistencias_semanales, limite_asistencias_totales, fecha_inicio, fecha_vencimiento, estado)
  values (v_id_sg_baja_n, v_id_plan_n_mensual, v_id_gym_norte, 25000.00, 30, null, null, current_date - 90, current_date - 60, 'cancelada')
  returning id_membresia_socio into v_id_memb_baja_canc;

  -- 8. Pagos en distintos estados (aprobado, pendiente, rechazado, anulado)
  insert into public.pago (id_membresia_socio, monto, fecha_pago, metodo_pago, estado, comprobante)
  values
    (v_id_memb_multi_n1, 25000.00, now() - interval '15 days', 'transferencia', 'aprobado', 'SEED-N-001'),
    (v_id_memb_multi_n2, 65000.00, now() - interval '2 days',  'mercadopago',   'aprobado', 'SEED-N-002'),
    (v_id_memb_multi_s1, 30000.00, now() - interval '5 days',  'efectivo',      'aprobado', 'SEED-S-001'),
    (v_id_memb_norte_pend, 10000.00, now() - interval '1 day', 'efectivo',      'aprobado', 'SEED-N-003'),
    (v_id_memb_norte_pend, 15000.00, now(),                    'transferencia', 'pendiente', 'SEED-N-004'),
    (v_id_memb_sur_venc,  22000.00, now() - interval '50 days','tarjeta',       'rechazado', 'SEED-S-002'),
    (v_id_memb_sur_venc,  22000.00, now() - interval '45 days','efectivo',      'aprobado',  'SEED-S-003'),
    (v_id_memb_baja_canc, 25000.00, now() - interval '89 days','transferencia', 'anulado',   'SEED-N-005');

  -- 9. Asistencias (finalizadas, abierta presente y anulada con trazabilidad)
  insert into public.asistencia_socio (id_socio, id_sucursal, hora_ingreso, hora_salida, estado)
  values
    (v_id_socio_multi, v_id_suc_norte_1, now() - interval '3 days' + interval '1 hour', now() - interval '3 days' + interval '2 hours', 'finalizada'),
    (v_id_socio_multi, v_id_suc_norte_2, now() - interval '1 day'  + interval '2 hours', now() - interval '1 day'  + interval '3 hours', 'finalizada'),
    (v_id_socio_multi, v_id_suc_sur_1,   now() - interval '20 minutes', null, 'presente');

  insert into public.asistencia_socio (id_socio, id_sucursal, hora_ingreso, hora_salida, estado, anulada_por, anulada_en, motivo_anulacion)
  values
    (v_id_socio_norte, v_id_suc_norte_1, now() - interval '6 days', null, 'anulada', v_auth_dueno_1, now() - interval '6 days' + interval '5 minutes', 'Registro de prueba anulado en seed');

  -- 10. Ejercicios y Rutinas Personales (socio) y Organizacionales (gimnasio)
  insert into public.ejercicio_socio (id_socio, nombre, descripcion, grupo_muscular, dificultad, estado)
  values (v_id_socio_multi, 'Dominadas en casa', 'Agarre prono controlado', 'Espalda', 'Intermedia', true)
  returning id_ejercicio_socio into v_id_ej_s_1;

  insert into public.ejercicio_socio (id_socio, nombre, descripcion, grupo_muscular, dificultad, estado)
  values (v_id_socio_multi, 'Plancha abdominal', 'Isométrico de core', 'Abdomen', 'Principiante', true)
  returning id_ejercicio_socio into v_id_ej_s_2;

  insert into public.rutina_socio (id_socio, nombre, descripcion, fecha_inicio, estado)
  values (v_id_socio_multi, 'Mi Rutina Hogar', 'Refuerzo complementario de fin de semana', current_date - 7, true)
  returning id_rutina_socio into v_id_rut_s_1;

  insert into public.rutina_ejercicio_socio (id_rutina_socio, id_socio, id_ejercicio_socio, series, repeticiones, peso, descanso, orden)
  values
    (v_id_rut_s_1, v_id_socio_multi, v_id_ej_s_1, 4, 8,  0, 90, 1),
    (v_id_rut_s_1, v_id_socio_multi, v_id_ej_s_2, 3, 45, 0, 45, 2);

  insert into public.ejercicio_gimnasio (id_gimnasio, nombre, descripcion, grupo_muscular, dificultad, estado)
  values (v_id_gym_norte, 'Sentadilla con Barra', 'Sentadilla trasera profunda', 'Piernas', 'Intermedia', true)
  returning id_ejercicio_gimnasio into v_id_ej_gn_1;

  insert into public.ejercicio_gimnasio (id_gimnasio, nombre, descripcion, grupo_muscular, dificultad, estado)
  values (v_id_gym_norte, 'Press de Banca Plano', 'Empuje horizontal en banco plano', 'Pecho', 'Intermedia', true)
  returning id_ejercicio_gimnasio into v_id_ej_gn_2;

  insert into public.ejercicio_gimnasio (id_gimnasio, nombre, descripcion, grupo_muscular, dificultad, estado)
  values (v_id_gym_sur, 'Remo en Polea Baja', 'Tracción horizontal sentado', 'Espalda', 'Principiante', true)
  returning id_ejercicio_gimnasio into v_id_ej_gs_1;

  insert into public.rutina_gimnasio (id_gimnasio, nombre, descripcion, nivel, estado)
  values (v_id_gym_norte, 'Fuerza Full Body Norte', 'Programa base de fuerza e hipertrofia', 'Intermedio', true)
  returning id_rutina_gimnasio into v_id_rut_gn_1;

  insert into public.rutina_gimnasio (id_gimnasio, nombre, descripcion, nivel, estado)
  values (v_id_gym_norte, 'Adaptación Inicial Norte', 'Programa introductorio 4 semanas', 'Principiante', true)
  returning id_rutina_gimnasio into v_id_rut_gn_2;

  insert into public.rutina_gimnasio (id_gimnasio, nombre, descripcion, nivel, estado)
  values (v_id_gym_sur, 'Espalda y Core Sur', 'Circuito postural Sur Power', 'Principiante', true)
  returning id_rutina_gimnasio into v_id_rut_gs_1;

  insert into public.rutina_ejercicio_gimnasio (id_rutina_gimnasio, id_gimnasio, id_ejercicio_gimnasio, series, repeticiones, peso, descanso, orden)
  values
    (v_id_rut_gn_1, v_id_gym_norte, v_id_ej_gn_1, 4, 8,  60, 120, 1),
    (v_id_rut_gn_1, v_id_gym_norte, v_id_ej_gn_2, 4, 10, 50, 90,  2),
    (v_id_rut_gn_2, v_id_gym_norte, v_id_ej_gn_2, 3, 12, 30, 60,  1),
    (v_id_rut_gs_1, v_id_gym_sur,   v_id_ej_gs_1, 4, 12, 35, 60,  1);

  -- Asignaciones de rutinas del gimnasio mediante socio_gimnasio
  insert into public.rutinas_asignadas_socio_gimnasio (id_rutina_gimnasio, id_socio_gimnasio, id_gimnasio, id_empleado_responsable, fecha_asignacion, fecha_finalizacion, estado, observaciones)
  values
    (v_id_rut_gn_1, v_id_sg_multi_n, v_id_gym_norte, v_id_emp_n_train, current_date - 10, current_date + 20, true,  'Ciclo activo supervisado por Julián Castro'),
    (v_id_rut_gn_2, v_id_sg_multi_n, v_id_gym_norte, v_id_emp_n_train, current_date - 40, current_date - 11, false, 'Fase inicial completada'),
    (v_id_rut_gs_1, v_id_sg_multi_s, v_id_gym_sur,   v_id_emp_s_train, current_date - 5,  current_date + 25, true,  'Complemento en Sur Power');

  raise notice 'OK — Seed de pruebas GymTrack insertado correctamente.';
end;
$$;

commit;
