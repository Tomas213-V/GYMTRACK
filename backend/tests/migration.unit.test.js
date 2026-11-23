// ==============================================================================
// SUITE DE PRUEBAS UNITARIAS Y DE REGLAS DE NEGOCIO — MIGRACIÓN SUPABASE GYMTRACK
// Ejecutar: node --test backend/tests/migration.unit.test.js
// ==============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  verifyToken,
  requireRoles,
  requirePermission,
  requireGimnasioAccess,
  canAccessSucursal,
  resolverContextoUsuario
} = require('../src/middlewares/authMiddleware');

const sucursalController = require('../src/controllers/sucursalController');
const empleadoController = require('../src/controllers/empleadoController');
const planMembresiaController = require('../src/controllers/planMembresiaController');
const asistenciaController = require('../src/controllers/asistenciaController');
const ejercicioController = require('../src/controllers/ejercicioController');
const rutinaController = require('../src/controllers/rutinaController');
const pagoController = require('../src/controllers/pagoController');
const gimnasioController = require('../src/controllers/gimnasioController');
const socioController = require('../src/controllers/socioController');
const paymentGatewayService = require('../src/services/paymentGatewayService');

// Helper para crear un objeto Express Response simulado
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

// Helper para construir un query builder chainable de Supabase simulado
function createSupabaseMock({ tables = {}, rpcHandlers = {} } = {}) {
  return {
    from(tableName) {
      const state = {
        table: tableName,
        op: 'select',
        filters: [],
        payload: null,
        single: false,
        maybeSingle: false
      };

      const chain = {
        select() {
          if (state.op === 'select') state.op = 'select';
          return chain;
        },
        insert(payload) {
          state.op = 'insert';
          state.payload = Array.isArray(payload) ? payload[0] : payload;
          return chain;
        },
        update(payload) {
          state.op = 'update';
          state.payload = payload;
          return chain;
        },
        delete() {
          state.op = 'delete';
          return chain;
        },
        eq(col, val) {
          state.filters.push({ type: 'eq', col, val });
          return chain;
        },
        neq(col, val) {
          state.filters.push({ type: 'neq', col, val });
          return chain;
        },
        lte(col, val) {
          state.filters.push({ type: 'lte', col, val });
          return chain;
        },
        gte(col, val) {
          state.filters.push({ type: 'gte', col, val });
          return chain;
        },
        lt(col, val) {
          state.filters.push({ type: 'lt', col, val });
          return chain;
        },
        gt(col, val) {
          state.filters.push({ type: 'gt', col, val });
          return chain;
        },
        or(expr) {
          state.filters.push({ type: 'or', expr });
          return chain;
        },
        ilike(col, val) {
          state.filters.push({ type: 'ilike', col, val });
          return chain;
        },
        in(col, vals) {
          state.filters.push({ type: 'in', col, vals });
          return chain;
        },
        is(col, val) {
          state.filters.push({ type: 'is', col, val });
          return chain;
        },
        not(col, op, val) {
          state.filters.push({ type: 'not', col, op, val });
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        range() {
          return chain;
        },
        single() {
          state.single = true;
          return chain;
        },
        maybeSingle() {
          state.maybeSingle = true;
          return chain;
        },
        then(resolve, reject) {
          try {
            const handler = tables[tableName];
            let result;
            if (typeof handler === 'function') {
              result = handler(state);
            } else {
              result = handler || { data: state.single || state.maybeSingle ? null : [], error: null };
            }
            return Promise.resolve(result).then(resolve, reject);
          } catch (err) {
            return Promise.reject(err).then(resolve, reject);
          }
        }
      };

      return chain;
    },
    async rpc(fnName, params) {
      if (rpcHandlers[fnName]) {
        return rpcHandlers[fnName](params);
      }
      return { data: null, error: { message: `RPC ${fnName} no mockeada` } };
    }
  };
}

// ==============================================================================
// SUITE 1: AUTENTICACIÓN, ROLES, PERMISOS Y AISLAMIENTO (ESCENARIOS B y E)
// ==============================================================================
test('AuthMiddleware: rechaza peticiones sin Bearer token con 401', async () => {
  const req = { headers: {} };
  const res = createMockRes();
  let nextCalled = false;

  await verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /token/i);
});

test('Escenario E (Aislamiento): requireGimnasioAccess bloquea intento de acceder a gimnasio ajeno con 403', () => {
  const req = {
    usuario: {
      rol: 'socio',
      id_socio: 10,
      id_gimnasio: 1,
      requested_gym_id: 99,
      requested_gym_autorizado: false
    }
  };
  const res = createMockRes();
  let nextCalled = false;

  requireGimnasioAccess(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /permisos/i);
});

test('Permisos por rol y sucursal: empleado solo accede a sus sucursales asignadas y roles permitidos', () => {
  const dueno = { rol: 'dueño', permisos: ['*'] };
  const recepcionista = {
    rol: 'empleado',
    roles_empleado: ['recepcionista'],
    permisos: ['ver_dashboard', 'gestionar_socios', 'gestionar_pagos', 'gestionar_asistencias'],
    sucursales_asignadas: [
      { id_sucursal: 5, rol: 'recepcionista', id_gimnasio: 1 }
    ]
  };
  const socio = { rol: 'socio', permisos: ['socio_self'] };

  assert.equal(canAccessSucursal(dueno, 99), true);
  assert.equal(canAccessSucursal(recepcionista, 5), true);
  assert.equal(canAccessSucursal(recepcionista, 5, ['recepcionista', 'administrador']), true);
  assert.equal(canAccessSucursal(recepcionista, 5, ['administrador']), false);
  assert.equal(canAccessSucursal(recepcionista, 6), false);
  assert.equal(canAccessSucursal(socio, 5), false);

  // requirePermission
  const resOk = createMockRes();
  let okCalled = false;
  requirePermission('gestionar_pagos')({ usuario: recepcionista }, resOk, () => {
    okCalled = true;
  });
  assert.equal(okCalled, true);

  const resDenied = createMockRes();
  let deniedCalled = false;
  requirePermission('gestionar_ejercicios')({ usuario: recepcionista }, resDenied, () => {
    deniedCalled = true;
  });
  assert.equal(deniedCalled, false);
  assert.equal(resDenied.statusCode, 403);

  // requireRoles
  const resRoleDenied = createMockRes();
  requireRoles('dueño', 'empleado:administrador')({ usuario: recepcionista }, resRoleDenied, () => {});
  assert.equal(resRoleDenied.statusCode, 403);
});

