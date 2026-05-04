# ICFES Dashboard — Design Specification

## Paleta Global

| Token            | Hex       | Uso                                          |
|------------------|-----------|----------------------------------------------|
| `--color-primary`   | `#003857` | Azul institucional ICFES — acentos, headers  |
| `--color-secondary` | `#006687` | Azul medio — elementos activos, hover        |
| `--color-accent`    | `#9dcbf4` | Azul brillante — highlights, tooltips        |
| `--color-success`   | `#2A9D8F` | Verde — puntajes altos, colegios no oficiales |
| `--color-danger`    | `#D62828` | Rojo — puntajes bajos, alertas               |
| `--color-warning`   | `#F77F00` | Ámbar — valores medios                       |
| `--color-female`    | `#D4537E` | Rosa — género femenino                       |
| `--color-male`      | `#457B9D` | Azul claro — género masculino                |
| `--color-oficial`   | `#003857` | Azul — colegios oficiales                    |
| `--color-nooficial` | `#2A9D8F` | Verde — colegios no oficiales                |
| `--bg-dark`         | `#f9f9fc` | Fondo del dashboard                          |
| `--bg-card`         | `#ffffff` | Fondo de cada card de gráfica                |
| `--bg-card-hover`   | `#f3f3f7` | Fondo card en hover                          |
| `--text-primary`    | `#1a1c1e` | Texto principal                              |
| `--text-secondary`  | `#41474e` | Texto secundario, labels de ejes             |
| `--border-card`     | `#c1c7cf` | Borde de cards                               |
| `--grid-line`       | `#e2e2e5` | Líneas de cuadrícula de los ejes             |

### Tipografía

| Elemento        | Familia              | Peso  | Tamaño |
|-----------------|----------------------|-------|--------|
| Título gráfica  | `Inter` / `Outfit`   | 600   | 15px   |
| Subtítulo       | `Inter`              | 400   | 12px   |
| Label eje       | `Inter Mono`         | 400   | 11px   |
| Valor en celda  | `Inter Mono`         | 500   | 12px   |
| Tooltip título  | `Inter`              | 600   | 13px   |
| Tooltip valor   | `Inter Mono`         | 400   | 12px   |

---

## Especificación de Gráficas

---

### Gráfica 1 — Mapa de Calor Territorial: ¿Dónde aprende mejor Colombia?

**Tipo:** Mapa coroplético (choropleth) de Colombia  
**Descripción visible:** *"Puntaje global promedio Saber 11 por departamento. Descubre qué regiones lideran y cuáles requieren más atención."*

#### Ejes y leyenda
| Elemento         | Valor                                                  |
|------------------|--------------------------------------------------------|
| Eje geográfico   | Polígonos de los 32 departamentos + Bogotá D.C.        |
| Escala de color  | Gradiente continuo: `#D62828` (bajo) → `#F77F00` (medio) → `#2A9D8F` (alto) |
| Leyenda          | Barra horizontal de color con etiquetas min / media / max |
| Selector de año  | Botones de año integrados en el card (2018 · 2019 · 2020 · 2021) |

#### Animaciones e interactividad
- **Entrada:** los departamentos aparecen con `fill-opacity` de 0 a 1 escalonado (stagger de 20ms por departamento, de norte a sur)
- **Cambio de año:** transición suave de color con `transition: fill 600ms ease-in-out` por polígono
- **Hover:** el departamento seleccionado sube de opacidad a 1.0, los demás bajan a 0.5; aparece un anillo de borde `--color-accent` de 2px
- **Tooltip en hover:** card flotante con: nombre del departamento, `prom_global` con barra de progreso animada (0 → valor en 400ms), `total_estudiantes`, diferencia vs. media nacional con flecha ↑↓ en color
- **Click:** filtra todas las demás gráficas al departamento seleccionado; el polígono queda marcado con borde pulsante (keyframe `pulse-border`)
- **Zoom:** scroll/pinch para hacer zoom en regiones; botón "Restablecer vista" en esquina

---

### Gráfica 2 — Heatmap: La Desigualdad Competencia a Competencia

