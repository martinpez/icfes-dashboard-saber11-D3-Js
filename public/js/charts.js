const API_BASE = '/api/v1/charts';

const colors = {
  primary: '#003857',
  secondary: '#006687',
  accent: '#9dcbf4',
  success: '#2A9D8F',
  danger: '#D62828',
  warning: '#F77F00',
  female: '#D4537E',
  male: '#457B9D',
  oficial: '#003857',
  nooficial: '#2A9D8F',
  bg: '#0b0f1a',
  card: '#131a2b',
  text: '#f1f5f9',
  muted: '#64748b',
  grid: '#2d3748',
  tooltipBg: 'rgba(27, 79, 114, 0.95)',
  tooltipText: '#f1f5f9'
};

const compLabels = {
  'prom_lectura': 'Lectura',
  'prom_matematicas': 'Matematicas',
  'prom_naturales': 'C. Nat.',
  'prom_sociales': 'Sociales',
  'prom_ingles': 'Ingles',
  'Matematicas': 'Matematicas',
  'Lectura Critica': 'Lectura',
  'Ciencias Naturales': 'C. Nat.',
  'Sociales y Ciudadanas': 'Sociales',
  'Ingles': 'Ingles'
};

let currentFilters = { anio: '', genero: '', estrato: '', naturaleza: '', depto: '' };

function buildQueryString() {
  return '?' + Object.entries(currentFilters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function showTooltip(event, content) {
  const tt = document.getElementById('tooltip');
  tt.innerHTML = content;
  tt.classList.add('visible');
  const padding = 12;
  let x = event.clientX + padding;
  let y = event.clientY - 8;
  
  const rect = tt.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) {
    x = event.clientX - rect.width - padding;
  }
  if (y + rect.height > window.innerHeight) {
    y = event.clientY - rect.height - padding;
  }
  
  tt.style.left = x + 'px';
  tt.style.top = y + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('visible');
}

async function fetchData(endpoint) {
  const url = API_BASE + endpoint + buildQueryString();
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error loading data');
  }
  return res.json();
}

function setupFilters() {
  document.querySelectorAll('.filters select').forEach(select => {
    select.addEventListener('change', () => {
      currentFilters[select.id.replace('filter-', '')] = select.value;
      loadAllCharts();
    });
  });
}

async function loadDepartments() {
  try {
    const data = await fetchData('/score-by-department');
    if (data.data && data.data.length) {
      const deptos = [...new Set(data.data.map(d => d.departamento))].sort();
      const select = document.getElementById('filter-depto');
      deptos.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
      });
    }
  } catch (e) { 
    console.error('Error loading departments:', e); 
  }
}

async function loadAllCharts() {
  const promises = [
    renderChart1(), renderChart2(), renderChart3(),
    renderChart4(), renderChart5(), renderChart6()
  ];
  await Promise.all(promises);
}