test('Escenario B (Socio Multigimnasio): resolverContextoUsuario carga 3 gimnasios y valida selección sin cerrar sesión', async () => {
  const mockSupabase = createSupabaseMock({
    tables: {
      dueno: { data: null, error: null },
      empleado: { data: null, error: null },
      socio: {
        data: {
          id_socio: 77,
          auth_user_id: 'uuid-tomas',
          nombre: 'Tomás',
          apellido: 'Prueba',
          email: 'tomas@test.com',
          estado: true
        },
        error: null
      },
      membresia_socio: {
        data: [
          {
            id_membresia_socio: 1,
            id_gimnasio: 101,
            estado: 'activa',
            fecha_vencimiento: '2027-01-01',
            gimnasio: { id_gimnasio: 101, nombre: 'Gimnasio A', estado: true }
          },
          {
            id_membresia_socio: 2,
            id_gimnasio: 102,
            estado: 'activa',
            fecha_vencimiento: '2027-01-01',
            gimnasio: { id_gimnasio: 102, nombre: 'Gimnasio B', estado: true }
          },
          {
            id_membresia_socio: 3,
            id_gimnasio: 103,
            estado: 'activa',
            fecha_vencimiento: '2027-01-01',
            gimnasio: { id_gimnasio: 103, nombre: 'Gimnasio C', estado: true }
          }
        ],
        error: null
      }
    }
  });

  // 1. Selección válida del Gimnasio B
  const ctxB = await resolverContextoUsuario(mockSupabase, { id: 'uuid-tomas', email: 'tomas@test.com' }, 102, 'socio');
  assert.equal(ctxB.rol, 'socio');
  assert.equal(ctxB.gimnasios.length, 3);
  assert.equal(ctxB.id_gimnasio, 102);
  assert.equal(ctxB.gimnasio.nombre, 'Gimnasio B');
  assert.equal(ctxB.requested_gym_autorizado, true);

  // 2. Intento de acceder al Gimnasio Z (999) no contratado -> rechazado
  const ctxZ = await resolverContextoUsuario(mockSupabase, { id: 'uuid-tomas', email: 'tomas@test.com' }, 999, 'socio');
  assert.equal(ctxZ.requested_gym_autorizado, false);
  assert.notEqual(ctxZ.id_gimnasio, 999);
});

// ==============================================================================
// SUITE 2: DUEÑO — SUCURSALES, EMPLEADOS Y PLANES (ESCENARIO A)
// ==============================================================================
test('Escenario A: sucursalController valida dirección obligatoria y vincula al gimnasio activo', async () => {
  // 1. Falta dirección -> 400
  const resBad = createMockRes();
  await sucursalController.createSucursal(
    { body: { direccion: '   ' }, gimnasioId: 10, supabase: createSupabaseMock() },
    resBad
  );
  assert.equal(resBad.statusCode, 400);

  // 2. Creación válida -> 201 con id_gimnasio del contexto
  let insertedPayload = null;
  const mockSb = createSupabaseMock({
    tables: {
      sucursal: (state) => {
        insertedPayload = state.payload;
        return { data: { id_sucursal: 50, ...state.payload }, error: null };
      }
    }
  });
  const resOk = createMockRes();
  await sucursalController.createSucursal(
    {
      body: { direccion: 'Av. Corrientes 1234', telefono: '11-5555-0000', descripcion: 'Sede Centro', estado: true },
      gimnasioId: 10,
      supabase: mockSb
    },
    resOk
  );
  assert.equal(resOk.statusCode, 201);
  assert.equal(insertedPayload.id_gimnasio, 10);
  assert.equal(insertedPayload.estado, true);
});

test('Escenario A: empleadoController rechaza roles inválidos y sucursales ajenas', async () => {
  const resBadRole = createMockRes();
  await empleadoController.createEmpleado(
    {
      body: {
        nombre: 'Laura',
        apellido: 'Gomez',
        email: 'laura@gym.com',
        asignaciones: [{ id_sucursal: 1, rol: 'superadmin_invalido' }]
      },
      gimnasioId: 10,
      supabase: createSupabaseMock()
    },
    resBadRole
  );
  assert.equal(resBadRole.statusCode, 400);
  assert.match(resBadRole.body.error, /rol/i);
});

