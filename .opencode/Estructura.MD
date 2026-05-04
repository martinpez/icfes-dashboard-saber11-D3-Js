# ICFES Dashboard — Documentación de Consultas

## Contexto del Proyecto

| Campo    | Detalle                                        |
|----------|------------------------------------------------|
| Dataset  | Resultados Saber 11 — ICFES Colombia           |
| Período  | 2018 – 2021                                    |
| Volumen  | ~1.6 millones de registros, 84 columnas        |
| Tabla SQL | `icfes`                                       |
| Motor    | PostgreSQL 14+ (Aurora)                        |

---

## Esquema de Columnas Relevantes

```sql
-- Identificación del estudiante
"ESTU_CONSECUTIVO"            TEXT       -- ID único del estudiante
"ESTU_GENERO"                 TEXT       -- 'M' | 'F'
"PERIODO"                     INTEGER    -- Formato YYYYS (ej: 20181 = primer semestre 2018)

-- Familia y contexto socioeconómico
"FAMI_ESTRATOVIVIENDA"        TEXT       -- 'Estrato 1' ... 'Estrato 6'
"ESTU_INSE_INDIVIDUAL"        FLOAT8     -- Índice NSE individual (valor continuo)
"ESTU_NSE_INDIVIDUAL"         TEXT       -- 'NSE1' | 'NSE2' | 'NSE3' | 'NSE4'

-- Colegio
"COLE_NOMBRE_ESTABLECIMIENTO" TEXT       -- Nombre del colegio
"COLE_NATURALEZA"             TEXT       -- 'OFICIAL' | 'NO OFICIAL'
"COLE_AREA_UBICACION"         TEXT       -- 'URBANO' | 'RURAL'
"COLE_DEPTO_UBICACION"        TEXT       -- Departamento (ej: 'BOGOTA', 'ANTIOQUIA')
"COLE_MCPIO_UBICACION"        TEXT       -- Municipio del colegio
"COLE_JORNADA"                TEXT       -- 'MANANA' | 'TARDE' | 'NOCHE' | 'UNICA' | 'SABATINA'

-- Puntajes por competencia (rango 0–100 cada uno)
"PUNT_LECTURA_CRITICA"        FLOAT8
"PUNT_MATEMATICAS"            FLOAT8
"PUNT_C_NATURALES"            FLOAT8
"PUNT_SOCIALES_CIUDADANAS"    FLOAT8
"PUNT_INGLES"                 FLOAT8
"PUNT_GLOBAL"                 FLOAT8     -- Puntaje global agregado (0–500)

-- Percentiles
"PERCENTIL_LECTURA_CRITICA"      FLOAT8
"PERCENTIL_MATEMATICAS"          FLOAT8
"PERCENTIL_C_NATURALES"          FLOAT8
"PERCENTIL_SOCIALES_CIUDADANAS"  FLOAT8
"PERCENTIL_INGLES"               FLOAT8
"PERCENTIL_GLOBAL"               FLOAT8
```

> **Importante:** todas las columnas fueron creadas con comillas dobles en PostgreSQL y son sensibles a mayúsculas. Siempre deben referenciarse como `i."NOMBRE_COLUMNA"`. Los puntajes son `FLOAT8` (double precision), por lo que todas las funciones `ROUND` requieren el cast `::numeric`.

---

## Filtros Globales

5 filtros reutilizables que aplican a todas las consultas. Se reciben como query params.

| Parámetro URL  | Columna SQL                          | Match   | Valores posibles                      |
|----------------|--------------------------------------|---------|---------------------------------------|
| `?anio=`       | `LEFT(i."PERIODO"::varchar, 4)`      | Exacto  | `2018`, `2019`, `2020`, `2021`        |
| `?genero=`     | `i."ESTU_GENERO"`                    | Exacto  | `M`, `F`                              |
| `?estrato=`    | `i."FAMI_ESTRATOVIVIENDA"`           | `ILIKE` | `Estrato 1` … `Estrato 6`            |
| `?naturaleza=` | `i."COLE_NATURALEZA"`                | Exacto  | `OFICIAL`, `NO OFICIAL`               |
| `?depto=`      | `i."COLE_DEPTO_UBICACION"`           | Exacto  | `BOGOTA`, `ANTIOQUIA`, `ATLANTICO`…  |