async function renderChart1() {
  const container = d3.select('#chart-1 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/score-by-department');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
    
    const geoRes = await fetch('./colombia.geo.json');
    const geoData = await geoRes.json();
    
    const sortedData = [...data.data].sort((a, b) => +b.prom_global - +a.prom_global);
    const scoreMap = new Map(sortedData.map((d, i) => [d.departamento.trim(), { score: +d.prom_global, rank: i + 1, total: d.total_estudiantes }]));
    const scores = sortedData.map(d => +d.prom_global);
    const avgGlobal = d3.mean(scores);
    const minScore = d3.min(scores);
    const maxScore = d3.max(scores);
    const totalDepts = sortedData.length;
    
    const width = container.node().getBoundingClientRect().width || 700;
    const mapHeight = 380;
    const legendHeight = 50;
    const height = mapHeight + legendHeight;
    
    const svg = container.append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    
    const projection = d3.geoMercator()
      .fitSize([width, mapHeight], geoData);
    
    const pathGenerator = d3.geoPath().projection(projection);
    
    const colorScale = d3.scaleSequential()
      .domain([minScore, maxScore])
      .interpolator(d3.interpolateRgbBasis([colors.danger, colors.warning, colors.success]));
    
    const features = geoData.features.map(f => {
      const deptName = f.properties.NOMBRE_DPT?.trim();
      const deptData = scoreMap.get(deptName);
      return {
        ...f,
        properties: {
          ...f.properties,
          score: deptData?.score || null,
          rank: deptData?.rank || null,
          total: deptData?.total || 0,
          dept: deptName,
          hasData: !!deptData
        }
      };
    });
    
    const allFeatures = svg.append('g').attr('class', 'map-group');
    
    allFeatures.selectAll('path')
      .data(features)
      .join('path')
      .attr('d', pathGenerator)
      .attr('fill', d => {
        if (!d.properties.hasData) return colors.secondary;
        return d.properties.score ? colorScale(d.properties.score) : colors.secondary;
      })
      .attr('stroke', d => d.properties.hasData ? colors.card : colors.grid)
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('stroke', colors.accent)
          .attr('stroke-width', 2);
        
        if (d.properties.hasData) {
          const diff = d.properties.score - avgGlobal;
          const arrow = diff >= 0 ? '↑' : '↓';
          showTooltip(event, 
            `<div class="tooltip-title">${d.properties.dept}</div>
             <div class="tooltip-value">${d.properties.score.toFixed(1)}</div>
             <div class="tooltip-row">
               <span>Rank: #${d.properties.rank} / ${totalDepts}</span>
             </div>
             <div class="tooltip-row">
               <span>${arrow} ${Math.abs(diff).toFixed(1)} vs media</span>
               <span>${d.properties.total} est.</span>
             </div>`
          );
        } else {
          showTooltip(event, 
            `<div class="tooltip-title">${d.properties.dept}</div>
             <div class="tooltip-value" style="font-size:12px">Sin datos</div>`
          );
        }
      })
      .on('mousemove', function(event) {
        const tt = document.getElementById('tooltip');
        const padding = 12;
        let x = event.clientX + padding;
        let y = event.clientY - 8;
        
        if (x + tt.offsetWidth > window.innerWidth) {
          x = event.clientX - tt.offsetWidth - padding;
        }
        if (y + tt.offsetHeight > window.innerHeight) {
          y = event.clientY - tt.offsetHeight - padding;
        }
        
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', colors.card)
          .attr('stroke-width', 0.5);
        hideTooltip();
      });
    
    const legendWidth = 180;
    const legendX = (width - legendWidth) / 2;
    const legendY = mapHeight + 12;
    
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%').attr('x2', '100%');
    
    gradient.append('stop').attr('offset', '0%').attr('stop-color', colors.danger);
    gradient.append('stop').attr('offset', '50%').attr('stop-color', colors.warning);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', colors.success);
    
    svg.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', 12)
      .attr('fill', 'url(#legend-gradient)')
      .attr('rx', 3);
    
    svg.append('text')
      .attr('x', legendX)
      .attr('y', legendY + 26)
      .attr('fill', colors.text)
      .attr('font-size', '10px')
      .text(minScore.toFixed(0));
    
    svg.append('text')
      .attr('x', legendX + legendWidth)
      .attr('y', legendY + 26)
      .attr('fill', colors.text)
      .attr('font-size', '10px')
      .attr('text-anchor', 'end')
      .text(maxScore.toFixed(0));
    
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', legendY - 2)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.text)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text('Puntaje Global Promedio');
    
  } catch (e) {
    console.error('Chart 1 error:', e);
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
  }
}