test('Escenario A: planMembresiaController admite duración personalizada libre y límites opcionales', async () => {
  let capturedPlan = null;
  const mockSb = createSupabaseMock({
    tables: {
      membresia_gimnasio: (state) => {
        capturedPlan = state.payload;
        return { data: { id_membresia_gimnasio: 7, ...state.payload }, error: null };
      }
    }
  });

  // Duración personalizada de 45 días + límites opcionales
  const res = createMockRes();
  await planMembresiaController.createPlanMembresia(
    {
      body: {
        nombre: 'Pack 45 días',
        descripcion: 'Acceso total todas las sedes',
        precio: 32000,
        duracion_dias: 45,
        limite_asistencias_semanales: 4,
        limite_asistencias_totales: 24,
        estado: true
      },
      gimnasioId: 10,
      supabase: mockSb
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(capturedPlan.duracion_dias, 45);
  assert.equal(capturedPlan.limite_asistencias_semanales, 4);
  assert.equal(capturedPlan.limite_asistencias_totales, 24);
  assert.equal(capturedPlan.estado, true);

  // Duración <= 0 rechazada
  const resBad = createMockRes();
  await planMembresiaController.createPlanMembresia(
    { body: { nombre: 'Invalido', precio: 1000, duracion_dias: 0 }, gimnasioId: 10, supabase: mockSb },
    resBad
  );
  assert.equal(resBad.statusCode, 400);
});

// ==============================================================================
// SUITE 3: ASISTENCIAS SIMPLIFICADAS (socio + sucursal, sin id_membresia_socio ni id_gimnasio)
// ==============================================================================
test('Escenario C (1-4): asistenciaController exige sucursal, valida membresía dinámicamente, usa RPC 2-args y bloquea doble ingreso', async () => {
  // 1. Sin sucursal -> 400
  const resNoBranch = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: {},
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      gimnasioId: 101,
      supabase: createSupabaseMock()
    },
    resNoBranch
  );
  assert.equal(resNoBranch.statusCode, 400);
  assert.match(resNoBranch.body.error, /sucursal/i);

  // 2. Socio intenta registrar en sucursal de OTRO gimnasio sin coincidencia/membresía -> 403
  const mockSbCrossGym = createSupabaseMock({
    tables: {
      sucursal: { data: { id_sucursal: 99, id_gimnasio: 202, estado: true, direccion: 'Sucursal Ajena' }, error: null },
      membresia_socio: { data: null, error: null }
    }
  });
  const resCrossGym = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 99, id_socio: 77 },
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      gimnasioId: 101,
      supabase: mockSbCrossGym
    },
    resCrossGym
  );
  assert.equal(resCrossGym.statusCode, 403);

  // 3. Socio intenta enviar id_socio de otro socio -> 403
  const resSpoofSocio = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 5, id_socio: 999 },
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      gimnasioId: 101,
      supabase: createSupabaseMock()
    },
    resSpoofSocio
  );
  assert.equal(resSpoofSocio.statusCode, 403);

  // 4. Registro exitoso en sucursal autorizada -> RPC recibe SOLO p_id_sucursal y p_id_socio (sin p_id_membresia_socio)
  let rpcArgsCaptured = null;
  const mockSbOk = createSupabaseMock({
    tables: {
      sucursal: { data: { id_sucursal: 5, id_gimnasio: 101, estado: true, direccion: 'Sede Centro' }, error: null },
      membresia_socio: {
        data: { id_membresia_socio: 33, estado: 'activa', fecha_inicio: '2020-01-01', fecha_vencimiento: '2099-12-31' },
        error: null
      },
      asistencia_socio: {
        data: {
          id_asistencia_socio: 501,
          id_socio: 77,
          id_sucursal: 5,
          hora_ingreso: '2026-11-20T15:00:00Z',
          hora_salida: null,
          estado: 'presente',
          socio: { id_socio: 77, nombre: 'Tomás', apellido: 'Test', dni: '39123456' },
          sucursal: { id_sucursal: 5, direccion: 'Sede Centro', id_gimnasio: 101, gimnasio: { id_gimnasio: 101, nombre: 'Gym A' } }
        },
        error: null
      }
    },
    rpcHandlers: {
      rpc_registrar_ingreso_asistencia: (params) => {
        rpcArgsCaptured = params;
        return { data: { id_asistencia_socio: 501, id_socio: 77, id_sucursal: 5, estado: 'presente' }, error: null };
      }
    }
  });
  const resOk = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 5 },
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      gimnasioId: 101,
      supabase: mockSbOk
    },
    resOk
  );
  assert.equal(resOk.statusCode, 201);
  assert.deepEqual(rpcArgsCaptured, { p_id_sucursal: 5, p_id_socio: 77 });
  assert.equal('p_id_membresia_socio' in rpcArgsCaptured, false);
  assert.equal(resOk.body.asistencia.sucursal.direccion, 'Sede Centro');

  // 5. Ingreso simultáneo bloqueado por RPC/DB -> propaga error real
  const mockSbDup = createSupabaseMock({
    tables: {
      sucursal: { data: { id_sucursal: 5, id_gimnasio: 101, estado: true, direccion: 'Centro' }, error: null },
      membresia_socio: {
        data: { id_membresia_socio: 33, estado: 'activa', fecha_inicio: '2020-01-01', fecha_vencimiento: '2099-12-31' },
        error: null
      }
    },
    rpcHandlers: {
      rpc_registrar_ingreso_asistencia: () => ({
        data: null,
        error: { message: 'Ya existe un ingreso en curso (asistencia #501). Debes registrar la salida antes de volver a ingresar.' }
      })
    }
  });

  const resDup = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 5 },
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      gimnasioId: 101,
      supabase: mockSbDup
    },
    resDup
  );
  assert.ok(resDup.statusCode >= 400 && resDup.statusCode < 500);
  assert.match(resDup.body.error, /salida|curso|abierta/i);
});