### Convención de filtros opcionales (prepared statement)

Los 5 parámetros `$1`–`$5` se pasan en orden fijo. Un valor `NULL` significa "sin restricción":

```sql
WHERE
  ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"           = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"  ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"       = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"  = $5)
```

### Filtro de calidad de datos (aplicar en todas las consultas)

```sql
AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
AND i."ESTU_GENERO" IN ('M', 'F')
AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
```

> **Nota sobre PERIODO:** formato `YYYYS` — `20181` = primer semestre 2018, `20182` = segundo semestre 2018. Siempre extraer el año con `LEFT(i."PERIODO"::varchar, 4)`.

---

## Resumen de Gráficas

| # | Nombre | Tipo de gráfica | Endpoint |
|---|--------|-----------------|----------|
| 1 | Puntaje Global Promedio por Departamento | **Mapa coroplético** (choropleth) | `GET /api/v1/charts/score-by-department` |
| 2 | Desigualdad por Competencia y Estrato | **Heatmap** (matriz de calor) | `GET /api/v1/charts/heatmap-estrato-competencia` |
| 3 | Evolución del Puntaje por Tipo de Colegio | Serie de tiempo (líneas + banda) | `GET /api/v1/charts/timeseries-by-school-type` |
| 4 | Distribución de Puntajes por Género | Boxplot agrupado | `GET /api/v1/charts/score-distribution-by-gender` |
| 5 | Correlación NSE vs. Puntaje Global | Scatter plot (burbujas) | `GET /api/v1/charts/nse-vs-score` |
| 6 | Ranking de Colegios por Puntaje Promedio | Barras horizontales | `GET /api/v1/charts/school-ranking` |

---

## Consultas por Gráfica

---

### Gráfica 1 — Puntaje Global Promedio por Departamento

**Tipo:** Mapa coroplético (choropleth) de Colombia  
**Endpoint:** `GET /api/v1/charts/score-by-department`  
**Columnas usadas:** `"COLE_DEPTO_UBICACION"`, `"PERIODO"`, `"PUNT_GLOBAL"`

**Propósito:** Calcula el promedio del puntaje global por departamento y año. El resultado se pinta sobre el mapa político de Colombia usando GeoJSON del DANE, donde cada departamento toma un color según su promedio. Permite identificar brechas territoriales de un vistazo.

```sql
SELECT
  i."COLE_DEPTO_UBICACION"                         AS departamento,
  LEFT(i."PERIODO"::varchar, 4)                    AS anio,
  ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2)          AS prom_global,
  COUNT(*)                                          AS total_estudiantes
FROM icfes i
WHERE
  i."PUNT_GLOBAL" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY
  i."COLE_DEPTO_UBICACION",
  LEFT(i."PERIODO"::varchar, 4)
ORDER BY prom_global DESC
LIMIT 400000;
```

**Campos retornados:**

| Campo               | Tipo    | Descripción                                   |
|---------------------|---------|-----------------------------------------------|
| `departamento`      | TEXT    | Nombre del departamento (clave JOIN al GeoJSON) |
| `anio`              | TEXT    | Año extraído del período                      |
| `prom_global`       | NUMERIC | Promedio del puntaje global (0–500)           |
| `total_estudiantes` | BIGINT  | Número de registros en ese departamento/año   |

**Nota de implementación:** el campo `departamento` debe hacer JOIN con la propiedad `NOMBRE_DPT` del GeoJSON de departamentos del DANE. La escala de color va de rojo (bajo) a verde (alto), centrada en la media nacional calculada en el cliente a partir de los datos recibidos.

---

### Gráfica 2 — Desigualdad por Competencia y Estrato Socioeconómico

**Tipo:** Heatmap — matriz de calor (filas = estratos, columnas = competencias)  
**Endpoint:** `GET /api/v1/charts/heatmap-estrato-competencia`  
**Columnas usadas:** `"FAMI_ESTRATOVIVIENDA"`, `"PUNT_LECTURA_CRITICA"`, `"PUNT_MATEMATICAS"`, `"PUNT_C_NATURALES"`, `"PUNT_SOCIALES_CIUDADANAS"`, `"PUNT_INGLES"`

**Propósito:** Genera una matriz de 6×5 (estratos × competencias) donde cada celda contiene el promedio de esa prueba para ese estrato. El gradiente de color por columna revela qué competencia amplifica más la desigualdad socioeconómica.