async function renderChart2() {
  const container = d3.select('#chart-2 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/heatmap-estrato-competencia');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
  } catch (e) {
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
    return;
  }
  
  const data = await fetchData('/heatmap-estrato-competencia');
  
  const width = container.node().getBoundingClientRect().width || 600;
  const height = 180;
  const margin = { top: 5, right: 20, bottom: 40, left: 55 };
  
  const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const competencias = ['prom_lectura', 'prom_matematicas', 'prom_naturales', 'prom_sociales', 'prom_ingles'];
  const estratos = data.data.map(d => d.estrato).sort((a, b) => {
    const aNum = a === 'Sin estrato' ? 7 : parseInt(a);
    const bNum = b === 'Sin estrato' ? 7 : parseInt(b);
    return aNum - bNum;
  });
  
  const x = d3.scaleBand()
    .domain(competencias)
    .range([0, width - margin.left - margin.right])
    .padding(0.15);
  
  const y = d3.scaleBand()
    .domain(estratos)
    .range([0, height - margin.top - margin.bottom])
    .padding(0.15);
  
  const flatData = [];
  data.data.forEach(row => {
    competencias.forEach(comp => {
      const values = data.data.map(d => +d[comp]).filter(v => v);
      const colMax = d3.max(values), colMin = d3.min(values);
      const estratoNum = row.estrato === 'Sin estrato' ? 7 : parseInt(row.estrato);
      flatData.push({
        estrato: row.estrato,
        estratoNum: estratoNum,
        competencia: comp,
        value: +row[comp],
        normalized: colMax === colMin ? 0.5 : (+row[comp] - colMin) / (colMax - colMin)
      });
    });
  });
  
  const colorScale = d3.scaleSequential()
    .domain([0, 1])
    .interpolator(d3.interpolateRgbBasis([colors.danger, colors.warning, colors.success]));
  
  g.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top - margin.bottom + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Competencia');
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height - margin.top - margin.bottom) / 2)
    .attr('y', -45)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Estrato Socioeconómico');
  
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(i => compLabels[i] || i))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '9px');
  
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '9px');
  
  g.selectAll('.cell')
    .data(flatData)
    .enter().append('rect')
    .attr('class', 'cell tooltip-target')
    .attr('x', d => x(d.competencia))
    .attr('y', d => y(d.estrato))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(d.normalized))
    .attr('rx', 2)
    .on('mouseover', (event, d) => {
      const estratoLabel = d.estrato;
      showTooltip(event, 
        `<div class="tooltip-title">${compLabels[d.competencia]}</div>
         <div class="tooltip-value">${d.value.toFixed(1)}</div>
         <div class="tooltip-row">
           <span>Estrato: ${estratoLabel}</span>
         </div>`
      );
    })
    .on('mousemove', function(event) {
      const tt = document.getElementById('tooltip');
      const padding = 12;
      let x = event.clientX + padding;
      let y = event.clientY - 8;
      if (x + tt.offsetWidth > window.innerWidth) {
        x = event.clientX - tt.offsetWidth - padding;
      }
      if (y + tt.offsetHeight > window.innerHeight) {
        y = event.clientY - tt.offsetHeight - padding;
      }
      tt.style.left = x + 'px';
      tt.style.top = y + 'px';
    })
    .on('mouseout', hideTooltip);
}

