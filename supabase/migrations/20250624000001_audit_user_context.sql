-- Helper RPC para atribución de usuario en fn_audit_trigger cuando no hay auth.uid()
CREATE OR REPLACE FUNCTION set_audit_user_context(p_user_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    PERFORM set_config('app.current_user_id', '', true);
  ELSE
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_audit_user_context(UUID) TO authenticated, service_role;
