-- Rôle Postgres en lecture seule pour l'agent testeur (staging uniquement).
--
-- À exécuter UNE fois, en superuser, sur le pod de la base de staging:
--   kubectl --context staging -n mairie360-staging exec -i sts/staging-database -- \
--     psql -U postgres -d mairie_db_staging -v pw="'$(openssl rand -base64 24)'" -f - < sql/readonly-role.sql
-- puis reporter le mot de passe dans .env (QA_DB_PASSWORD).
--
-- Ce rôle lit aussi users.password (hash argon2) et sessions.token_hash; harness/db.mjs masque ces colonnes à l'affichage,
-- mais ne l'utiliser que sur un staging peuplé de données fictives.

CREATE ROLE qa_readonly LOGIN PASSWORD :pw NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE qa_readonly SET default_transaction_read_only = on;
ALTER ROLE qa_readonly SET statement_timeout = '10s';

GRANT CONNECT ON DATABASE mairie_db_staging TO qa_readonly;

DO $$
DECLARE s text;
BEGIN
  FOR s IN SELECT schema_name FROM information_schema.schemata
           WHERE schema_name NOT IN ('pg_catalog', 'information_schema') AND schema_name NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO qa_readonly', s);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO qa_readonly', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO qa_readonly', s);
  END LOOP;
END $$;