async function renderChart3() {
  const container = d3.select('#chart-3 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/timeseries-by-school-type');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
  } catch (e) {
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
    return;
  }
  
  const data = await fetchData('/timeseries-by-school-type');
  
  const width = container.node().getBoundingClientRect().width || 800;
  const height = 220;
  const margin = { top: 35, right: 30, bottom: 35, left: 45 };
  
  const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const oficial = data.data.filter(d => d.tipo_colegio === 'OFICIAL');
  const noOficial = data.data.filter(d => d.tipo_colegio === 'NO OFICIAL');
  
  const years = [...new Set(data.data.map(d => d.anio))].sort();
  const allValues = data.data.map(d => +d.prom_global);
  
  const x = d3.scalePoint()
    .domain(years)
    .range([0, width - margin.left - margin.right])
    .padding(0.5);
  
  const y = d3.scaleLinear()
    .domain([d3.min(allValues) * 0.94, d3.max(allValues) * 1.03])
    .range([height - margin.top - margin.bottom, 0]);
  
  svg.append('text')
    .attr('x', 15)
    .attr('y', 16)
    .attr('fill', colors.oficial)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Públicos');
  
  svg.append('text')
    .attr('x', 85)
    .attr('y', 16)
    .attr('fill', colors.nooficial)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Privados');
  
  const pandemicX = years.includes('2020') ? x('2020') : null;
  if (pandemicX !== null) {
    g.append('line')
      .attr('class', 'pandemic-line')
      .attr('x1', pandemicX)
      .attr('x2', pandemicX)
      .attr('y1', 0)
      .attr('y2', height - margin.top - margin.bottom)
      .attr('stroke', colors.warning)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('opacity', 0.7);
    
    g.append('text')
      .attr('x', pandemicX)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', colors.warning)
      .attr('font-size', '9px')
      .attr('font-weight', '500')
      .text('COVID-19');
  }
  
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '10px');
  
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => Math.round(d)))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '10px');
  
  g.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top - margin.bottom + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Año');
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height - margin.top - margin.bottom) / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Puntaje Global');
  
  const line = d3.line()
    .x(d => x(d.anio))
    .y(d => y(+d.prom_global))
    .curve(d3.curveMonotoneX);
  
  const area = d3.area()
    .x(d => x(d.anio))
    .y0(d => y(+d.prom_global - (+d.desv_std || 0) * 0.5))
    .y1(d => y(+d.prom_global + (+d.desv_std || 0) * 0.5))
    .curve(d3.curveMonotoneX);
  
  [oficial, noOficial].forEach((dataset, i) => {
    const color = i === 0 ? colors.oficial : colors.nooficial;
    const areaColor = i === 0 ? 'rgba(0, 56, 87, 0.15)' : 'rgba(42, 157, 143, 0.15)';
    
    g.append('path')
      .datum(dataset)
      .attr('class', 'area')
      .attr('fill', areaColor)
      .attr('d', area);
    
    g.append('path')
      .datum(dataset)
      .attr('class', 'line-path')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.5)
      .attr('d', line);
    
    g.selectAll('.point-' + i)
      .data(dataset)
      .enter().append('circle')
      .attr('class', 'point tooltip-target')
      .attr('cx', d => x(d.anio))
      .attr('cy', d => y(+d.prom_global))
      .attr('r', 5)
      .attr('fill', colors.card)
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .on('mouseover', (event, d) => {
        const other = dataset.find(o => o.anio === d.anio && o.tipo_colegio !== d.tipo_colegio);
        const schoolType = d.tipo_colegio === 'OFICIAL' ? 'Público' : 'Privado';
        showTooltip(event, 
          `<div class="tooltip-title">${d.anio} - ${schoolType}</div>
           <div class="tooltip-value">${d.prom_global}</div>
           <div class="tooltip-row">
             <span>Desv. Std: ${d.desv_std}</span>
           </div>
           ${other ? `<div class="tooltip-row"><span>Diferencia: ${Math.abs(+d.prom_global - +other.prom_global).toFixed(1)} pts</span></div>` : ''}`
        );
      })
      .on('mousemove', function(event) {
        const tt = document.getElementById('tooltip');
        const padding = 12;
        let x = event.clientX + padding;
        let y = event.clientY - 8;
        if (x + tt.offsetWidth > window.innerWidth) {
          x = event.clientX - tt.offsetWidth - padding;
        }
        if (y + tt.offsetHeight > window.innerHeight) {
          y = event.clientY - tt.offsetHeight - padding;
        }
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
      })
      .on('mouseout', hideTooltip);
  });
}

