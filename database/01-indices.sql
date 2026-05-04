-- =====================================================
-- INDICES OPTIMIZADOS PARA DASHBOARD ICFES
-- Archivo: database/01-indices.sql
-- =====================================================

-- Índice compuesto para filtros principales (el más importante)
CREATE INDEX IF NOT EXISTS idx_icfes_filtros_principales
ON icfes (PERIODO, ESTU_GENERO, COLE_NATURALEZA, COLE_DEPTO_UBICACION, PUNT_GLOBAL)
WHERE PUNT_GLOBAL IS NOT NULL
  AND ESTU_GENERO IN ('M', 'F')
  AND FAMI_ESTRATOVIVIENDA ~ '^Estrato [1-6]$';

-- Índice para columnas de puntajes (usadas en AVG y PERCENTILE_CONT)
CREATE INDEX IF NOT EXISTS idx_icfes_puntajes
ON icfes (PUNT_GLOBAL, PUNT_LECTURA_CRITICA, PUNT_MATEMATICAS, PUNT_C_NATURALES,
          PUNT_SOCIALES_CIUDADANAS, PUNT_INGLES)
WHERE PUNT_GLOBAL IS NOT NULL;

-- Índice para estrato (GROUP BY)
CREATE INDEX IF NOT EXISTS idx_icfes_estrato
ON icfes (FAMI_ESTRATOVIVIENDA)
WHERE FAMI_ESTRATOVIVIENDA ~ '^Estrato [1-6]$';

-- Índice para NSE (rangos)
CREATE INDEX IF NOT EXISTS idx_icfes_inse
ON icfes (ESTU_INSE_INDIVIDUAL)
WHERE ESTU_INSE_INDIVIDUAL IS NOT NULL;

-- Índice para colegios (ranking)
CREATE INDEX IF NOT EXISTS idx_icfes_colegio
ON icfes (COLE_NOMBRE_ESTABLECIMIENTO, COLE_NATURALEZA, COLE_DEPTO_UBICACION, PUNT_GLOBAL)
WHERE COLE_NOMBRE_ESTABLECIMIENTO IS NOT NULL
  AND PUNT_GLOBAL IS NOT NULL;

-- Índice para naturaleza + año (timeseries)
CREATE INDEX IF NOT EXISTS idx_icfes_anio_naturaleza
ON icfes ((LEFT(PERIODO::varchar, 4)), COLE_NATURALEZA, PUNT_GLOBAL)
WHERE PUNT_GLOBAL IS NOT NULL;

-- Índice para departamento + año (score-by-department)
CREATE INDEX IF NOT EXISTS idx_icfes_anio_depto
ON icfes ((LEFT(PERIODO::varchar, 4)), COLE_DEPTO_UBICACION, PUNT_GLOBAL)
WHERE PUNT_GLOBAL IS NOT NULL;

-- Extended statistics para mejor planeación
CREATE STATISTICS IF NOT EXISTS icfes_stats
ON PERIODO, ESTU_GENERO, COLE_NATURALEZA, COLE_DEPTO_UBICACION, FAMI_ESTRATOVIVIENDA
FROM icfes;

-- Actualizar estadísticas
ANALYZE icfes;