```sql
SELECT
  i."FAMI_ESTRATOVIVIENDA"                                AS estrato,
  ROUND(AVG(i."PUNT_LECTURA_CRITICA")::numeric, 2)        AS prom_lectura,
  ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2)            AS prom_matematicas,
  ROUND(AVG(i."PUNT_C_NATURALES")::numeric, 2)            AS prom_naturales,
  ROUND(AVG(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)    AS prom_sociales,
  ROUND(AVG(i."PUNT_INGLES")::numeric, 2)                 AS prom_ingles,
  COUNT(*)                                                 AS n
FROM icfes i
WHERE
  i."FAMI_ESTRATOVIVIENDA" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."FAMI_ESTRATOVIVIENDA"
ORDER BY i."FAMI_ESTRATOVIVIENDA"
LIMIT 400000;
```

**Campos retornados:**

| Campo              | Tipo    | Descripción                                         |
|--------------------|---------|-----------------------------------------------------|
| `estrato`          | TEXT    | Estrato socioeconómico (`Estrato 1`–`Estrato 6`)    |
| `prom_lectura`     | NUMERIC | Promedio Lectura Crítica                            |
| `prom_matematicas` | NUMERIC | Promedio Matemáticas                                |
| `prom_naturales`   | NUMERIC | Promedio Ciencias Naturales                         |
| `prom_sociales`    | NUMERIC | Promedio Sociales y Ciudadanas                      |
| `prom_ingles`      | NUMERIC | Promedio Inglés                                     |
| `n`                | BIGINT  | Total de estudiantes en ese estrato                 |

**Nota de implementación:** normalizar la escala de color por columna (competencia), no sobre toda la matriz, para que el gradiente refleje la desigualdad intra-competencia. Mostrar el valor numérico dentro de cada celda. El tooltip debe incluir `n`.

---

### Gráfica 3 — Evolución del Puntaje Global por Tipo de Colegio (2018–2021)

**Tipo:** Serie de tiempo — dos líneas con banda de confianza  
**Endpoint:** `GET /api/v1/charts/timeseries-by-school-type`  
**Columnas usadas:** `"PERIODO"`, `"COLE_NATURALEZA"`, `"PUNT_GLOBAL"`

**Propósito:** Traza la trayectoria temporal del puntaje promedio separando colegios oficiales y no oficiales, incluyendo desviación estándar para visualizar bandas de confianza. Permite detectar el impacto diferencial de la pandemia en 2020.

```sql
SELECT
  LEFT(i."PERIODO"::varchar, 4)                    AS anio,
  i."COLE_NATURALEZA"                              AS tipo_colegio,
  ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2)          AS prom_global,
  ROUND(STDDEV(i."PUNT_GLOBAL")::numeric, 2)       AS desv_std,
  COUNT(*)                                          AS total
FROM icfes i
WHERE
  i."COLE_NATURALEZA" IS NOT NULL
  AND i."PUNT_GLOBAL" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY
  LEFT(i."PERIODO"::varchar, 4),
  i."COLE_NATURALEZA"
ORDER BY anio, tipo_colegio
LIMIT 400000;
```

**Campos retornados:**

| Campo        | Tipo    | Descripción                                                       |
|--------------|---------|-------------------------------------------------------------------|
| `anio`       | TEXT    | Año (2018–2021)                                                   |
| `tipo_colegio` | TEXT  | `OFICIAL` o `NO OFICIAL`                                          |
| `prom_global` | NUMERIC | Promedio del puntaje global                                      |
| `desv_std`   | NUMERIC | Desviación estándar — banda: `prom_global ± desv_std`            |
| `total`      | BIGINT  | Total de estudiantes en ese grupo/año                             |

---

### Gráfica 4 — Distribución Estadística de Puntajes por Género y Competencia

**Tipo:** Boxplot agrupado por competencia  
**Endpoint:** `GET /api/v1/charts/score-distribution-by-gender`  
**Columnas usadas:** `"ESTU_GENERO"`, `"PUNT_MATEMATICAS"`, `"PUNT_LECTURA_CRITICA"`, `"PUNT_C_NATURALES"`, `"PUNT_SOCIALES_CIUDADANAS"`, `"PUNT_INGLES"`