async function renderChart4() {
  const container = d3.select('#chart-4 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/score-distribution-by-gender');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
  } catch (e) {
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
    return;
  }
  
  const data = await fetchData('/score-distribution-by-gender');
  
  const width = container.node().getBoundingClientRect().width || 800;
  const height = 220;
  const margin = { top: 35, right: 30, bottom: 40, left: 45 };
  
  const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const competencias = ['Matematicas', 'Lectura Critica', 'Ciencias Naturales', 'Sociales y Ciudadanas', 'Ingles'];
  
  svg.append('text')
    .attr('x', 15)
    .attr('y', 16)
    .attr('fill', colors.female)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Mujeres');
  
  svg.append('text')
    .attr('x', 95)
    .attr('y', 16)
    .attr('fill', colors.male)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Hombres');
  
  const x = d3.scaleBand()
    .domain(competencias)
    .range([0, width - margin.left - margin.right])
    .padding(0.5);
  
  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([height - margin.top - margin.bottom, 0]);
  
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(i => compLabels[i] || i))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '9px');
  
  g.append('g')
    .attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '10px');
  
  g.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top - margin.bottom + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Competencia');
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height - margin.top - margin.bottom) / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Puntaje');
  
  competencias.forEach((comp, compIdx) => {
    const compData = data.data.filter(d => d.competencia === comp);
    compData.forEach((d, i) => {
      const genderLabel = d.genero === 'F' ? 'Mujer' : 'Hombre';
      const genderColor = d.genero === 'F' ? colors.female : colors.male;
      const xPos = x(comp) + (i === 0 ? 0 : x.bandwidth());
      const boxWidth = x.bandwidth() * 0.38;
      
      const box = g.append('g').attr('transform', `translate(${xPos},0)`);
      
      box.append('line')
        .attr('class', 'whisker')
        .attr('y1', y(+d.p10))
        .attr('y2', y(+d.p90))
        .attr('stroke', genderColor)
        .attr('stroke-width', 1.5);
      
      box.append('rect')
        .attr('class', 'box tooltip-target')
        .attr('y', y(+d.q3))
        .attr('height', y(+d.q1) - y(+d.q3))
        .attr('width', boxWidth)
        .attr('fill', genderColor)
        .attr('fill-opacity', 0.3)
        .attr('stroke', genderColor)
        .attr('stroke-width', 1.5)
        .attr('rx', 2)
        .on('mouseover', (event) => {
          showTooltip(event, 
            `<div class="tooltip-title">${compLabels[comp]} - ${genderLabel}</div>
             <div class="tooltip-value">${d.media}</div>
             <div class="tooltip-row">
               <span>P10: ${d.p10}</span>
               <span>P90: ${d.p90}</span>
             </div>
             <div class="tooltip-row">
               <span>Q1: ${d.q1}</span>
               <span>Mediana: ${d.mediana}</span>
               <span>Q3: ${d.q3}</span>
             </div>`
          );
        })
        .on('mousemove', function(event) {
          const tt = document.getElementById('tooltip');
          const padding = 12;
          let x = event.clientX + padding;
          let y = event.clientY - 8;
          if (x + tt.offsetWidth > window.innerWidth) {
            x = event.clientX - tt.offsetWidth - padding;
          }
          if (y + tt.offsetHeight > window.innerHeight) {
            y = event.clientY - tt.offsetHeight - padding;
          }
          tt.style.left = x + 'px';
          tt.style.top = y + 'px';
        })
        .on('mouseout', hideTooltip);
      
      box.append('line')
        .attr('class', 'median-line')
        .attr('y1', y(+d.mediana))
        .attr('y2', y(+d.mediana))
        .attr('x2', boxWidth)
        .attr('stroke', genderColor)
        .attr('stroke-width', 2);
    });
  });
}