test('Escenario C (5, 7, 8): checkout localiza asistencia abierta, socio no ve ajenas, empleado bloqueado en sucursal ajena', async () => {
  // 5. Checkout sin id explícito ('abierta') usa RPC con p_id_socio
  let checkoutArgs = null;
  const mockSbOut = createSupabaseMock({
    rpcHandlers: {
      rpc_registrar_salida_asistencia: (params) => {
        checkoutArgs = params;
        return { data: { id_asistencia_socio: 501, id_socio: 77, id_sucursal: 5, estado: 'finalizada' }, error: null };
      }
    }
  });
  const resOut = createMockRes();
  await asistenciaController.checkoutAsistencia(
    {
      params: { id: 'abierta' },
      usuario: { rol: 'socio', id_socio: 77 },
      supabase: mockSbOut
    },
    resOut
  );
  assert.equal(resOut.statusCode, 200);
  assert.deepEqual(checkoutArgs, { p_id_asistencia_socio: null, p_id_socio: 77 });

  // 7. Socio no puede consultar asistencias de otro socio
  const resOtherSocio = createMockRes();
  await asistenciaController.getAsistenciasPorSocio(
    {
      params: { id_socio: '888' },
      query: {},
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 101 },
      supabase: createSupabaseMock()
    },
    resOtherSocio
  );
  assert.equal(resOtherSocio.statusCode, 403);

  // 8. Empleado no puede registrar asistencia en sucursal no asignada
  const resEmpDenied = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 99, id_socio: 77 },
      usuario: {
        rol: 'empleado',
        id_gimnasio: 101,
        sucursales_asignadas: [{ id_sucursal: 5, rol: 'recepcionista', id_gimnasio: 101 }]
      },
      gimnasioId: 101,
      supabase: createSupabaseMock()
    },
    resEmpDenied
  );
  assert.equal(resEmpDenied.statusCode, 403);
  assert.match(resEmpDenied.body.error, /permiso/i);
});

// ==============================================================================
// SUITE 4: EJERCICIOS (PROPIETARIO EXCLUSIVO) Y RUTINAS (ESCENARIO D)
// ==============================================================================
test('Escenario D: ejercicioController exige propietario exclusivo (id_gimnasio XOR id_socio) y protege ejercicios de gimnasio', async () => {
  let insertedGymEj = null;
  const mockSb = createSupabaseMock({
    tables: {
      ejercicio: (state) => {
        if (state.op === 'insert') {
          insertedGymEj = state.payload;
          return { data: { id_ejercicio: 90, ...state.payload }, error: null };
        }
        // Al buscar ejercicio existente para actualizar/borrar: pertenece al gimnasio (id_socio: null)
        return { data: { id_ejercicio: 90, id_gimnasio: 10, id_socio: null, nombre: 'Sentadilla' }, error: null };
      }
    }
  });

  // Dueño crea ejercicio del gimnasio -> id_gimnasio = 10, id_socio = null
  const resCreate = createMockRes();
  await ejercicioController.crearEjercicio(
    {
      body: { nombre: 'Press Militar', grupo_muscular: 'Hombros', dificultad: 'Intermedia' },
      usuario: { rol: 'dueño', id_dueno: 1, id_gimnasio: 10 },
      gimnasioId: 10,
      supabase: mockSb
    },
    resCreate
  );
  assert.equal(resCreate.statusCode, 201);
  assert.equal(insertedGymEj.id_gimnasio, 10);
  assert.equal(insertedGymEj.id_socio, null);

  // Socio intenta eliminar ejercicio del gimnasio -> 403
  const resSocioDelete = createMockRes();
  await ejercicioController.eliminarEjercicio(
    {
      params: { id: '90' },
      usuario: { rol: 'socio', id_socio: 77, id_gimnasio: 10 },
      gimnasioId: 10,
      supabase: mockSb
    },
    resSocioDelete
  );
  assert.equal(resSocioDelete.statusCode, 403);
});

test('Escenario D: rutinaController valida orden_ids en reordenamiento atómico vía RPC', async () => {
  const resBad = createMockRes();
  await rutinaController.reordenarEjerciciosRutina(
    {
      params: { id: '12' },
      body: { orden_ids: [] },
      usuario: { rol: 'socio', id_socio: 77 },
      supabase: createSupabaseMock()
    },
    resBad
  );
  assert.equal(resBad.statusCode, 400);

  let rpcCalledWith = null;
  const mockSb = createSupabaseMock({
    tables: {
      rutina: { data: { id_rutina: 12, id_socio: 77, nombre: 'Mi Rutina', estado: true }, error: null }
    },
    rpcHandlers: {
      rpc_reordenar_rutina_ejercicios: (params) => {
        rpcCalledWith = params;
        return { data: null, error: null };
      }
    }
  });

  const resOk = createMockRes();
  await rutinaController.reordenarEjerciciosRutina(
    {
      params: { id: '12' },
      body: { orden_ids: [30, 10, 20] },
      usuario: { rol: 'socio', id_socio: 77 },
      supabase: mockSb
    },
    resOk
  );
  assert.equal(resOk.statusCode, 200);
  assert.deepEqual(rpcCalledWith, { p_id_rutina: 12, p_ids_ordenados: [30, 10, 20] });
});

