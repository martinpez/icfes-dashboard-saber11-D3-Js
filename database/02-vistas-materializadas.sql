-- =====================================================
-- VISTAS MATERIALIZADAS PARA DASHBOARD ICFES
-- Archivo: database/02-vistas-materializadas.sql
-- =====================================================

-- Vista para score-by-department (datos por año y departamento)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_departamento_anio AS
SELECT 
    LEFT(i."PERIODO"::varchar, 4) AS anio,
    i."COLE_DEPTO_UBICACION" AS departamento,
    ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
    COUNT(*) AS total_estudiantes,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_GLOBAL") AS mediana
FROM icfes i
WHERE i."PUNT_GLOBAL" IS NOT NULL 
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY LEFT(i."PERIODO"::varchar, 4), i."COLE_DEPTO_UBICACION"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dept_anio 
ON mv_departamento_anio (anio, departamento);

-- Vista para heatmap estrato-competencia (datos globales sin filtros)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_estrato_competencia AS
SELECT 
    i."FAMI_ESTRATOVIVIENDA" AS estrato,
    ROUND(AVG(i."PUNT_LECTURA_CRITICA")::numeric, 2) AS prom_lectura,
    ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2) AS prom_matematicas,
    ROUND(AVG(i."PUNT_C_NATURALES")::numeric, 2) AS prom_naturales,
    ROUND(AVG(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2) AS prom_sociales,
    ROUND(AVG(i."PUNT_INGLES")::numeric, 2) AS prom_ingles,
    COUNT(*) AS n
FROM icfes i
WHERE i."FAMI_ESTRATOVIVIENDA" IS NOT NULL 
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."FAMI_ESTRATOVIVIENDA"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_estrato 
ON mv_estrato_competencia (estrato);

-- Vista para timeseries-by-school-type
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_timeseries_naturaleza AS
SELECT 
    LEFT(i."PERIODO"::varchar, 4) AS anio,
    i."COLE_NATURALEZA" AS tipo_colegio,
    ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
    ROUND(STDDEV(i."PUNT_GLOBAL")::numeric, 2) AS desv_std,
    COUNT(*) AS total
FROM icfes i
WHERE i."COLE_NATURALEZA" IS NOT NULL 
  AND i."PUNT_GLOBAL" IS NOT NULL
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY LEFT(i."PERIODO"::varchar, 4), i."COLE_NATURALEZA"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_timeseries 
ON mv_timeseries_naturaleza (anio, tipo_colegio);

-- Vista para distribución por género (el query más costoso)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_distribucion_genero AS
SELECT 
    i."ESTU_GENERO" AS genero,
    'Matematicas' AS competencia,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2) AS p10,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2) AS q1,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2) AS mediana,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2) AS q3,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2) AS p90,
    ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2) AS media,
    ROUND(STDDEV(i."PUNT_MATEMATICAS")::numeric, 2) AS desv_std,
    COUNT(*) AS n
FROM icfes i
WHERE i."ESTU_GENERO" IN ('M', 'F')
  AND i."PUNT_MATEMATICAS" IS NOT NULL
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."ESTU_GENERO"
UNION ALL
SELECT 
    i."ESTU_GENERO" AS genero,
    'Lectura Critica' AS competencia,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(AVG(i."PUNT_LECTURA_CRITICA")::numeric, 2),
    ROUND(STDDEV(i."PUNT_LECTURA_CRITICA")::numeric, 2),
    COUNT(*)
FROM icfes i
WHERE i."ESTU_GENERO" IN ('M', 'F')
  AND i."PUNT_LECTURA_CRITICA" IS NOT NULL
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."ESTU_GENERO"
UNION ALL
SELECT 
    i."ESTU_GENERO" AS genero,
    'Ciencias Naturales' AS competencia,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(AVG(i."PUNT_C_NATURALES")::numeric, 2),
    ROUND(STDDEV(i."PUNT_C_NATURALES")::numeric, 2),
    COUNT(*)
FROM icfes i
WHERE i."ESTU_GENERO" IN ('M', 'F')
  AND i."PUNT_C_NATURALES" IS NOT NULL
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."ESTU_GENERO"
UNION ALL
SELECT 
    i."ESTU_GENERO" AS genero,
    'Sociales y Ciudadanas' AS competencia,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(AVG(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    ROUND(STDDEV(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2),
    COUNT(*)
FROM icfes i
WHERE i."ESTU_GENERO" IN ('M', 'F')
  AND i."PUNT_SOCIALES_CIUDADANAS" IS NOT NULL
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."ESTU_GENERO"
UNION ALL
SELECT 
    i."ESTU_GENERO" AS genero,
    'Ingles' AS competencia,
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY i."PUNT_INGLES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY i."PUNT_INGLES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY i."PUNT_INGLES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY i."PUNT_INGLES")::numeric, 2),
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY i."PUNT_INGLES")::numeric, 2),
    ROUND(AVG(i."PUNT_INGLES")::numeric, 2),
    ROUND(STDDEV(i."PUNT_INGLES")::numeric, 2),
    COUNT(*)
FROM icfes i
WHERE i."ESTU_GENERO" IN ('M', 'F')
  AND i."PUNT_INGLES" IS NOT NULL
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."ESTU_GENERO"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_distribucion_genero 
ON mv_distribucion_genero (competencia, genero);

-- Vista para NSE vs score
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_nse_score AS
SELECT 
    ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1) AS nse_bucket,
    i."COLE_NATURALEZA" AS tipo_colegio,
    ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
    COUNT(*) AS n_estudiantes
FROM icfes i
WHERE i."ESTU_INSE_INDIVIDUAL" IS NOT NULL 
  AND i."PUNT_GLOBAL" IS NOT NULL
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1), i."COLE_NATURALEZA"
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_mv_nse_score 
ON mv_nse_score (nse_bucket, tipo_colegio);

-- Vista para school ranking
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_school_ranking AS
SELECT 
    i."COLE_NOMBRE_ESTABLECIMIENTO" AS colegio,
    i."COLE_NATURALEZA" AS tipo,
    i."COLE_DEPTO_UBICACION" AS departamento,
    ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
    ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2) AS prom_matematicas,
    ROUND(AVG(i."PUNT_INGLES")::numeric, 2) AS prom_ingles,
    COUNT(*) AS total_alumnos
FROM icfes i
WHERE i."COLE_NOMBRE_ESTABLECIMIENTO" IS NOT NULL
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
GROUP BY i."COLE_NOMBRE_ESTABLECIMIENTO", i."COLE_NATURALEZA", i."COLE_DEPTO_UBICACION"
HAVING COUNT(*) >= 30
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_school_ranking 
ON mv_school_ranking (prom_global DESC);

-- =====================================================
-- INSTRUCCIONES DE USO:
-- =====================================================
-- Para ejecutar:
--   psql -h host -U usuario -d icfes -f 01-indices.sql
--   psql -h host -U usuario -d icfes -f 02-vistas-materializadas.sql
--
-- Para actualizar las vistas (recomendado: diarios o semanales):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_departamento_anio;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_timeseries_naturaleza;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_distribucion_genero;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_estrato_competencia;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_nse_score;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_school_ranking;
-- =====================================================