async function renderChart5() {
  const container = d3.select('#chart-5 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/nse-vs-score');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
  } catch (e) {
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
    return;
  }
  
  const data = await fetchData('/nse-vs-score');
  
  const width = container.node().getBoundingClientRect().width || 800;
  const height = 220;
  const margin = { top: 35, right: 30, bottom: 45, left: 45 };
  
  const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const oficial = data.data.filter(d => d.tipo_colegio === 'OFICIAL');
  const noOficial = data.data.filter(d => d.tipo_colegio === 'NO OFICIAL');
  const allNSE = data.data.map(d => +d.nse_bucket);
  const allScore = data.data.map(d => +d.prom_global);
  
  svg.append('text')
    .attr('x', 15)
    .attr('y', 16)
    .attr('fill', colors.oficial)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Públicos');
  
  svg.append('text')
    .attr('x', 90)
    .attr('y', 16)
    .attr('fill', colors.nooficial)
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text('● Privados');
  
  const xMin = d3.min(allNSE);
  const xMax = d3.max(allNSE);
  
  const x = d3.scaleLinear()
    .domain([xMin * 0.95, xMax * 1.05])
    .range([0, width - margin.left - margin.right]);
  
  const y = d3.scaleLinear()
    .domain([d3.min(allScore) * 0.94, d3.max(allScore) * 1.03])
    .range([height - margin.top - margin.bottom, 0]);
  
  const r = d3.scaleSqrt()
    .domain([0, d3.max(data.data, d => +d.n_estudiantes)])
    .range([5, 20]);
  
g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '10px');
  
  g.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top - margin.bottom + 38)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Índice de Nivel Socioeconómico (NSE)');
  
  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height - margin.top - margin.bottom) / 2)
    .attr('y', -35)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Puntaje Global');
  
  const drawBubble = (dataset, color) => {
    g.selectAll('.bubble-' + color.replace('#', ''))
      .data(dataset)
      .enter().append('circle')
      .attr('class', 'bubble tooltip-target')
      .attr('cx', d => x(+d.nse_bucket))
      .attr('cy', d => y(+d.prom_global))
      .attr('r', 0)
      .attr('fill', color)
      .attr('fill-opacity', 0.7)
      .attr('stroke', 'rgba(255,255,255,0.3)')
      .attr('stroke-width', 1)
      .on('mouseover', (event, d) => {
        const nseLabel = d.nse_bucket;
        const schoolType = d.tipo_colegio === 'OFICIAL' ? 'Público' : 'Privado';
        showTooltip(event, 
          `<div class="tooltip-title">Estrato: ${nseLabel}</div>
           <div class="tooltip-value">${d.prom_global}</div>
           <div class="tooltip-row">
             <span>Tipo: ${schoolType}</span>
             <span>Estudiantes: ${d.n_estudiantes}</span>
           </div>`
        );
      })
      .on('mousemove', function(event) {
        const tt = document.getElementById('tooltip');
        const padding = 12;
        let x = event.clientX + padding;
        let y = event.clientY - 8;
        if (x + tt.offsetWidth > window.innerWidth) {
          x = event.clientX - tt.offsetWidth - padding;
        }
        if (y + tt.offsetHeight > window.innerHeight) {
          y = event.clientY - tt.offsetHeight - padding;
        }
        tt.style.left = x + 'px';
        tt.style.top = y + 'px';
      })
      .on('mouseout', hideTooltip)
      .transition().duration(600).delay((d, i) => i * 15)
      .attr('r', d => r(+d.n_estudiantes));
  };
  
  drawBubble(oficial, colors.oficial);
  drawBubble(noOficial, colors.nooficial);
}

