-- ==============================================================================
-- MIGRACIÓN: Permitir a los socios ver en solo lectura las rutinas activas
--            de los gimnasios donde tienen asociación activa (`socio_gimnasio`).
-- ==============================================================================

begin;

drop policy if exists rutina_gimnasio_select_authorized on public.rutina_gimnasio;
create policy rutina_gimnasio_select_authorized on public.rutina_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
    or (estado = true and public.fn_socio_asociado_gimnasio(id_gimnasio, true))
    or exists (
      select 1
      from public.rutinas_asignadas_socio_gimnasio ra
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ra.id_socio_gimnasio
      where ra.id_rutina_gimnasio = rutina_gimnasio.id_rutina_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

drop policy if exists reg_select_authorized on public.rutina_ejercicio_gimnasio;
create policy reg_select_authorized on public.rutina_ejercicio_gimnasio
  for select to authenticated
  using (
    public.fn_dueno_posee_gimnasio(id_gimnasio)
    or public.fn_admin_posee_gimnasio(id_gimnasio)
    or public.fn_empleado_en_gimnasio(id_gimnasio, array['administrador', 'entrenador'])
    or (
      public.fn_socio_asociado_gimnasio(id_gimnasio, true)
      and exists (
        select 1
        from public.rutina_gimnasio rg
        where rg.id_rutina_gimnasio = rutina_ejercicio_gimnasio.id_rutina_gimnasio
          and rg.id_gimnasio = rutina_ejercicio_gimnasio.id_gimnasio
          and rg.estado = true
      )
    )
    or exists (
      select 1
      from public.rutinas_asignadas_socio_gimnasio ra
      join public.socio_gimnasio sg on sg.id_socio_gimnasio = ra.id_socio_gimnasio
      where ra.id_rutina_gimnasio = rutina_ejercicio_gimnasio.id_rutina_gimnasio
        and sg.id_socio = public.fn_current_socio_id()
    )
  );

commit;
