const express = require('express');
const { Pool } = require('pg');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const port = process.env.SERVER_PORT || 3000;

const myCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

const pool = new Pool({
  host: String(process.env.DB_HOST),
  port: parseInt(process.env.DB_PORT),
  database: String(process.env.DB_NAME),
  user: String(process.env.DB_USER),
  password: String(process.env.DB_PASSWORD),
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

function buildFilters(params) {
  const [anio, genero, estrato, naturaleza, depto] = params;
  let filters = [];
  
  if (anio) filters.push(`LEFT(i."PERIODO"::varchar, 4) = '${anio}'`);
  if (genero) filters.push(`i."ESTU_GENERO" = '${genero}'`);
  if (estrato) filters.push(`i."FAMI_ESTRATOVIVIENDA" ILIKE '${estrato}'`);
  if (naturaleza) filters.push(`i."COLE_NATURALEZA" = '${naturaleza}'`);
  if (depto) filters.push(`i."COLE_DEPTO_UBICACION" = '${depto}'`);
  
  return filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';
}

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

const qualityFilter = `
  AND i."PUNT_GLOBAL" BETWEEN 0 AND 500
  AND i."ESTU_GENERO" IN ('M', 'F')
  AND i."FAMI_ESTRATOVIVIENDA" ~ '^Estrato [1-6]$'
`;

app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/prueba', async (req, res) => {
  const sql = 'SELECT * FROM icfes LIMIT 1';
  try {
    const result = await pool.query(sql);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/score-by-department', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('score-by-department', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = anio || genero || estrato || naturaleza || depto
    ? `
      SELECT 
        i."COLE_DEPTO_UBICACION" AS departamento,
        LEFT(i."PERIODO"::varchar, 4) AS anio,
        ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
        COUNT(*) AS total_estudiantes
      FROM mv_departamento_anio i
      WHERE 1=1 ${anio ? `AND i.anio = '${anio}'` : ''}
      GROUP BY i.departamento, i.anio
      ORDER BY prom_global DESC
    `
    : `
      SELECT 
        i."COLE_DEPTO_UBICACION" AS departamento,
        LEFT(i."PERIODO"::varchar, 4) AS anio,
        ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
        COUNT(*) AS total_estudiantes
      FROM icfes i
      WHERE i."PUNT_GLOBAL" IS NOT NULL ${qualityFilter} ${filters}
      GROUP BY i."COLE_DEPTO_UBICACION", LEFT(i."PERIODO"::varchar, 4)
      ORDER BY prom_global DESC
    `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/heatmap-estrato-competencia', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('heatmap-estrato-competencia', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = `
    SELECT 
      i."FAMI_ESTRATOVIVIENDA" AS estrato,
      ROUND(AVG(i."PUNT_LECTURA_CRITICA")::numeric, 2) AS prom_lectura,
      ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2) AS prom_matematicas,
      ROUND(AVG(i."PUNT_C_NATURALES")::numeric, 2) AS prom_naturales,
      ROUND(AVG(i."PUNT_SOCIALES_CIUDADANAS")::numeric, 2) AS prom_sociales,
      ROUND(AVG(i."PUNT_INGLES")::numeric, 2) AS prom_ingles,
      COUNT(*) AS n
    FROM icfes i
    WHERE i."FAMI_ESTRATOVIVIENDA" IS NOT NULL ${qualityFilter} ${filters}
    GROUP BY i."FAMI_ESTRATOVIVIENDA"
    ORDER BY i."FAMI_ESTRATOVIVIENDA"
  `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/timeseries-by-school-type', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('timeseries-by-school-type', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = `
    SELECT 
      LEFT(i."PERIODO"::varchar, 4) AS anio,
      i."COLE_NATURALEZA" AS tipo_colegio,
      ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
      ROUND(STDDEV(i."PUNT_GLOBAL")::numeric, 2) AS desv_std,
      COUNT(*) AS total
    FROM icfes i
    WHERE i."COLE_NATURALEZA" IS NOT NULL AND i."PUNT_GLOBAL" IS NOT NULL ${qualityFilter} ${filters}
    GROUP BY LEFT(i."PERIODO"::varchar, 4), i."COLE_NATURALEZA"
    ORDER BY anio, tipo_colegio
  `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/score-distribution-by-gender', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('score-distribution-by-gender', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = `
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
    WHERE i."ESTU_GENERO" IS NOT NULL AND i."PUNT_MATEMATICAS" IS NOT NULL ${qualityFilter} ${filters}
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
      WHERE i."ESTU_GENERO" IS NOT NULL AND i."PUNT_LECTURA_CRITICA" IS NOT NULL ${qualityFilter} ${filters}
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
      WHERE i."ESTU_GENERO" IS NOT NULL AND i."PUNT_C_NATURALES" IS NOT NULL ${qualityFilter} ${filters}
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
      WHERE i."ESTU_GENERO" IS NOT NULL AND i."PUNT_SOCIALES_CIUDADANAS" IS NOT NULL ${qualityFilter} ${filters}
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
      WHERE i."ESTU_GENERO" IS NOT NULL AND i."PUNT_INGLES" IS NOT NULL ${qualityFilter} ${filters}
      GROUP BY i."ESTU_GENERO"
      
      ORDER BY competencia, genero
    `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/nse-vs-score', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('nse-vs-score', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = `
    SELECT
      ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1) AS nse_bucket,
      i."COLE_NATURALEZA" AS tipo_colegio,
      ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
      COUNT(*) AS n_estudiantes
    FROM icfes i
    WHERE i."ESTU_INSE_INDIVIDUAL" IS NOT NULL AND i."PUNT_GLOBAL" IS NOT NULL ${qualityFilter} ${filters}
    GROUP BY ROUND(i."ESTU_INSE_INDIVIDUAL"::numeric, 1), i."COLE_NATURALEZA"
    ORDER BY nse_bucket
  `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response, 60);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/charts/school-ranking', async (req, res) => {
  const start = Date.now();
  const { anio, genero, estrato, naturaleza, depto } = req.query;
  const params = [anio, genero, estrato, naturaleza, depto];
  const filters = buildFilters(params);
  const cacheKey = getCacheKey('school-ranking', req.query);
  
  const cached = myCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  const sql = `
    SELECT
      i."COLE_NOMBRE_ESTABLECIMIENTO" AS colegio,
      i."COLE_NATURALEZA" AS tipo,
      i."COLE_DEPTO_UBICACION" AS departamento,
      ROUND(AVG(i."PUNT_GLOBAL")::numeric, 2) AS prom_global,
      ROUND(AVG(i."PUNT_MATEMATICAS")::numeric, 2) AS prom_matematicas,
      ROUND(AVG(i."PUNT_INGLES")::numeric, 2) AS prom_ingles,
      COUNT(*) AS total_alumnos
    FROM icfes i
    WHERE i."COLE_NOMBRE_ESTABLECIMIENTO" IS NOT NULL ${qualityFilter} ${filters}
    GROUP BY i."COLE_NOMBRE_ESTABLECIMIENTO", i."COLE_NATURALEZA", i."COLE_DEPTO_UBICACION"
    HAVING COUNT(*) >= 30
    ORDER BY prom_global DESC
  `;

  try {
    const result = await pool.query(sql);
    const response = {
      data: result.rows,
      filters_applied: { anio, genero, estrato, naturaleza, depto },
      query_time_ms: Date.now() - start
    };
    myCache.set(cacheKey, response, 60);
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Servidor ejecutando en http://localhost:${port}`);
});