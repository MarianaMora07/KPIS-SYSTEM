-- RLS action_plan_items — alineado con action_plans (HU-KPI-009)
-- El plan padre podía insertarse; los ítems fallaban sin política INSERT/UPDATE coherente.

ALTER TABLE action_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_plan_items_select ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_insert ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_update ON action_plan_items;
DROP POLICY IF EXISTS action_plan_items_delete ON action_plan_items;

-- Lectura: si puede ver el plan padre, puede ver sus ítems
CREATE POLICY action_plan_items_select ON action_plan_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM action_plans ap
      WHERE ap.id = action_plan_items.action_plan_id
    )
  );

-- Escritura: mismos roles que action_plans_insert (admin, directores, gerente)
CREATE POLICY action_plan_items_insert ON action_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

CREATE POLICY action_plan_items_update ON action_plan_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

CREATE POLICY action_plan_items_delete ON action_plan_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );

-- Eliminar plan completo (ítems en cascada por FK)
DROP POLICY IF EXISTS action_plans_delete ON action_plans;
CREATE POLICY action_plans_delete ON action_plans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.rol IN (
          'administrador',
          'director_comercial',
          'director_mercadeo',
          'gerente_hotel'
        )
    )
  );