**Tipo:** Heatmap — matriz de calor 6×5 (estratos × competencias)  
**Descripción visible:** *"¿Qué tanto separa el estrato el rendimiento de cada prueba? Cada celda muestra el promedio de los estudiantes de ese nivel en esa competencia."*

#### Ejes
| Eje   | Contenido                                                             |
|-------|-----------------------------------------------------------------------|
| Eje X | Competencias: Lectura Crítica · Matemáticas · C. Naturales · Sociales · Inglés |
| Eje Y | Estratos: Estrato 1 (abajo) → Estrato 6 (arriba)                     |
| Valor | Promedio numérico impreso en cada celda                               |

#### Escala de color
Normalizada por columna (cada competencia tiene su propio gradiente independiente):

| Nivel       | Color     |
|-------------|-----------|
| Mínimo col. | `#D62828` |
| Medio col.  | `#F77F00` |
| Máximo col. | `#2A9D8F` |

#### Animaciones e interactividad
- **Entrada:** las celdas aparecen en cascada diagonal (de celda [0,0] a [5,4]) con `scale(0) → scale(1)` y `opacity 0 → 1`, duración 40ms por celda, easing `cubic-bezier(0.34, 1.56, 0.64, 1)`
- **Hover celda:** la celda escala a `1.08`, borde `2px solid --color-accent`, z-index elevado; las demás celdas de la misma fila y columna se iluminan con 20% de opacidad
- **Tooltip en hover:** nombre del estrato + nombre de la competencia + valor promedio + `n` estudiantes + mini sparkline comparando ese estrato con los demás en esa competencia
- **Click columna (encabezado de competencia):** resalta toda la columna y muestra gráfica de barras emergente con la evolución de ese valor por año
- **Click fila (estrato):** resalta toda la fila; muestra radar chart emergente con el perfil de ese estrato en las 5 competencias

---

### Gráfica 3 — La Brecha que No Cierra: Oficial vs. No Oficial (2018–2021)

**Tipo:** Serie de tiempo — dos líneas con banda de confianza sombreada  
**Descripción visible:** *"Trayectoria del puntaje promedio de colegios oficiales y no oficiales a lo largo de cuatro años. ¿Se acortó la distancia?"*

#### Ejes
| Eje   | Contenido                                                    |
|-------|--------------------------------------------------------------|
| Eje X | Años: 2018 · 2019 · 2020 · 2021                             |
| Eje Y | Puntaje global promedio (escala: ajustada al rango de datos) |
| Línea azul  | Colegios `OFICIAL` — color `--color-oficial` `#003857`  |
| Línea verde | Colegios `NO OFICIAL` — color `--color-nooficial` `#2A9D8F` |
| Banda       | `prom_global ± desv_std` con 15% de opacidad del color de línea |

#### Elementos de referencia
- Línea vertical punteada en 2020 (`--color-warning` `#F77F00`, 1px dash), etiqueta: *"COVID-19"*
- Área sombreada entre las dos curvas: color `--color-accent` `#9dcbf4` al 8% de opacidad
- Etiqueta de brecha al final de la última serie: flecha bidireccional con el valor de la diferencia

#### Animaciones e interactividad
- **Entrada:** las líneas se dibujan de izquierda a derecha con animación de trazo SVG (`stroke-dashoffset`) en 1200ms, easing `ease-out`; las bandas aparecen en fade-in al finalizar el trazo
- **Hover sobre punto:** punto crece de radio 4 a radio 8 con transición 150ms; tooltip muestra año, prom_global de ambas líneas, diferencia absoluta, `desv_std`, y `total`
- **Hover sobre el área de brecha:** cambia opacidad del área a 20% y muestra etiqueta "Brecha: X puntos"
- **Toggle de líneas:** click en la leyenda activa/desactiva cada línea con fade-out de 300ms

---

### Gráfica 4 — ¿Quién Puntúa Más? Distribución por Género en Cada Prueba

**Tipo:** Boxplot agrupado — 5 grupos (competencias), 2 cajas por grupo (M / F)  
**Descripción visible:** *"Dispersión estadística de los puntajes de hombres y mujeres en cada competencia. La caja muestra el 50% central de los datos; los bigotes cubren el 80%."*

