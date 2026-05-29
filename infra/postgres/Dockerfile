FROM pgvector/pgvector:pg17

# Keep schema file inside the image so Coolify does not depend on host bind paths.
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
COPY init.sql /schema/init.sql