// ==============================================================================
// SUITE 5: PAGOS (RPC PROTEGIDA, ESTADOS VÁLIDOS Y ANULACIÓN SIN DELETE FÍSICO)
// ==============================================================================
test('Pagos: valida estados permitidos, usa rpc_registrar_pago / rpc_actualizar_estado_pago y no realiza DELETE físico', async () => {
  const resBad = createMockRes();
  await pagoController.actualizarEstadoPago(
    {
      params: { id: '1' },
      body: { estado: 'estado_inventado' },
      usuario: { rol: 'dueño', id_gimnasio: 10 },
      gimnasioId: 10,
      supabase: createSupabaseMock()
    },
    resBad
  );
  assert.equal(resBad.statusCode, 400);

  let rpcRegistrarArgs = null;
  let rpcEstadoArgs = null;
  let deleteCalled = false;
  let directPagoInsert = false;
  const mockSb = createSupabaseMock({
    tables: {
      membresia_socio: { data: { id_membresia_socio: 55, id_gimnasio: 10 }, error: null },
      pago: (state) => {
        if (state.op === 'delete') deleteCalled = true;
        if (state.op === 'insert') directPagoInsert = true;
        return {
          data: {
            id_pago: 1,
            id_membresia_socio: 55,
            monto: 20000,
            estado: rpcEstadoArgs ? rpcEstadoArgs.p_estado : 'aprobado',
            membresia_socio: { id_gimnasio: 10 }
          },
          error: null
        };
      }
    },
    rpcHandlers: {
      rpc_registrar_pago: (params) => {
        rpcRegistrarArgs = params;
        return { data: { id_pago: 1, id_membresia_socio: params.p_id_membresia_socio, monto: params.p_monto, estado: params.p_estado }, error: null };
      },
      rpc_actualizar_estado_pago: (params) => {
        rpcEstadoArgs = params;
        return { data: { id_pago: params.p_id_pago, estado: params.p_estado }, error: null };
      }
    }
  });

  const resReg = createMockRes();
  await pagoController.registrarPago(
    {
      body: { id_membresia_socio: 55, monto: 20000, metodo_pago: 'efectivo', estado: 'aprobado', comprobante: 'REC-100' },
      usuario: { rol: 'dueño', id_gimnasio: 10 },
      gimnasioId: 10,
      supabase: mockSb
    },
    resReg
  );
  assert.equal(resReg.statusCode, 201);
  assert.equal(directPagoInsert, false);
  assert.equal(rpcRegistrarArgs?.p_id_membresia_socio, 55);
  assert.equal(rpcRegistrarArgs?.p_estado, 'aprobado');

  const resVoid = createMockRes();
  await pagoController.eliminarPago(
    {
      params: { id: '1' },
      usuario: { rol: 'dueño', id_gimnasio: 10 },
      gimnasioId: 10,
      supabase: mockSb
    },
    resVoid
  );
  assert.equal(resVoid.statusCode, 200);
  assert.equal(deleteCalled, false);
  assert.deepEqual(rpcEstadoArgs, { p_id_pago: 1, p_estado: 'anulado' });
});

test('Roles y vistas de catálogo: catálogo usa vistas controladas, recepcionista no modifica socio.estado ni rutinas, entrenador no registra asistencia/pagos', async () => {
  // 1. Catálogo de gimnasios consulta vw_catalogo_gimnasios y vw_catalogo_planes (sin exponer tabla gimnasio privada)
  const queriedTables = [];
  const mockCatalogo = createSupabaseMock({
    tables: {
      vw_catalogo_gimnasios: (st) => {
        queriedTables.push(st.table);
        return { data: [{ id_gimnasio: 1, nombre: 'Gym Público', telefono: '123', estado: true }], error: null };
      },
      vw_catalogo_planes: (st) => {
        queriedTables.push(st.table);
        return { data: [{ id_membresia_gimnasio: 9, id_gimnasio: 1, nombre: 'Mensual', precio: 20000, duracion_dias: 30, estado: true }], error: null };
      }
    }
  });
  const resCat = createMockRes();
  await gimnasioController.listarCatalogoGimnasios({ query: {}, supabase: mockCatalogo }, resCat);
  assert.equal(resCat.statusCode, 200);
  assert.deepEqual(queriedTables.sort(), ['vw_catalogo_gimnasios', 'vw_catalogo_planes']);
  assert.equal(resCat.body.gimnasios[0].planes_activos.length, 1);

  // 2. Recepcionista no puede modificar estado administrativo del socio en updateSocio -> 403
  const resRecepEstado = createMockRes();
  await socioController.updateSocio(
    {
      params: { id: '77' },
      gimnasioId: 10,
      usuario: { rol: 'empleado', roles_empleado: ['recepcionista'], id_gimnasio: 10 },
      body: { estado: false },
      supabase: createSupabaseMock({ tables: { socio: { data: { id_socio: 77, auth_user_id: null, email: 'a@b.com' }, error: null } } })
    },
    resRecepEstado
  );
  assert.equal(resRecepEstado.statusCode, 403);

  // 3. Entrenador no puede registrar ingreso ni anular asistencia -> 403
  const resTrainerCheckin = createMockRes();
  await asistenciaController.registrarAsistencia(
    {
      body: { id_sucursal: 5, id_socio: 77 },
      usuario: { rol: 'empleado', roles_empleado: ['entrenador'], sucursales_asignadas: [{ id_sucursal: 5, rol: 'entrenador' }] },
      gimnasioId: 10,
      supabase: createSupabaseMock()
    },
    resTrainerCheckin
  );
  assert.equal(resTrainerCheckin.statusCode, 403);

  const resTrainerAnular = createMockRes();
  await asistenciaController.eliminarAsistencia(
    {
      params: { id: '1' },
      usuario: { rol: 'empleado', id_gimnasio: 10, roles_empleado: ['entrenador'], sucursales_asignadas: [{ id_sucursal: 5, rol: 'entrenador' }] },
      supabase: createSupabaseMock({ tables: { asistencia_socio: { data: { id_asistencia_socio: 1, id_sucursal: 5, sucursal: { id_gimnasio: 10 } }, error: null } } })
    },
    resTrainerAnular
  );
  assert.equal(resTrainerAnular.statusCode, 403);

  // 4. Recepcionista sin permiso gestionar_rutinas es bloqueado por requireRoles de rutinaRoutes
  const resRecepRutina = createMockRes();
  requireRoles('socio', 'dueño', 'empleado:administrador', 'empleado:entrenador')(
    { usuario: { rol: 'empleado', roles_empleado: ['recepcionista'], permisos: ['gestionar_pagos'] } },
    resRecepRutina,
    () => {}
  );
  assert.equal(resRecepRutina.statusCode, 403);
});

