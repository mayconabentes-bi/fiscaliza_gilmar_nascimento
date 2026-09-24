-- REVIEW ONLY: intended for isolated homologation (never production without separate approval).
-- Execute as postgres/table owner. Keep public.usuarios RLS enabled.
-- Application and QA role MUST NOT receive direct privileges on public.usuarios.
BEGIN;

CREATE OR REPLACE FUNCTION public.fiscalize_qa_lookup_citizen(p_email text)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
BEGIN
  IF p_email IS NULL OR p_email !~ '^fiscalize-qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@example[.]invalid$' THEN
    RAISE EXCEPTION 'QA_IDENTITY_REJECTED';
  END IF;
  RETURN QUERY
  SELECT u.id, u.status::text
    FROM public.usuarios AS u
   WHERE u.email = p_email
     AND u.nome_completo = 'FISCALIZE QA AUTOMATIZADO';
END;
$func$;

CREATE OR REPLACE FUNCTION public.fiscalize_qa_delete_citizen(p_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE affected integer;
BEGIN
  -- Registration generates a citizen ID independently of the UUID in the QA email.
  IF p_id IS NULL OR p_email IS NULL
    OR p_email !~ '^fiscalize-qa-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@example[.]invalid$' THEN
    RAISE EXCEPTION 'QA_IDENTITY_REJECTED';
  END IF;
  PERFORM 1
    FROM public.usuarios AS u
   WHERE u.id = p_id
     AND u.email = p_email
     AND u.nome_completo = 'FISCALIZE QA AUTOMATIZADO'
     AND u.created_at >= pg_catalog.now() - interval '1 hour'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  -- Explicitly refuse deletion whenever the candidate owns related records.
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
  DELETE FROM public.usuarios AS u
   WHERE u.id = p_id
     AND u.email = p_email
     AND u.nome_completo = 'FISCALIZE QA AUTOMATIZADO'
     AND u.created_at >= pg_catalog.now() - interval '1 hour';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$func$;

-- Revoke in the same transaction so no unprivileged role receives transient access.
REVOKE ALL ON FUNCTION public.fiscalize_qa_lookup_citizen(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscalize_qa_delete_citizen(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscalize_qa_lookup_citizen(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fiscalize_qa_delete_citizen(uuid,text) FROM anon, authenticated;
-- A dedicated QA role will be separately created/reviewed; no grants in this file.
COMMIT;