**Propósito:** Calcula los cuantiles (P10, Q1, mediana, Q3, P90), media y desviación estándar de cada competencia desglosados por género para construir boxplots y detectar brechas estadísticamente significativas.

```sql
SELECT
  i."ESTU_GENERO"                                                          AS genero,
  'Matemáticas'                                                             AS competencia,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP
        (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2)                        AS p10,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2)                        AS q1,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2)                        AS mediana,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2)                        AS q3,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY i."PUNT_MATEMATICAS")::numeric, 2)                        AS p90,
  ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2)                              AS media,
  ROUND(STDDEV(i."PUNT_MATEMATICAS")::numeric, 2)                           AS desv_std,
  COUNT(*)                                                                   AS n
FROM icfes i
WHERE
  i."ESTU_GENERO" IS NOT NULL
  AND i."PUNT_MATEMATICAS" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."ESTU_GENERO"

UNION ALL

SELECT
  i."ESTU_GENERO"                                                          AS genero,
  'Lectura Crítica'                                                         AS competencia,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP
        (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2)                    AS p10,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2)                    AS q1,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2)                    AS mediana,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2)                    AS q3,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY i."PUNT_LECTURA_CRITICA")::numeric, 2)                    AS p90,
  ROUND(AVG(i."PUNT_LECTURA_CRITICA")::numeric, 2)                          AS media,
  ROUND(STDDEV(i."PUNT_LECTURA_CRITICA")::numeric, 2)                       AS desv_std,
  COUNT(*)                                                                   AS n
FROM icfes i
WHERE
  i."ESTU_GENERO" IS NOT NULL
  AND i."PUNT_LECTURA_CRITICA" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."ESTU_GENERO"

UNION ALL

SELECT
  i."ESTU_GENERO"                                                          AS genero,
  'Ciencias Naturales'                                                      AS competencia,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP
        (ORDER BY i."PUNT_C_NATURALES")::numeric, 2)                        AS p10,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY i."PUNT_C_NATURALES")::numeric, 2)                        AS q1,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY i."PUNT_C_NATURALES")::numeric, 2)                        AS mediana,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY i."PUNT_C_NATURALES")::numeric, 2)                        AS q3,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY i."PUNT_C_NATURALES")::numeric, 2)                        AS p90,
  ROUND(AVG(i."PUNT_C_NATURALES")::numeric, 2)                              AS media,
  ROUND(STDDEV(i."PUNT_C_NATURALES")::numeric, 2)                           AS desv_std,
  COUNT(*)                                                                   AS n
FROM icfes i
WHERE
  i."ESTU_GENERO" IS NOT NULL
  AND i."PUNT_C_NATURALES" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."ESTU_GENERO"

UNION ALL

SELECT
  i."ESTU_GENERO"                                                          AS genero,
  'Sociales y Ciudadanas'                                                   AS competencia,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP
        (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                AS p10,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                AS q1,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                AS mediana,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                AS q3,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                AS p90,
  ROUND(AVG(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                      AS media,
  ROUND(STDDEV(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2)                   AS desv_std,
  COUNT(*)                                                                   AS n
FROM icfes i
WHERE
  i."ESTU_GENERO" IS NOT NULL
  AND i."PUNT_SOCIALES_CIUDADANAS" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."ESTU_GENERO"

UNION ALL

SELECT
  i."ESTU_GENERO"                                                          AS genero,
  'Inglés'                                                                  AS competencia,
  ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP
        (ORDER BY i."PUNT_INGLES")::numeric, 2)                             AS p10,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP
        (ORDER BY i."PUNT_INGLES")::numeric, 2)                             AS q1,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP
        (ORDER BY i."PUNT_INGLES")::numeric, 2)                             AS mediana,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP
        (ORDER BY i."PUNT_INGLES")::numeric, 2)                             AS q3,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP
        (ORDER BY i."PUNT_INGLES")::numeric, 2)                             AS p90,
  ROUND(AVG(i."PUNT_INGLES")::numeric, 2)                                   AS media,
  ROUND(STDDEV(i."PUNT_INGLES")::numeric, 2)                                AS desv_std,
  COUNT(*)                                                                   AS n
FROM icfes i
WHERE
  i."ESTU_GENERO" IS NOT NULL
  AND i."PUNT_INGLES" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY i."ESTU_GENERO"

ORDER BY competencia, genero
LIMIT 400000;
```