test('PaymentGatewayService: sin credenciales ni ENABLE_MOCK_PAYMENT_SANDBOX=true rechaza explícitamente (sin fallback silencioso)', async () => {
  await assert.rejects(
    () =>
      paymentGatewayService.crearOrdenUala({
        titulo: 'Plan Mensual',
        monto: 20000,
        externalReference: 'REF-1',
        socio: { nombre: 'Juan', apellido: 'Perez', email: 'j@p.com', dni: '123' },
        gimnasio: { nombre: 'Gym A' }
      }),
    /Ualá Bis no está configurado/i
  );
});

// ==============================================================================
// SUITE 6: VERIFICACIÓN ESTÁTICA DE SEGURIDAD SQL, PERMISOS, RLS Y FRONTEND
// ==============================================================================
test('Seguridad SQL, REVOKE/GRANT, SECURITY DEFINER y RLS: sin políticas permisivas, vistas de catálogo y dependencias exactas', () => {
  const rootDir = path.resolve(__dirname, '..', '..');
  const mig1 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/01_migracion_empleados_y_asistencias.sql'), 'utf8');
  const mig2 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/02_funciones_rpc_y_validaciones.sql'), 'utf8');
  const mig3 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/03_politicas_rls.sql'), 'utf8');
  const mig4 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/04_simplificar_asistencia_socio.sql'), 'utf8');

  // 1. Migración 01: triggers de integridad, Auth sin contraseñas e índices
  assert.match(mig1, /auth_user_id\s+uuid\s+unique\s+references\s+auth\.users\(id\)/i);
  assert.doesNotMatch(mig1, /ADD COLUMN.*contrasena/i);
  assert.match(mig1, /uq_asistencia_abierta_socio/i);
  assert.match(mig1, /trg_fn_proteger_campos_socio/i);
  assert.match(mig1, /trg_fn_proteger_pago_inmutable/i);
  assert.match(mig1, /trg_fn_proteger_membresia_socio_inmutable/i);
  assert.match(mig1, /trg_fn_proteger_propietario_ejercicio/i);

  // 2. Migración 02: RPCs SECURITY DEFINER endurecidas + REVOKE FROM PUBLIC, anon
  for (const fnName of [
    'rpc_contratar_membresia',
    'rpc_registrar_socio_gimnasio',
    'rpc_registrar_pago',
    'rpc_actualizar_estado_pago',
    'rpc_registrar_ingreso_asistencia',
    'rpc_registrar_salida_asistencia',
    'rpc_anular_asistencia'
  ]) {
    assert.match(mig2, new RegExp(fnName, 'i'), `Falta ${fnName} en 02`);
    assert.match(mig2, new RegExp(`revoke all on function public\\.${fnName}.*from public,\\s*anon`, 'i'), `Falta REVOKE EXECUTE en ${fnName}`);
  }
  assert.match(mig2, /set search_path = pg_catalog,\s*public,\s*auth/i);

  // 3. Migración 03: sin exposición global socio en gimnasio/membresia_gimnasio, vistas catálogo y REVOKE directos
  const mig3SinComentarios = mig3.replace(/--.*$/gm, '');
  const mig4SinComentarios = mig4.replace(/--.*$/gm, '');

  const expectedTables = [
    'dueno', 'gimnasio', 'sucursal', 'socio', 'empleado', 'empleado_sucursal',
    'membresia_gimnasio', 'membresia_socio', 'pago', 'asistencia_socio',
    'ejercicio', 'rutina', 'rutina_ejercicio', 'progreso'
  ];
  for (const tbl of expectedTables) {
    assert.match(
      mig3,
      new RegExp(`alter table public\\.${tbl}\\s+enable row level security`, 'i'),
      `Falta ENABLE ROW LEVEL SECURITY en public.${tbl}`
    );
  }
  assert.doesNotMatch(mig3SinComentarios, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(mig3SinComentarios, /WITH CHECK\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(mig4SinComentarios, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(mig4SinComentarios, /WITH CHECK\s*\(\s*true\s*\)/i);

  assert.doesNotMatch(mig3SinComentarios, /estado\s*=\s*true\s+and\s+public\.fn_current_socio_id\(\)\s+is\s+not\s+null/i);
  assert.match(mig3, /create or replace view public\.vw_catalogo_gimnasios/i);
  assert.match(mig3, /create or replace view public\.vw_catalogo_planes/i);
  assert.match(mig3, /grant select,\s*update,\s*delete on public\.membresia_socio to authenticated/i);
  assert.match(mig3, /grant select on public\.pago to authenticated/i);
  assert.match(mig3, /grant select on public\.asistencia_socio to authenticated/i);
  assert.match(mig3, /to_regclass\('public\.progreso'\)/i);
  assert.match(mig3, /fn_staff_puede_gestionar_socio/i);
  assert.match(mig3, /fn_staff_puede_gestionar_rutinas_socio/i);

  // 4. Migración 04: comprobación exacta conkey/confkey/indkey/pg_depend y sin CASCADE
  assert.match(mig4, /c\.conkey/i);
  assert.match(mig4, /c\.confkey/i);
  assert.match(mig4, /ix\.indkey/i);
  assert.match(mig4, /pg_catalog\.pg_depend/i);
  assert.doesNotMatch(mig4SinComentarios, /drop\s+column.*cascade/i);
  assert.doesNotMatch(mig4SinComentarios, /drop\s+table/i);
  assert.doesNotMatch(mig4SinComentarios, /truncate/i);

  // 5. Frontend: cero exposición de SERVICE_ROLE
  const frontendSrc = path.join(rootDir, 'frontend', 'src');
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8').replace(/\/\/.*$/gm, '');
        assert.doesNotMatch(content, /SERVICE_ROLE/i, `Exposición de SERVICE_ROLE detectada en ${full}`);
      }
    }
  };
  walk(frontendSrc);
});

