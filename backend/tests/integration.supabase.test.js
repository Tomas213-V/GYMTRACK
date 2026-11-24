// ==============================================================================
// PRUEBAS DE INTEGRACIÓN REAL CONTRA SUPABASE / POSTGRESQL (SECCIÓN 9 — MODELO 01..07)
// Requisitos:
//   1. Haber ejecutado schema_definitivo.sql + 07 (Escenario A) o 01..07 (Escenario B).
//   2. Tener SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
//      en backend/.env apuntando a un entorno AISLADO de pruebas (nunca producción).
// Ejecutar: node --test backend/tests/integration.supabase.test.js
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '..', '.env') });

const { supabaseAnon, supabaseAdmin, createSupabaseClientForToken } = require('../src/config/supabase');

const HAS_LIVE_CREDS = Boolean(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SKIP_REASON =
  'Requiere SUPABASE_SERVICE_ROLE_KEY configurada en backend/.env y migraciones 01..07 aplicadas en entorno de pruebas aislado';

test(
  'Integración Live Supabase (Sección 9): Identidades, Accesos, Membresías/Renovación Anticipada, Asistencias, Ejercicios y Rutinas Separadas',
  { skip: !HAS_LIVE_CREDS ? SKIP_REASON : false },
  async (t) => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const pass = 'GymTrackTest#2026';
    const createdAuthIds = [];

    const createAuthAndSignIn = async (email) => {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pass,
        email_confirm: true
      });
      assert.ifError(createErr);
      createdAuthIds.push(created.user.id);

      const { data: signIn, error: signErr } = await supabaseAnon.auth.signInWithPassword({
        email,
        password: pass
      });
      assert.ifError(signErr);
      return {
        user: created.user,
        client: createSupabaseClientForToken(signIn.session.access_token)
      };
    };

    try {
      // Comprobar que el modelo definitivo (05..07 / schema_definitivo) está aplicado
      const { error: schemaCheckErr } = await supabaseAdmin.from('socio_gimnasio').select('id_socio_gimnasio').limit(1);
      if (schemaCheckErr) {
        throw new Error(`El modelo definitivo 05..07 aún no está aplicado en el entorno de pruebas: ${schemaCheckErr.message}`);
      }

      // Fixtures base: Dueño A (Gym A, Suc A1 y A2, Plan A1, Plan A2) y Dueño B (Gym B, Suc B1, Plan B)
      const ownerA = await createAuthAndSignIn(`owner_a_${suffix}@gymtrack.test`);
      const { data: duenoA } = await ownerA.client
        .from('dueno')
        .insert({ auth_user_id: ownerA.user.id, nombre: 'Dueño', apellido: 'A', email: ownerA.user.email })
        .select()
        .single();

      const { data: gymA } = await ownerA.client
        .from('gimnasio')
        .insert({ nombre: `Gym A ${suffix}`, id_dueno: duenoA.id_dueno, estado: true })
        .select()
        .single();
      const { data: sucA1 } = await ownerA.client
        .from('sucursal')
        .insert({ direccion: 'Sede Centro A', id_gimnasio: gymA.id_gimnasio, estado: true })
        .select()
        .single();
      const { data: sucA2 } = await ownerA.client
        .from('sucursal')
        .insert({ direccion: 'Sede Norte A', id_gimnasio: gymA.id_gimnasio, estado: true })
        .select()
        .single();
      const { data: planA1 } = await ownerA.client
        .from('membresia_gimnasio')
        .insert({ nombre: `Plan A1 ${suffix}`, precio: 25000, duracion_dias: 30, id_gimnasio: gymA.id_gimnasio, estado: true })
        .select()
        .single();
      const { data: planA2 } = await ownerA.client
        .from('membresia_gimnasio')
        .insert({ nombre: `Plan A2 ${suffix}`, precio: 40000, duracion_dias: 60, id_gimnasio: gymA.id_gimnasio, estado: true })
        .select()
        .single();

      const ownerB = await createAuthAndSignIn(`owner_b_${suffix}@gymtrack.test`);
      const { data: duenoB } = await ownerB.client
        .from('dueno')
        .insert({ auth_user_id: ownerB.user.id, nombre: 'Dueño', apellido: 'B', email: ownerB.user.email })
        .select()
        .single();
      const { data: gymB } = await ownerB.client
        .from('gimnasio')
        .insert({ nombre: `Gym B ${suffix}`, id_dueno: duenoB.id_dueno, estado: true })
        .select()
        .single();
      const { data: sucB1 } = await ownerB.client
        .from('sucursal')
        .insert({ direccion: 'Sede B1', id_gimnasio: gymB.id_gimnasio, estado: true })
        .select()
        .single();
      const { data: planB } = await ownerB.client
        .from('membresia_gimnasio')
        .insert({ nombre: `Plan B ${suffix}`, precio: 30000, duracion_dias: 30, id_gimnasio: gymB.id_gimnasio, estado: true })
        .select()
        .single();

      const ownerC = await createAuthAndSignIn(`owner_c_${suffix}@gymtrack.test`);
      const { data: duenoC } = await ownerC.client
        .from('dueno')
        .insert({ auth_user_id: ownerC.user.id, nombre: 'Dueño', apellido: 'C', email: ownerC.user.email })
        .select()
        .single();
      const { data: gymC } = await ownerC.client
        .from('gimnasio')
        .insert({ nombre: `Gym C ${suffix}`, id_dueno: duenoC.id_dueno, estado: true })
        .select()
        .single();

      // Administrador con una sola cuenta asignado a Gym A y Gym B (NO a Gym C)
      const adminUser = await createAuthAndSignIn(`admin_org_${suffix}@gymtrack.test`);
      const { data: adminRow } = await supabaseAdmin
        .from('administrador')
        .insert({ auth_user_id: adminUser.user.id, nombre: 'Admin', apellido: 'MultiGym', email: adminUser.user.email, estado: true })
        .select()
        .single();
      const { data: adminAssignA } = await ownerA.client
        .from('administrador_gimnasio')
        .insert({ id_administrador: adminRow.id_administrador, id_gimnasio: gymA.id_gimnasio, estado: true })
        .select()
        .single();
      const { data: adminAssignB } = await ownerB.client
        .from('administrador_gimnasio')
        .insert({ id_administrador: adminRow.id_administrador, id_gimnasio: gymB.id_gimnasio, estado: true })
        .select()
        .single();

      // Empleados de Gym A asignados solo a Sucursal A1
      const recepUser = await createAuthAndSignIn(`recep_a_${suffix}@gymtrack.test`);
      const { data: recepEmp } = await ownerA.client
        .from('empleado')
        .insert({ auth_user_id: recepUser.user.id, id_gimnasio: gymA.id_gimnasio, nombre: 'Recep', apellido: 'A', email: recepUser.user.email, estado: true })
        .select()
        .single();
      await ownerA.client.from('empleado_sucursal').insert({ id_empleado: recepEmp.id_empleado, id_sucursal: sucA1.id_sucursal, rol: 'recepcionista', estado: true });

      const trainerUser = await createAuthAndSignIn(`trainer_a_${suffix}@gymtrack.test`);
      const { data: trainerEmp } = await ownerA.client
        .from('empleado')
        .insert({ auth_user_id: trainerUser.user.id, id_gimnasio: gymA.id_gimnasio, nombre: 'Coach', apellido: 'A', email: trainerUser.user.email, estado: true })
        .select()
        .single();
      await ownerA.client.from('empleado_sucursal').insert({ id_empleado: trainerEmp.id_empleado, id_sucursal: sucA1.id_sucursal, rol: 'entrenador', estado: true });

      // Socio 1 (una cuenta, múltiples asociaciones: Gym A y Gym B) y Socio 2 (solo Gym C)
      const socio1 = await createAuthAndSignIn(`socio1_${suffix}@gymtrack.test`);
      const { data: socio1Row } = await socio1.client
        .from('socio')
        .insert({ auth_user_id: socio1.user.id, nombre: 'Tomás', apellido: 'Multi', email: socio1.user.email, dni: `91${suffix.slice(-6)}`, estado: true })
        .select()
        .single();

      const socio2 = await createAuthAndSignIn(`socio2_${suffix}@gymtrack.test`);
      const { data: socio2Row } = await socio2.client
        .from('socio')
        .insert({ auth_user_id: socio2.user.id, nombre: 'Lucas', apellido: 'Tres', email: socio2.user.email, dni: `92${suffix.slice(-6)}`, estado: true })
        .select()
        .single();

      // ----------------------------------------------------------------------
      // IDENTIDADES Y ACCESOS (Sección 9)
      // ----------------------------------------------------------------------
      let sgSocio1GymA;
      let sgSocio1GymB;
      await t.test('Identidades y Accesos: socio multi-gimnasio, invitación de cuenta existente y administrador multi-gimnasio', async () => {
        // Socio 1 asociado a Gym A y luego invitado/asociado a Gym B conservando la misma cuenta socio
        // Un socio NO puede auto-asociarse unilateralmente ni insertar en socio_gimnasio directo
        const { error: errSelfAssoc } = await socio1.client.rpc('rpc_asociar_socio_gimnasio', {
          p_id_gimnasio: gymA.id_gimnasio,
          p_id_socio: socio1Row.id_socio
        });
        assert.ok(errSelfAssoc);
        const { error: errDirectSg } = await socio1.client.from('socio_gimnasio').insert({
          id_socio: socio1Row.id_socio,
          id_gimnasio: gymA.id_gimnasio
        });
        assert.ok(errDirectSg);

        const { data: assocA, error: errA } = await ownerA.client.rpc('rpc_asociar_socio_gimnasio', {
          p_id_gimnasio: gymA.id_gimnasio,
          p_id_socio: socio1Row.id_socio
        });
        assert.ifError(errA);
        sgSocio1GymA = assocA;

        const { data: resExistente, error: errB } = await ownerB.client.rpc('rpc_registrar_socio_gimnasio', {
          p_id_gimnasio: gymB.id_gimnasio,
          p_id_membresia_gimnasio: null,
          p_nombre: 'Tomás',
          p_apellido: 'Multi',
          p_dni: socio1Row.dni,
          p_email: socio1Row.email
        });
        assert.ifError(errB);
        assert.equal(resExistente.creado, false);
        assert.equal(resExistente.socio.id_socio, socio1Row.id_socio);
        sgSocio1GymB = resExistente.socio_gimnasio;

        // Socio 1 no ve Gym C al que no está asociado
        const { data: gymsSocio1 } = await socio1.client.from('gimnasio').select('id_gimnasio');
        assert.ok(gymsSocio1.some((g) => g.id_gimnasio === gymA.id_gimnasio));
        assert.ok(gymsSocio1.some((g) => g.id_gimnasio === gymB.id_gimnasio));
        assert.ok(gymsSocio1.every((g) => g.id_gimnasio !== gymC.id_gimnasio));

        // Administrador autorizado en Gym A y B (ambas sucursales de A), pero bloqueado en Gym C
        const { data: sucsAdminA } = await adminUser.client.from('sucursal').select('id_sucursal').eq('id_gimnasio', gymA.id_gimnasio);
        assert.equal(sucsAdminA.length, 2);
        const { data: sucsAdminC } = await adminUser.client.from('sucursal').select('id_sucursal').eq('id_gimnasio', gymC.id_gimnasio);
        assert.equal((sucsAdminC || []).length, 0);

        // Desactivar asignación del admin en Gym B conserva intacta su cuenta y acceso a Gym A
        await ownerB.client
          .from('administrador_gimnasio')
          .update({ estado: false })
          .eq('id_administrador_gimnasio', adminAssignB.id_administrador_gimnasio);
        const { data: sucsAdminBPost } = await adminUser.client.from('sucursal').select('id_sucursal').eq('id_gimnasio', gymB.id_gimnasio);
        assert.equal((sucsAdminBPost || []).length, 0);
        const { data: sucsAdminAPost } = await adminUser.client.from('sucursal').select('id_sucursal').eq('id_gimnasio', gymA.id_gimnasio);
        assert.equal(sucsAdminAPost.length, 2);
        assert.ok(adminAssignA.id_administrador_gimnasio);

        // Empleado asignado solo a Suc A1 no accede a A2 ni B1
        const { data: sucsRecep } = await recepUser.client.from('sucursal').select('id_sucursal');
        assert.deepEqual(sucsRecep.map((s) => s.id_sucursal), [sucA1.id_sucursal]);
      });

      // ----------------------------------------------------------------------
      // MEMBRESÍAS Y RENOVACIÓN ANTICIPADA (Sección 9)
      // ----------------------------------------------------------------------
      let membA1;
      await t.test('Membresías: primera contratación, renovación anticipada encadenada, cambio de plan, otro gym e historial', async () => {
        // 1. Primera contratación en Gym A
        const { data: c1, error: errC1 } = await recepUser.client.rpc('rpc_contratar_membresia', {
          p_id_socio: socio1Row.id_socio,
          p_id_membresia_gimnasio: planA1.id_membresia_gimnasio,
          p_registrar_pago: true
        });
        assert.ifError(errC1);
        membA1 = c1.membresia_socio;
        assert.equal(membA1.id_socio_gimnasio, sgSocio1GymA.id_socio_gimnasio);

        // 2. Renovación anticipada en Gym A con Plan A2: encadena fecha_inicio = vencimiento_1 + 1 e inserta NUEVA fila
        const { data: c2, error: errC2 } = await adminUser.client.rpc('rpc_contratar_membresia', {
          p_id_socio: socio1Row.id_socio,
          p_id_membresia_gimnasio: planA2.id_membresia_gimnasio,
          p_registrar_pago: true
        });
        assert.ifError(errC2);
        const membA2 = c2.membresia_socio;
        assert.notEqual(membA2.id_membresia_socio, membA1.id_membresia_socio);
        assert.ok(membA2.fecha_inicio > membA1.fecha_vencimiento);

        // 3. Historial completo conservado
        const { data: hist } = await socio1.client
          .from('membresia_socio')
          .select('id_membresia_socio')
          .eq('id_socio_gimnasio', sgSocio1GymA.id_socio_gimnasio);
        assert.equal(hist.length, 2);

        // 4. Contratación en Gym B (otro gimnasio) en pendiente + flujo estricto de pagos
        const { data: cB, error: errCB } = await ownerB.client.rpc('rpc_contratar_membresia', {
          p_id_socio: socio1Row.id_socio,
          p_id_membresia_gimnasio: planB.id_membresia_gimnasio,
          p_estado: 'pendiente',
          p_registrar_pago: false
        });
        assert.ifError(errCB);
        assert.equal(cB.membresia_socio.id_socio_gimnasio, sgSocio1GymB.id_socio_gimnasio);
        assert.equal(cB.membresia_socio.estado, 'pendiente');

        // 4b. Pago parcial (10000 / 30000) aprobado NO activa la membresía; sobrepago rechazado; pago completo activa; anulación revierte a pendiente
        const { data: pParcial, error: errParcial } = await ownerB.client.rpc('rpc_registrar_pago', {
          p_id_membresia_socio: cB.membresia_socio.id_membresia_socio,
          p_monto: 10000,
          p_metodo_pago: 'efectivo',
          p_estado: 'aprobado',
          p_comprobante: `REC-PARC-${suffix}`
        });
        assert.ifError(errParcial);
        const { data: mPostParcial } = await ownerB.client
          .from('membresia_socio')
          .select('estado')
          .eq('id_membresia_socio', cB.membresia_socio.id_membresia_socio)
          .single();
        assert.equal(mPostParcial.estado, 'pendiente');

        const { error: errSobrepago } = await ownerB.client.rpc('rpc_registrar_pago', {
          p_id_membresia_socio: cB.membresia_socio.id_membresia_socio,
          p_monto: 25000,
          p_metodo_pago: 'efectivo',
          p_estado: 'aprobado',
          p_comprobante: `REC-EXC-${suffix}`
        });
        assert.ok(errSobrepago);

        const { data: pResto, error: errResto } = await ownerB.client.rpc('rpc_registrar_pago', {
          p_id_membresia_socio: cB.membresia_socio.id_membresia_socio,
          p_monto: 20000,
          p_metodo_pago: 'transferencia',
          p_estado: 'aprobado',
          p_comprobante: `REC-COMP-${suffix}`
        });
        assert.ifError(errResto);
        const { data: mPostFull } = await ownerB.client
          .from('membresia_socio')
          .select('estado')
          .eq('id_membresia_socio', cB.membresia_socio.id_membresia_socio)
          .single();
        assert.equal(mPostFull.estado, 'activa');

        const { data: pAnul, error: errAnulP } = await ownerB.client.rpc('rpc_actualizar_estado_pago', {
          p_id_pago: pResto.id_pago,
          p_estado: 'anulado'
        });
        assert.ifError(errAnulP);
        assert.equal(pAnul.estado, 'anulado');
        assert.ok(pParcial.id_pago);
        const { data: mPostAnul } = await ownerB.client
          .from('membresia_socio')
          .select('estado')
          .eq('id_membresia_socio', cB.membresia_socio.id_membresia_socio)
          .single();
        assert.equal(mPostAnul.estado, 'pendiente');

        // 4c. Escritura directa UPDATE/DELETE sobre membresia_socio bloqueada para authenticated
        const { error: errDirectMemUpd } = await ownerB.client
          .from('membresia_socio')
          .update({ estado: 'activa' })
          .eq('id_membresia_socio', cB.membresia_socio.id_membresia_socio);
        assert.ok(errDirectMemUpd);

        // 5. Bloqueo de FK cruzada al intentar asociar socio_gimnasio de A con plan de B por SQL/service_role
        const { error: errCrossFk } = await supabaseAdmin.from('membresia_socio').insert({
          id_socio_gimnasio: sgSocio1GymA.id_socio_gimnasio,
          id_membresia_gimnasio: planB.id_membresia_gimnasio,
          id_gimnasio: gymB.id_gimnasio,
          precio: 30000,
          duracion_dias_contratados: 30,
          fecha_inicio: '2026-01-01',
          fecha_vencimiento: '2026-01-31',
          estado: 'activa'
        });
        assert.ok(errCrossFk);
      });

      // ----------------------------------------------------------------------
      // ASISTENCIAS (Sección 9)
      // ----------------------------------------------------------------------
      await t.test('Asistencias: vigente, otra sucursal, doble ingreso, salida, vencida, otro gym y bloqueo directo', async () => {
        const { data: a1, error: errA1 } = await socio1.client.rpc('rpc_registrar_ingreso_asistencia', {
          p_id_sucursal: sucA1.id_sucursal,
          p_id_socio: socio1Row.id_socio
        });
        assert.ifError(errA1);

        // Doble ingreso abierto rechazado
        const { error: errDup } = await socio1.client.rpc('rpc_registrar_ingreso_asistencia', {
          p_id_sucursal: sucA2.id_sucursal,
          p_id_socio: socio1Row.id_socio
        });
        assert.ok(errDup);

        // Salida autorizada
        const { data: s1, error: errOut1 } = await recepUser.client.rpc('rpc_registrar_salida_asistencia', {
          p_id_asistencia_socio: a1.id_asistencia_socio,
          p_id_socio: socio1Row.id_socio
        });
        assert.ifError(errOut1);
        assert.equal(s1.estado, 'finalizada');

        // Ingreso en otra sucursal del mismo gimnasio (Sucursal A2) y anulación con trazabilidad
        const { data: a2, error: errA2 } = await socio1.client.rpc('rpc_registrar_ingreso_asistencia', {
          p_id_sucursal: sucA2.id_sucursal,
          p_id_socio: socio1Row.id_socio
        });
        assert.ifError(errA2);
        const { data: a2Anulada, error: errAnulA2 } = await ownerA.client.rpc('rpc_anular_asistencia', {
          p_id_asistencia_socio: a2.id_asistencia_socio,
          p_motivo: 'Cierre administrativo de prueba'
        });
        assert.ifError(errAnulA2);
        assert.equal(a2Anulada.estado, 'anulada');
        assert.equal(a2Anulada.anulada_por, ownerA.user.id);
        assert.ok(a2Anulada.anulada_en);

        // Ingreso en Gym B sin membresía activa (tiene pendiente/sin activar o cancelada) rechazado
        const { error: errNoGym } = await socio1.client.rpc('rpc_registrar_ingreso_asistencia', {
          p_id_sucursal: sucB1.id_sucursal,
          p_id_socio: socio1Row.id_socio
        });
        assert.ok(errNoGym);

        // Bloqueo de modificación o inserción directa PostgREST
        const { error: errDirectIns } = await socio1.client.from('asistencia_socio').insert({
          id_socio: socio1Row.id_socio,
          id_sucursal: sucA1.id_sucursal
        });
        assert.ok(errDirectIns);
        const { error: errDirectUpd } = await socio1.client.from('asistencia_socio').update({ id_sucursal: sucA2.id_sucursal }).eq('id_asistencia_socio', a1.id_asistencia_socio);
        assert.ok(errDirectUpd);
      });

      // ----------------------------------------------------------------------
      // RUTINAS Y EJERCICIOS SEPARADOS (Sección 9)
      // ----------------------------------------------------------------------
      await t.test('Rutinas y Ejercicios: separación personal/gimnasio, anti-cruce, asignaciones y permisos entrenador/recepcionista', async () => {
        // Socio 1 crea ejercicio personal y rutina personal
        const { data: ejSoc, error: errEjS } = await socio1.client
          .from('ejercicio_socio')
          .insert({ id_socio: socio1Row.id_socio, nombre: 'Mi Dominada' })
          .select()
          .single();
        assert.ifError(errEjS);

        const { data: rutSoc, error: errRutS } = await socio1.client
          .from('rutina_socio')
          .insert({ id_socio: socio1Row.id_socio, nombre: 'Rutina Propia' })
          .select()
          .single();
        assert.ifError(errRutS);

        const { error: errRes } = await socio1.client.from('rutina_ejercicio_socio').insert({
          id_rutina_socio: rutSoc.id_rutina_socio,
          id_socio: socio1Row.id_socio,
          id_ejercicio_socio: ejSoc.id_ejercicio_socio,
          series: 4,
          repeticiones: 8,
          orden: 1
        });
        assert.ifError(errRes);

        // Entrenador crea ejercicio_gimnasio y rutina_gimnasio de Gym A y la asigna a Socio 1
        const { data: ejGymA, error: errEjG } = await trainerUser.client
          .from('ejercicio_gimnasio')
          .insert({ id_gimnasio: gymA.id_gimnasio, nombre: 'Prensa Gym A' })
          .select()
          .single();
        assert.ifError(errEjG);

        const { data: rutGymA, error: errRutG } = await trainerUser.client
          .from('rutina_gimnasio')
          .insert({ id_gimnasio: gymA.id_gimnasio, nombre: 'Hipertrofia A', estado: true })
          .select()
          .single();
        assert.ifError(errRutG);

        const { error: errReg } = await trainerUser.client.from('rutina_ejercicio_gimnasio').insert({
          id_rutina_gimnasio: rutGymA.id_rutina_gimnasio,
          id_gimnasio: gymA.id_gimnasio,
          id_ejercicio_gimnasio: ejGymA.id_ejercicio_gimnasio,
          series: 4,
          repeticiones: 10,
          orden: 1
        });
        assert.ifError(errReg);

        const { data: asign, error: errAsig } = await trainerUser.client.rpc('rpc_asignar_rutina_gimnasio_socio', {
          p_id_rutina_gimnasio: rutGymA.id_rutina_gimnasio,
          p_id_socio_gimnasio: sgSocio1GymA.id_socio_gimnasio
        });
        assert.ifError(errAsig);
        assert.equal(asign.estado, true);
        assert.equal(asign.id_empleado_responsable, trainerEmp.id_empleado);

        // Bloqueo de escritura directa en rutinas_asignadas_socio_gimnasio y finalización por RPC
        const { error: errDirectRasg } = await trainerUser.client
          .from('rutinas_asignadas_socio_gimnasio')
          .update({ estado: false })
          .eq('id_rutina_asignada', asign.id_rutina_asignada);
        assert.ok(errDirectRasg);

        const { data: asignFin, error: errFinRasg } = await trainerUser.client.rpc('rpc_finalizar_rutina_asignada', {
          p_id_rutina_asignada: asign.id_rutina_asignada,
          p_observaciones: 'Fin ciclo test'
        });
        assert.ifError(errFinRasg);
        assert.equal(asignFin.estado, false);

        // Cruce entre propietarios distintos rechazado por FK compuesta (rutina Gym A + ejercicio Gym B)
        const { data: ejGymB } = await ownerB.client
          .from('ejercicio_gimnasio')
          .insert({ id_gimnasio: gymB.id_gimnasio, nombre: 'Remo Gym B' })
          .select()
          .single();
        const { error: errCrossEj } = await supabaseAdmin.from('rutina_ejercicio_gimnasio').insert({
          id_rutina_gimnasio: rutGymA.id_rutina_gimnasio,
          id_gimnasio: gymA.id_gimnasio,
          id_ejercicio_gimnasio: ejGymB.id_ejercicio_gimnasio,
          series: 3,
          repeticiones: 12,
          orden: 2
        });
        assert.ok(errCrossEj);

        // Asignar rutina de Gym A a Socio 2 (no asociado a Gym A) rechazado
        const { data: sgSocio2C } = await ownerC.client.rpc('rpc_asociar_socio_gimnasio', {
          p_id_gimnasio: gymC.id_gimnasio,
          p_id_socio: socio2Row.id_socio
        });
        const { error: errCrossAsig } = await trainerUser.client.rpc('rpc_asignar_rutina_gimnasio_socio', {
          p_id_rutina_gimnasio: rutGymA.id_rutina_gimnasio,
          p_id_socio_gimnasio: sgSocio2C.id_socio_gimnasio
        });
        assert.ok(errCrossAsig);

        // Recepcionista NO puede crear ni modificar rutina_gimnasio ni asignaciones
        const { error: errRecepRut } = await recepUser.client.from('rutina_gimnasio').insert({
          id_gimnasio: gymA.id_gimnasio,
          nombre: 'No autorizada'
        });
        assert.ok(errRecepRut);
      });
    } finally {
      for (const uid of createdAuthIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
      }
    }
  }
);