**Campos retornados por fila:**

| Campo        | Tipo    | Descripción                              |
|--------------|---------|------------------------------------------|
| `genero`     | TEXT    | `M` o `F`                               |
| `competencia`| TEXT    | Nombre de la prueba                      |
| `p10`        | NUMERIC | Percentil 10 (bigote inferior)           |
| `q1`         | NUMERIC | Percentil 25 (borde inferior de la caja) |
| `mediana`    | NUMERIC | Percentil 50                             |
| `q3`         | NUMERIC | Percentil 75 (borde superior de la caja) |
| `p90`        | NUMERIC | Percentil 90 (bigote superior)           |
| `media`      | NUMERIC | Media aritmética                         |
| `desv_std`   | NUMERIC | Desviación estándar                      |
| `n`          | BIGINT  | Total de estudiantes                     |

---

### Gráfica 5 — Correlación entre Índice NSE y Puntaje Global

**Tipo:** Scatter plot — burbujas agregadas con regresión lineal  
**Endpoint:** `GET /api/v1/charts/nse-vs-score`  
**Columnas usadas:** `"ESTU_INSE_INDIVIDUAL"`, `"PUNT_GLOBAL"`, `"COLE_NATURALEZA"`

**Propósito:** Agrupa los registros por nivel NSE (redondeado a 1 decimal) y tipo de colegio para construir un scatter de burbujas. Cuantifica cuánto "compra" cada punto de NSE en puntaje global mediante regresión lineal calculada en el cliente.

```sql
SELECT
  ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1)      AS nse_bucket,
  i."COLE_NATURALEZA"                               AS tipo_colegio,
  ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2)           AS prom_global,
  COUNT(*)                                           AS n_estudiantes
FROM icfes i
WHERE
  i."ESTU_INSE_INDIVIDUAL" IS NOT NULL
  AND i."PUNT_GLOBAL" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY
  ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1),
  i."COLE_NATURALEZA"
ORDER BY nse_bucket
LIMIT 400000;
```

**Campos retornados:**

| Campo           | Tipo    | Descripción                                             |
|-----------------|---------|---------------------------------------------------------|
| `nse_bucket`    | NUMERIC | Valor NSE redondeado a 1 decimal (rango ~40–75)         |
| `tipo_colegio`  | TEXT    | `OFICIAL` o `NO OFICIAL`                               |
| `prom_global`   | NUMERIC | Promedio del puntaje global en ese bucket               |
| `n_estudiantes` | BIGINT  | Número de estudiantes (determina tamaño de burbuja)     |

---

### Gráfica 6 — Ranking de Colegios por Puntaje Promedio

**Tipo:** Barras horizontales — top 20 paginado  
**Endpoint:** `GET /api/v1/charts/school-ranking`  
**Columnas usadas:** `"COLE_NOMBRE_ESTABLECIMIENTO"`, `"COLE_NATURALEZA"`, `"COLE_DEPTO_UBICACION"`, `"PUNT_GLOBAL"`, `"PUNT_MATEMATICAS"`, `"PUNT_INGLES"`

**Propósito:** Clasifica los colegios por su puntaje global promedio. El filtro `HAVING COUNT(*) >= 30` excluye establecimientos con pocos registros para evitar outliers estadísticos.

```sql
SELECT
  i."COLE_NOMBRE_ESTABLECIMIENTO"                   AS colegio,
  i."COLE_NATURALEZA"                               AS tipo,
  i."COLE_DEPTO_UBICACION"                          AS departamento,
  ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2)           AS prom_global,
  ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2)      AS prom_matematicas,
  ROUND(AVG(i."PUNT_INGLES")::numeric, 2)           AS prom_ingles,
  COUNT(*)                                           AS total_alumnos
FROM icfes i
WHERE
  i."COLE_NOMBRE_ESTABLECIMIENTO" IS NOT NULL
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
  AND ($1::text IS NULL OR LEFT(i."PERIODO"::varchar, 4) = $1)
  AND ($2::text IS NULL OR i."ESTU_GENERO"               = $2)
  AND ($3::text IS NULL OR i."FAMI_ESTRATOVIVIENDA"      ILIKE $3)
  AND ($4::text IS NULL OR i."COLE_NATURALEZA"           = $4)
  AND ($5::text IS NULL OR i."COLE_DEPTO_UBICACION"      = $5)
GROUP BY
  i."COLE_NOMBRE_ESTABLECIMIENTO",
  i."COLE_NATURALEZA",
  i."COLE_DEPTO_UBICACION"
HAVING COUNT(*) >= 30
ORDER BY prom_global DESC
LIMIT 400000;
```