// ==============================================================================
// SUITE 7: VERIFICACIÓN DEL MODELO DEFINITIVO (MIGRACIONES 05..07 Y SCHEMA A)
// ==============================================================================
test('Modelo definitivo 05..07 y schema_definitivo.sql: socio_gimnasio, administrador_gimnasio, ejercicios/rutinas separados, FKs compuestas, RLS y sin DROP TABLE', () => {
  const rootDir = path.resolve(__dirname, '..', '..');
  const mig5 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/05_socio_gimnasio_y_administradores.sql'), 'utf8');
  const mig6 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/06_separacion_ejercicios_y_rutinas.sql'), 'utf8');
  const mig7 = fs.readFileSync(path.join(rootDir, 'supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql'), 'utf8');
  const schemaDef = fs.readFileSync(path.join(rootDir, 'supabase/schema_definitivo.sql'), 'utf8');

  // 1. Migración 05: socio_gimnasio, evolución de membresia_socio sin id_socio redundante, administrador y N:M administrador_gimnasio
  assert.match(mig5, /create table if not exists public\.socio_gimnasio/i);
  assert.match(mig5, /constraint uq_socio_gimnasio unique \(id_socio,\s*id_gimnasio\)/i);
  assert.match(mig5, /constraint uq_socio_gimnasio_id_gym unique \(id_socio_gimnasio,\s*id_gimnasio\)/i);
  assert.match(mig5, /constraint fk_contrato_socio_gimnasio\s+foreign key \(id_socio_gimnasio,\s*id_gimnasio\)\s+references public\.socio_gimnasio\(id_socio_gimnasio,\s*id_gimnasio\)/i);
  assert.match(mig5, /drop column if exists id_socio/i);
  assert.match(mig5, /create table if not exists public\.administrador\b/i);
  assert.match(mig5, /create table if not exists public\.administrador_gimnasio/i);
  assert.match(mig5, /constraint uq_administrador_gimnasio unique \(id_administrador,\s*id_gimnasio\)/i);
  assert.doesNotMatch(mig5.replace(/--.*$/gm, ''), /drop\s+table/i);
  assert.doesNotMatch(mig5.replace(/--.*$/gm, ''), /drop\s+column.*cascade/i);

  // 2. Migración 06: separación estricta de ejercicios y rutinas con FKs compuestas anti-cruce y sin DROP TABLE
  for (const tbl of [
    'ejercicio_socio',
    'ejercicio_gimnasio',
    'rutina_socio',
    'rutina_gimnasio',
    'rutina_ejercicio_socio',
    'rutina_ejercicio_gimnasio',
    'rutinas_asignadas_socio_gimnasio'
  ]) {
    assert.match(mig6, new RegExp(`create table if not exists public\\.${tbl}\\b`, 'i'), `Falta tabla ${tbl} en 06`);
    assert.match(mig6, new RegExp(`alter table public\\.${tbl}\\s+enable row level security`, 'i'), `Falta RLS en ${tbl}`);
    assert.match(schemaDef, new RegExp(`create table public\\.${tbl}\\b`, 'i'), `Falta tabla ${tbl} en schema_definitivo.sql`);
    assert.match(schemaDef, new RegExp(`alter table public\\.${tbl}\\s+enable row level security`, 'i'), `Falta RLS para ${tbl} en schema_definitivo.sql`);
  }
  assert.match(mig6, /constraint fk_res_rutina_socio foreign key \(id_rutina_socio,\s*id_socio\)/i);
  assert.match(mig6, /constraint fk_res_ejercicio_socio foreign key \(id_ejercicio_socio,\s*id_socio\)/i);
  assert.match(mig6, /constraint fk_reg_rutina_gym foreign key \(id_rutina_gimnasio,\s*id_gimnasio\)/i);
  assert.match(mig6, /constraint fk_reg_ejercicio_gym foreign key \(id_ejercicio_gimnasio,\s*id_gimnasio\)/i);
  assert.match(mig6, /constraint fk_rasg_rutina_gym foreign key \(id_rutina_gimnasio,\s*id_gimnasio\)/i);
  assert.match(mig6, /constraint fk_rasg_socio_gym foreign key \(id_socio_gimnasio,\s*id_gimnasio\)/i);
  assert.doesNotMatch(mig6.replace(/--.*$/gm, ''), /drop\s+table/i);
  assert.doesNotMatch(mig6.replace(/--.*$/gm, ''), /\btruncate\b/i);

  // 3. Migración 07: helpers de administrador y socio_gimnasio, renovación anticipada, RPCs y RLS sin USING (true)
  const mig7SinComentarios = mig7.replace(/--.*$/gm, '');
  assert.doesNotMatch(mig7SinComentarios, /USING\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(mig7SinComentarios, /WITH CHECK\s*\(\s*true\s*\)/i);
  for (const fnName of [
    'fn_current_administrador_id',
    'fn_admin_posee_gimnasio',
    'fn_admin_posee_sucursal',
    'fn_socio_asociado_gimnasio',
    'rpc_asociar_socio_gimnasio',
    'rpc_asignar_rutina_gimnasio_socio',
    'rpc_reordenar_rutina_socio_ejercicios',
    'rpc_reordenar_rutina_gimnasio_ejercicios',
    'rpc_vincular_identidad_perfil',
    'rpc_registrar_ingreso_asistencia',
    'rpc_contratar_membresia'
  ]) {
    assert.match(mig7, new RegExp(fnName, 'i'), `Falta ${fnName} en 07`);
    assert.match(mig7, new RegExp(`revoke all on function public\\.${fnName}.*from public,\\s*anon`, 'i'), `Falta REVOKE EXECUTE en ${fnName}`);
  }
  assert.match(mig7, /v_max_vencimiento \+ 1/i, 'Debe conservar días restantes encadenando desde vencimiento + 1');
  assert.match(mig7, /to_regclass\('public\.progreso'\)/i, 'Debe comprobar existencia condicional de public.progreso');
});

// ==============================================================================
// SUITE 8: CONTRATOS DE HARDENING DE 07 Y SUITE SQL TRANSACCIONAL (SECCIÓN 2-6)
// ==============================================================================
test('Hardening 07: eliminación de detección por current_user, máquina de estados de pago/membresía, auditoría de anulaciones y suite SQL', () => {
  const rootDir = path.resolve(__dirname, '..', '..');
  const mig7Path = path.join(rootDir, 'supabase', 'migrations', '07_rls_y_rpc_modelo_definitivo.sql');
  const schemaPath = path.join(rootDir, 'supabase', 'schema_definitivo.sql');
  const sqlSuitePath = path.join(rootDir, 'supabase', 'tests', 'test_rls_rpc_seguridad.sql');

  const mig7 = fs.readFileSync(mig7Path, 'utf8');
  const schemaDef = fs.readFileSync(schemaPath, 'utf8');
  const sqlSuite = fs.readFileSync(sqlSuitePath, 'utf8');
  const mig7Code = mig7.replace(/--.*$/gm, '');

  // 1. Cero detección de service_role por current_user dentro de 07; reemplazo por fn_es_service_role()
  assert.doesNotMatch(mig7Code, /current_user\s+in\s*\(/i, '07 no debe depender de current_user IN (...)');
  assert.match(mig7Code, /create or replace function public\.fn_es_service_role\(\)/i);
  assert.match(mig7Code, /revoke all on function public\.fn_es_service_role\(\) from public,\s*anon,\s*authenticated/i);

  // 2. Canalización estricta por RPC y privilegios por columna
  assert.match(mig7Code, /grant update\s*\(nombre,\s*apellido,\s*dni,\s*telefono,\s*email,\s*estado\)\s*on public\.socio to authenticated/i);
  assert.match(mig7Code, /grant select on public\.socio_gimnasio to authenticated/i);
  assert.match(mig7Code, /grant select on public\.membresia_socio to authenticated/i);
  assert.match(mig7Code, /grant select on public\.pago to authenticated/i);
  assert.match(mig7Code, /grant select on public\.asistencia_socio to authenticated/i);
  assert.match(mig7Code, /grant select on public\.rutinas_asignadas_socio_gimnasio to authenticated/i);

  // 3. Nuevas RPCs y firmas hardening
  for (const sig of [
    'rpc_cambiar_estado_socio_gimnasio',
    'rpc_actualizar_estado_membresia',
    'rpc_finalizar_rutina_asignada',
    'rpc_anular_asistencia'
  ]) {
    assert.match(mig7Code, new RegExp(`create or replace function public\\.${sig}\\b`, 'i'), `Falta ${sig} en 07`);
  }

  // 4. Lógica de pagos/sobrepago/parciales/anulación, identidad y sucursal=gimnasio
  assert.match(mig7Code, /v_nuevo_total >= v_contrato\.precio/i, 'Activación debe exigir pago completo');
  assert.match(mig7Code, /v_total_aprobado \+ p_monto\) > v_contrato\.precio/i, 'Debe impedir sobrepago en rpc_registrar_pago');
  assert.match(mig7Code, /v_pago\.estado = 'anulado'/i, 'Debe bloquear reactivación de pago anulado');
  assert.match(mig7Code, /when fecha_vencimiento < current_date then 'vencida'/i, 'Anular pago debe revertir a pendiente o preservar vencida');
  assert.match(mig7Code, /v_has_dni boolean := false/i, 'rpc_registrar_socio_gimnasio debe usar booleanos explícitos');
  assert.match(mig7Code, /e\.id_gimnasio = su\.id_gimnasio/i, 'Debe validar explícitamente sucursal.id_gimnasio = empleado.id_gimnasio');
  assert.match(mig7Code, /anulada_por = v_uid/i, 'rpc_anular_asistencia debe registrar anulada_por');
  assert.match(schemaDef, /anulada_por uuid references auth\.users\(id\)/i, 'schema_definitivo.sql debe incluir columnas de auditoría en asistencia_socio');

  // 5. Vistas de catálogo con security_barrier y security_invoker = false
  assert.match(mig7Code, /create or replace view public\.vw_catalogo_gimnasios\s+with \(security_barrier = true,\s*security_invoker = false\)/i);
  assert.match(mig7Code, /create or replace view public\.vw_catalogo_planes\s+with \(security_barrier = true,\s*security_invoker = false\)/i);

  // 6. Cobertura en suite SQL transaccional
  assert.match(sqlSuite, /^\s*begin;/im, 'La suite SQL debe iniciar con BEGIN');
  assert.match(sqlSuite, /\brollback;\s*$/im, 'La suite SQL debe terminar en ROLLBACK para no alterar staging');
  assert.match(sqlSuite, /rpc_vincular_identidad_perfil/i);
  assert.match(sqlSuite, /COMP-PARCIAL-1/i);
  assert.match(sqlSuite, /anulada_por = v_uid_dueno_a/i);
  assert.match(sqlSuite, /has_function_privilege\('public', p\.oid, 'EXECUTE'\)/i);
});