async function renderChart6() {
  const container = d3.select('#chart-6 .chart-container');
  container.selectAll('*').remove();
  
  try {
    const data = await fetchData('/school-ranking');
    if (!data.data || !data.data.length) { 
      container.append('p').attr('class', 'loading').text('No data'); 
      return; 
    }
  } catch (e) {
    container.append('p').attr('class', 'loading').text('Error: ' + e.message);
    return;
  }
  
  const data = await fetchData('/school-ranking');
  
  const top20 = data.data.slice(0, 20);
  const width = container.node().getBoundingClientRect().width || 800;
  const height = 320;
  const margin = { top: 5, right: 30, bottom: 25, left: 160 };
  
  const svg = container.append('svg').attr('viewBox', `0 0 ${width} ${height}`);
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
  const maxScore = d3.max(top20, d => +d.prom_global);
  const minScore = d3.min(top20, d => +d.prom_global);
  
  const colorScale = d3.scaleLinear()
    .domain([minScore, maxScore])
    .range([colors.warning, colors.success]);
  
  const y = d3.scaleBand()
    .domain(top20.map(d => d.colegio))
    .range([0, height - margin.top - margin.bottom])
    .padding(0.25);
  
  const x = d3.scaleLinear()
    .domain([0, maxScore * 1.08])
    .range([0, width - margin.left - margin.right]);
  
  g.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll('text')
    .attr('fill', colors.text)
    .attr('font-size', '10px');
  
  g.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top - margin.bottom + 20)
    .attr('text-anchor', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text('Puntaje Global Promedio');
  
  g.selectAll('.bar')
    .data(top20)
    .enter().append('rect')
    .attr('class', 'bar tooltip-target')
    .attr('x', 0)
    .attr('y', d => y(d.colegio))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', d => colorScale(+d.prom_global))
    .attr('rx', 3)
    .on('mouseover', (event, d) => {
      const rank = top20.indexOf(d) + 1;
      const schoolType = d.tipo === 'OFICIAL' ? 'Público' : 'Privado';
      showTooltip(event, 
        `<div class="tooltip-title">#${rank} - ${d.colegio.substring(0, 30)}${d.colegio.length > 30 ? '...' : ''}</div>
         <div class="tooltip-value">${d.prom_global}</div>
         <div class="tooltip-row">
           <span>Tipo: ${schoolType}</span>
           <span>Depto: ${d.departamento}</span>
         </div>
         <div class="tooltip-row">
           <span>Matemáticas: ${d.prom_matematicas}</span>
           <span>Inglés: ${d.prom_ingles}</span>
         </div>
         <div class="tooltip-row">
           <span>Alumnos: ${d.total_alumnos}</span>
         </div>`
      );
    })
    .on('mousemove', function(event) {
      const tt = document.getElementById('tooltip');
      const padding = 12;
      let x = event.clientX + padding;
      let y = event.clientY - 8;
      if (x + tt.offsetWidth > window.innerWidth) {
        x = event.clientX - tt.offsetWidth - padding;
      }
      if (y + tt.offsetHeight > window.innerHeight) {
        y = event.clientY - tt.offsetHeight - padding;
      }
      tt.style.left = x + 'px';
      tt.style.top = y + 'px';
    })
    .on('mouseout', hideTooltip)
    .transition().duration(500).delay((d, i) => i * 30)
    .attr('width', d => x(+d.prom_global));
  
  g.selectAll('.label')
    .data(top20)
    .enter().append('text')
    .attr('x', -8)
    .attr('y', d => y(d.colegio) + y.bandwidth() / 2)
    .attr('text-anchor', 'end')
    .attr('alignment-baseline', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '10px')
    .text(d => d.colegio.substring(0, 18) + (d.colegio.length > 18 ? '...' : ''));
  
  g.selectAll('.value')
    .data(top20)
    .enter().append('text')
    .attr('x', d => x(+d.prom_global) + 5)
    .attr('y', d => y(d.colegio) + y.bandwidth() / 2)
    .attr('alignment-baseline', 'middle')
    .attr('fill', colors.text)
    .attr('font-size', '9px')
    .attr('font-family', 'monospace')
    .attr('opacity', 0)
    .text(d => parseFloat(d.prom_global).toFixed(1))
    .transition().duration(300).delay((d, i) => i * 30 + 400)
    .attr('opacity', 1);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupFilters();
  await loadDepartments();
  await loadAllCharts();
});