**Campos retornados:**

| Campo              | Tipo    | Descripción                                            |
|--------------------|---------|--------------------------------------------------------|
| `colegio`          | TEXT    | Nombre del establecimiento                             |
| `tipo`             | TEXT    | `OFICIAL` o `NO OFICIAL`                              |
| `departamento`     | TEXT    | Departamento donde se ubica                            |
| `prom_global`      | NUMERIC | Promedio puntaje global (barra principal)              |
| `prom_matematicas` | NUMERIC | Promedio Matemáticas (marcador secundario)             |
| `prom_ingles`      | NUMERIC | Promedio Inglés (marcador secundario)                  |
| `total_alumnos`    | BIGINT  | Total de presentaciones registradas (mínimo 30)        |

---

## Índices PostgreSQL

```sql
-- Cubre el 80% de las consultas (filtros más combinados)
CREATE INDEX idx_icfes_filtros_principales
  ON icfes ("COLE_DEPTO_UBICACION", "COLE_NATURALEZA", "ESTU_GENERO")
  WHERE "PUNT_GLOBAL" IS NOT NULL;

-- Extracción de año desde periodo (usado en todas las queries)
CREATE INDEX idx_icfes_anio
  ON icfes (LEFT("PERIODO"::varchar, 4));

-- Filtro por estrato
CREATE INDEX idx_icfes_estrato
  ON icfes ("FAMI_ESTRATOVIVIENDA");

-- Scatter NSE
CREATE INDEX idx_icfes_nse
  ON icfes ("ESTU_INSE_INDIVIDUAL")
  WHERE "ESTU_INSE_INDIVIDUAL" IS NOT NULL;

-- Ranking de colegios
CREATE INDEX idx_icfes_colegio
  ON icfes ("COLE_NOMBRE_ESTABLECIMIENTO", "COLE_DEPTO_UBICACION");

-- Puntaje global
CREATE INDEX idx_icfes_punt_global
  ON icfes ("PUNT_GLOBAL")
  WHERE "PUNT_GLOBAL" IS NOT NULL;

-- Serie de tiempo
CREATE INDEX idx_icfes_periodo_naturaleza
  ON icfes ("PERIODO", "COLE_NATURALEZA");
```

## Vista Materializada (optimización avanzada)

Pre-agrega los datos más consultados. Actualizar con cron diario.

```sql
CREATE MATERIALIZED VIEW mv_icfes_resumen AS
SELECT
  i."COLE_DEPTO_UBICACION",
  LEFT(i."PERIODO"::varchar, 4)                  AS anio,
  i."COLE_NATURALEZA",
  i."ESTU_GENERO",
  i."FAMI_ESTRATOVIVIENDA",
  ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2)        AS prom_global,
  ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2)   AS prom_matematicas,
  ROUND(AVG(i."PUNT_INGLES")::numeric, 2)        AS prom_ingles,
  COUNT(*)                                        AS n
FROM icfes i
WHERE i."PUNT_GLOBAL" IS NOT NULL
GROUP BY
  i."COLE_DEPTO_UBICACION",
  LEFT(i."PERIODO"::varchar, 4),
  i."COLE_NATURALEZA",
  i."ESTU_GENERO",
  i."FAMI_ESTRATOVIVIENDA";

CREATE INDEX idx_mv_depto ON mv_icfes_resumen ("COLE_DEPTO_UBICACION", anio);

-- Actualizar sin bloquear lecturas
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_icfes_resumen;
```

---

## Contrato de API

Todos los endpoints retornan la misma estructura:

```json
{
  "data": [ ...filas de la query... ],
  "filters_applied": {
    "anio": "2019",
    "genero": "F",
    "estrato": null,
    "naturaleza": "OFICIAL",
    "depto": null
  },
  "query_time_ms": 87
}
```

Los parámetros no enviados llegan como `null` al backend y se mapean a `NULL` en el prepared statement.