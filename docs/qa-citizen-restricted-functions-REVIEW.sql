-- REVIEW ONLY. DO NOT EXECUTE ON PRODUCTION WITHOUT SEPARATE APPROVAL.
-- Run as table owner postgres; do not disable RLS.
-- QA role creation/credential issuance is deliberately excluded.
BEGIN;
CREATE OR REPLACE FUNCTION public.fiscalize_qa_lookup_citizen(p_email text)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_email IS NULL OR p_email !~ '^fiscalize-qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@example\\.invalid$' THEN
    RAISE EXCEPTION 'QA_IDENTITY_REJECTED';
  END IF;
  RETURN QUERY SELECT u.id, u.status::text FROM public.usuarios u WHERE u.email = p_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.fiscalize_qa_delete_citizen(p_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE affected integer;
BEGIN
  IF p_id IS NULL OR p_email IS NULL
     OR p_email <> ('fiscalize-qa-' || p_id::text || '@example.invalid') THEN
    RAISE EXCEPTION 'QA_IDENTITY_REJECTED';
  END IF;
  -- Serialize concurrent QA deletion and changes to the target account.
  PERFORM 1 FROM public.usuarios u WHERE u.id = p_id AND u.email = p_email FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.agradecimentos_propostas WHERE usuario_id = p_id)
    OR EXISTS (SELECT 1 FROM public.apoios_qualificados WHERE autor_id = p_id)
    OR EXISTS (SELECT 1 FROM public.comentarios_tecnicos WHERE autor_id = p_id)
    OR EXISTS (SELECT 1 FROM public.demandas WHERE usuario_id = p_id)
    OR EXISTS (SELECT 1 FROM public.denuncias WHERE usuario_denunciante_id = p_id)
    OR EXISTS (SELECT 1 FROM public.propostas_civicas WHERE autor_id = p_id)
    OR EXISTS (SELECT 1 FROM public.publicacoes WHERE usuario_id = p_id)
  THEN
    RAISE EXCEPTION 'QA_ACCOUNT_HAS_DEPENDENCIES';
  END IF;
  DELETE FROM public.usuarios u WHERE u.id = p_id AND u.email = p_email;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;
-- Functions are PUBLIC-executable by default unless revoked.
REVOKE ALL ON FUNCTION public.fiscalize_qa_lookup_citizen(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscalize_qa_delete_citizen(uuid,text) FROM PUBLIC;
-- Later, after explicit approval, grant EXECUTE to a dedicated NOINHERIT LOGIN role.
COMMIT;
