-- PostgreSQL initialization script
-- Runs once on first container start (docker-entrypoint-initdb.d)

-- Enable pgvector extension
-- Required for embedding storage and similarity search (EPIC 4.1+)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension was not created successfully';
  END IF;
END;
$$;