#### Ejes
| Eje   | Contenido                                                                 |
|-------|---------------------------------------------------------------------------|
| Eje X | Competencias: Matemáticas · Lectura Crítica · C. Naturales · Sociales · Inglés |
| Eje Y | Puntaje (0–100)                                                           |
| Caja F | Borde y relleno `--color-female` `#D4537E` al 30% de opacidad           |
| Caja M | Borde y relleno `--color-male` `#457B9D` al 30% de opacidad             |

#### Anatomía del boxplot
| Elemento           | Descripción                             |
|--------------------|-----------------------------------------|
| Bigote inferior    | Línea desde `p10` a `q1`               |
| Caja inferior      | Rect de `q1` a `mediana`               |
| Línea de mediana   | Línea horizontal en `mediana`, 2px      |
| Caja superior      | Rect de `mediana` a `q3`               |
| Bigote superior    | Línea desde `q3` a `p90`               |
| Punto de media     | Círculo `◆` relleno, radio 4px         |
| Tapas de bigote    | Líneas horizontales de 8px en `p10`/`p90` |

#### Animaciones e interactividad
- **Entrada:** las cajas crecen verticalmente desde la mediana hacia arriba y abajo (`scaleY 0 → 1` con `transform-origin: center`), stagger de 120ms por grupo
- **Los bigotes** se extienden después de las cajas con delay de 200ms adicional
- **Hover sobre caja:** relleno sube a 60% de opacidad; muestra tooltip con todos los estadísticos: `p10`, `q1`, `mediana`, `media`, `q3`, `p90`, `desv_std`, `n`
- **Hover sobre punto de media:** aparece línea horizontal discontinua que cruza toda la gráfica marcando ese valor
- **Click en competencia:** esa columna se expande al doble de ancho mostrando detalle adicional con beeswarm de puntos superpuesto

---

### Gráfica 5 — Capital Social vs. Capital Académico: ¿Cuánto Vale Cada Punto de NSE?

**Tipo:** Scatter plot de burbujas agregadas con regresión lineal  
**Descripción visible:** *"Cada burbuja es un grupo de estudiantes con el mismo índice NSE. Su posición vertical muestra su puntaje promedio. ¿La correlación es igual en colegios oficiales y no oficiales?"*

#### Ejes
| Eje          | Contenido                                                         |
|--------------|-------------------------------------------------------------------|
| Eje X        | Índice NSE Individual (valor continuo, rango ~40–75)              |
| Título eje X | `Índice de Nivel Socioeconómico (NSE)`                            |
| Eje Y        | Puntaje Global Promedio (0–500)                                   |
| Título eje Y | `Puntaje Global Promedio Saber 11`                                |
| Burbuja azul | Colegios `OFICIAL` — `--color-oficial` `#003857` al 70%          |
| Burbuja verde| Colegios `NO OFICIAL` — `--color-nooficial` `#2A9D8F` al 70%     |
| Tamaño       | Proporcional a `n_estudiantes` en escala logarítmica (radio 4–24px) |

#### Líneas de regresión
- Una línea por tipo de colegio, trazada sobre los datos aggregados del cliente
- Color igual al de las burbujas, trazo discontinuo `stroke-dasharray: 6 3`
- Etiqueta al final de cada línea: `R² = X.XX`

#### Animaciones e interactividad
- **Entrada:** las burbujas aparecen desde el centro `(0,0)` del plano y navegan hasta su posición final con `spring animation` (masa 1, rigidez 120, amortiguación 14), stagger de 8ms
- Las líneas de regresión se dibujan en `stroke-dashoffset` después de que todas las burbujas lleguen (delay 800ms)
- **Hover burbuja:** burbuja crece 1.4×, aparece crosshair (línea vertical + horizontal hasta los ejes), tooltip con: `nse_bucket`, `prom_global`, `n_estudiantes`, `tipo_colegio`
- **Brush/lasso:** arrastrar sobre el plano selecciona un rango de NSE y filtra las demás gráficas
- **Toggle de tipo:** click en leyenda oculta/muestra cada serie con animación de escala

---

### Gráfica 6 — Los 20 Colegios con Mayor Puntaje Promedio

**Tipo:** Barras horizontales — top 20 con indicadores secundarios  
**Descripción visible:** *"Establecimientos con el puntaje global más alto entre quienes presentaron al menos 30 estudiantes. Las marcas secundarias muestran el desempeño en Matemáticas e Inglés."*

#### Ejes
| Eje          | Contenido                                         |
|--------------|---------------------------------------------------|
| Eje Y        | Nombre del colegio (top 1 arriba → top 20 abajo)  |
| Eje X        | Puntaje global promedio (0–500)                   |
| Título eje X | `Puntaje Global Promedio`                         |
| Barra principal | Longitud = `prom_global`                       |
| Marcador `▲` | Posición en eje X = `prom_matematicas` (triángulo azul claro) |
| Marcador `●` | Posición en eje X = `prom_ingles` (círculo naranja)  |

#### Colores de barra
| Tipo colegio | Color barra                         | Color barra hover               |
|--------------|-------------------------------------|---------------------------------|
| `OFICIAL`    | `#003857` al 80%                    | `#006687`                       |
| `NO OFICIAL` | `#2A9D8F` al 80%                    | `#35b8a8`                       |

#### Badge por colegio
A la derecha de cada barra: chip con `departamento` en `--text-secondary` y chip con `total_alumnos` con ícono 👤.

#### Animaciones e interactividad
- **Entrada:** las barras crecen de izquierda a derecha en stagger de 60ms por barra, easing `ease-out`, duración 500ms; los marcadores `▲` `●` aparecen al final con `bounce` (scale 0 → 1.3 → 1)
- **Hover fila:** la barra entera resalta; aparece valor numérico animado sobre el extremo derecho (`countUp` de 0 al valor en 300ms); los marcadores pulsan
- **Tooltip en hover:** nombre completo del colegio, `tipo`, `departamento`, `prom_global`, `prom_matematicas`, `prom_ingles`, `total_alumnos`
- **Click barra:** filtra todas las demás gráficas al departamento de ese colegio
- **Ordenar:** botones en header del card para ordenar por `prom_global` / `prom_matematicas` / `prom_ingles` / `total_alumnos` con animación de reordenamiento (`FLIP animation`)
- **Paginación:** botones Anterior / Siguiente para navegar entre grupos de 20

---

## Comportamiento Global de Animaciones

| Situación             | Animación                                                    | Duración  |
|-----------------------|--------------------------------------------------------------|-----------|
| Carga inicial         | Skeleton shimmer en cada card → fade-in de la gráfica        | 300ms     |
| Cambio de filtro      | Las gráficas hacen fade-out al 30% → datos nuevos → fade-in  | 250ms     |
| Hover tooltip         | Scale-in desde el cursor, `cubic-bezier(0.34,1.56,0.64,1)`   | 150ms     |
| Click que filtra      | Ripple circular desde el punto de click en el card           | 400ms     |
| Reset de filtro       | Las gráficas se sacuden levemente (`shake` keyframe 200ms)   | 200ms     |
| Error de carga        | Card parpadea en rojo tenue, icono de reintentar aparece     | —         |

## Tooltip — Especificación Común

Todos los tooltips comparten:

```
Fondo:        #1b4f72 con blur(8px)
Borde:        1px solid --color-accent (#9dcbf4) al 40%
Border-radius: 8px
Padding:       12px 16px
Sombra:        0 8px 32px rgba(0,0,0,0.15)
Flecha:        triángulo de 6px apuntando al elemento
Z-index:       9999
```

El tooltip nunca se corta en los bordes del viewport: se reposiciona automáticamente al cuadrante disponible.

## Skeleton Loading

Durante la carga de datos cada card muestra:

```
Fondo:    linear-gradient(90deg, #edeef1 25%, #e7e8eb 50%, #edeef1 75%)
Animación: background-position de -200% a 200% en 1.5s infinito (shimmer)
Forma:    rectángulo que imita la forma de la gráfica correspondiente
```