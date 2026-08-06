// Registrar plugin DataLabels en Chart.js
        Chart.register(ChartDataLabels);

        const SUPABASE_URL = 'https://akmtbtfsclbsttsyrtnv.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbXRidGZzY2xic3R0c3lydG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTAxNDksImV4cCI6MjEwMTMyNjE0OX0.EUhePY3Mp3_JSmp8MZOsBlOKb6LQRcUGbobTAHnBQkg';

        const NIVELES_MAP = {
            '4': 'Básica Elemental',
            '7': 'Básica Media',
            '10': 'Básica Superior',
            '3': 'Bachillerato'
        };

        const PROVINCIA_MAP = {
            '01': 'Azuay', '02': 'Bolívar', '03': 'Cañar', '04': 'Carchi', 
            '05': 'Cotopaxi', '06': 'Chimborazo', '07': 'El Oro', '08': 'Esmeraldas', 
            '09': 'Guayas', '10': 'Imbabura', '11': 'Loja', '12': 'Los Ríos', 
            '13': 'Manabí', '14': 'Morona Santiago', '15': 'Napo', '16': 'Pastaza', 
            '17': 'Pichincha', '18': 'Tungurahua', '19': 'Zamora Chinchipe', '20': 'Galápagos', 
            '21': 'Sucumbíos', '22': 'Orellana', '23': 'Santo Domingo de los Tsáchilas', '24': 'Santa Elena'
        };

        const COLORES_LABEL = {
            'Bachillerato': '#f1c40f',
            'Básica Elemental': '#2ecc71',
            'Básica Media': '#3498db',
            'Básica Superior': '#9b59b6',
            'Desconocido': '#95a5a6'
        };

        const COLORES_REGIMEN = {
            'COSTA': '#003366',
            'SIERRA': '#c2185b',
            'AMAZONIA': '#2e7d32',
            'GALAPAGOS': '#0288d1',
            'Sin Dato': '#95a5a6'
        };

        let rawData = [];
        let filteredData = [];
        
        let map = L.map('map').setView([-1.8312, -78.1834], 6);

        // Definición de Mapas Base
        const baseLayers = {
            'CartoDB Claro (Positron)': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }),
            'Esri Satélite (World Imagery)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
            'OpenStreetMap (Clásico)': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }),
            'CartoDB Oscuro (Dark Matter)': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            })
        };

        baseLayers['CartoDB Claro (Positron)'].addTo(map);

        const basemapControl = L.control({position: 'topright'});
        basemapControl.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'basemap-control');
            div.innerHTML = '<label><i class="fas fa-map"></i> MAPA BASE</label>' +
                '<select id="select_basemap" onchange="cambiarMapaBase(this.value)">' +
                    '<option value="CartoDB Claro (Positron)">CartoDB Claro (Positron)</option>' +
                    '<option value="Esri Satélite (World Imagery)">Esri Satélite (World Imagery)</option>' +
                    '<option value="OpenStreetMap (Clásico)">OpenStreetMap (Clásico)</option>' +
                    '<option value="CartoDB Oscuro (Dark Matter)">CartoDB Oscuro (Dark Matter)</option>' +
                '</select>';
            L.DomEvent.disableClickPropagation(div);
            return div;
        };
        basemapControl.addTo(map);

        let currentBaseLayer = baseLayers['CartoDB Claro (Positron)'];

        function cambiarMapaBase(nombre) {
            if (baseLayers[nombre]) {
                map.removeLayer(currentBaseLayer);
                currentBaseLayer = baseLayers[nombre];
                currentBaseLayer.addTo(map);
            }
        }

        let markersLayer = L.layerGroup().addTo(map);
        let chartNivelInst, chartRegimenInst;

        function formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        }

        async function init() {
            try {
                let offset = 0;
                const limit = 1000; 
                const columnas = 'amie,nm_inst,geom,ciclo,id_grad,tp_sexo,tp_area,es_regeva,tp_sost';
                let keepFetching = true;
                const concurrency = 90; // Modo Turbo Seguro (9 hilos en paralelo)

                while (keepFetching) {
                    document.getElementById('loader-text').innerText = 'Descargando datos en modo optimizado... (' + formatNumber(rawData.length) + ' registros obtenidos)';
                    
                    let promises = [];
                    for (let i = 0; i < concurrency; i++) {
                        let currentOffset = offset + (i * limit);
                        let url = SUPABASE_URL + '/rest/v1/instituciones_educativas?select=' + columnas + '&limit=' + limit + '&offset=' + currentOffset;
                        
                        promises.push(
                            fetch(url, {
                                headers: { 
                                    'apikey': SUPABASE_KEY, 
                                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                                    'Accept': 'application/json' 
                                }
                            }).then(async res => {
                                if (!res.ok) {
                                    let errText = await res.text();
                                    throw new Error('HTTP ' + res.status + ': ' + errText);
                                }
                                return res.json();
                            })
                        );
                    }

                    let results = await Promise.all(promises);
                    let fetchedAny = false;

                    for (let chunk of results) {
                        if (chunk.length > 0) {
                            rawData = rawData.concat(chunk);
                            fetchedAny = true;
                        }
                        if (chunk.length < limit) {
                            keepFetching = false;
                        }
                    }

                    if (!fetchedAny) {
                        keepFetching = false;
                    }

                    offset += (limit * concurrency);
                }
                
                document.getElementById('loader-text').innerText = 'Procesando tablero...';
                
                llenarFiltrosEstáticos();
                aplicarFiltros(); 
                
                document.getElementById('loader').style.display = 'none';
            } catch (error) {
                document.querySelector('.spinner').style.display = 'none';
                document.getElementById('loader-text').innerText = "¡Ocurrió un error al conectar con la base de datos!";
                document.getElementById('error-details').innerText = error.message;
                console.error(error);
            }
        }

        function getUniqueValues(key) {
            return [...new Set(rawData.map(item => item[key]).filter(v => v !== null && v !== ''))].sort();
        }

        function llenarFiltrosEstáticos() {
            const poblarSelect = (id, valores, mapFunc = null) => {
                const select = document.getElementById(id);
                const defaultOption = select.querySelector('option');
                select.innerHTML = '';
                select.appendChild(defaultOption);

                valores.forEach(val => {
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = mapFunc ? (mapFunc[val] || val) : val;
                    select.appendChild(option);
                });
            };

            const provinciasUnicas = [...new Set(rawData.map(item => item.amie ? item.amie.substring(0, 2) : '').filter(v => PROVINCIA_MAP[v]))].sort();
            const selectProv = document.getElementById('filtro_provincia');
            const defProvOpt = selectProv.querySelector('option');
            selectProv.innerHTML = '';
            selectProv.appendChild(defProvOpt);
            provinciasUnicas.forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = code + ' - ' + PROVINCIA_MAP[code];
                selectProv.appendChild(option);
            });

            poblarSelect('filtro_ciclo', getUniqueValues('ciclo'));
            poblarSelect('filtro_nivel', getUniqueValues('id_grad'), NIVELES_MAP);
            poblarSelect('filtro_area', getUniqueValues('tp_area'));
            poblarSelect('filtro_regimen', getUniqueValues('es_regeva'));
            poblarSelect('filtro_sost', getUniqueValues('tp_sost'));
        }

        function aplicarFiltros() {
            const vCiclo = document.getElementById('filtro_ciclo').value;
            const vProvincia = document.getElementById('filtro_provincia').value;
            const vNivel = document.getElementById('filtro_nivel').value;
            const vArea = document.getElementById('filtro_area').value;
            const vRegimen = document.getElementById('filtro_regimen').value;
            const vSost = document.getElementById('filtro_sost').value;
            const vNombre = document.getElementById('filtro_nombre').value.toUpperCase().trim();

            let dataFiltradaPorCombos = rawData.filter(d => {
                const provCode = d.amie ? d.amie.substring(0, 2) : '';
                return (vCiclo === 'ALL' || d.ciclo == vCiclo) &&
                       (vProvincia === 'ALL' || provCode === vProvincia) &&
                       (vNivel === 'ALL' || d.id_grad == vNivel) &&
                       (vArea === 'ALL' || d.tp_area == vArea) &&
                       (vRegimen === 'ALL' || d.es_regeva == vRegimen) &&
                       (vSost === 'ALL' || d.tp_sost == vSost);
            });

            const listaNombres = document.getElementById('lista_nombres');
            listaNombres.innerHTML = '';
            const nombresUnicos = [...new Set(dataFiltradaPorCombos.map(item => item.nm_inst).filter(v => v !== null && v !== ''))].sort();
            nombresUnicos.forEach(nombre => {
                const option = document.createElement('option');
                option.value = nombre;
                listaNombres.appendChild(option);
            });

            filteredData = dataFiltradaPorCombos.filter(d => {
                const nombreInst = (d.nm_inst || '').toUpperCase();
                return (vNombre === '' || nombreInst.includes(vNombre));
            });

            actualizarDashboard();
        }

        function actualizarDashboard() {
            let amiesSet = new Set();
            let totalMasc = 0;
            let totalFem = 0;
            
            let conteoNivel = {};
            let conteoRegimen = {};
            let ieMapData = {};

            filteredData.forEach(row => {
                amiesSet.add(row.amie);
                
                const sexo = (row.tp_sexo || '').toString().toUpperCase();
                if (sexo.startsWith('M') || sexo === 'HOMBRE' || sexo === '1') totalMasc++;
                else if (sexo.startsWith('F') || sexo === 'MUJER' || sexo === '2' || sexo.startsWith('W')) totalFem++;
                else totalMasc++;

                const nivelStr = NIVELES_MAP[row.id_grad] || 'Desconocido';
                conteoNivel[nivelStr] = (conteoNivel[nivelStr] || 0) + 1;

                const regimenStr = row.es_regeva || 'Sin Dato';
                conteoRegimen[regimenStr] = (conteoRegimen[regimenStr] || 0) + 1;

                if (!ieMapData[row.amie]) {
                    const provCode = row.amie ? row.amie.substring(0, 2) : '';
                    const provName = PROVINCIA_MAP[provCode] || 'N/A';
                    ieMapData[row.amie] = {
                        amie: row.amie,
                        nombre: row.nm_inst,
                        geom: row.geom,
                        nivelPrincipal: nivelStr,
                        area: row.tp_area || 'N/A',
                        regimen: row.es_regeva || 'N/A',
                        sost: row.tp_sost || 'N/A',
                        provincia: provCode + ' - ' + provName,
                        total: 0
                    };
                }
                ieMapData[row.amie].total++;
            });

            document.getElementById('kpi_ie').innerText = formatNumber(amiesSet.size);
            document.getElementById('kpi_estudiantes').innerText = formatNumber(filteredData.length);
            document.getElementById('kpi_masc').innerText = formatNumber(totalMasc);
            document.getElementById('kpi_fem').innerText = formatNumber(totalFem);

            markersLayer.clearLayers();
            Object.values(ieMapData).forEach(ie => {
                if (!ie.geom) return;
                
                let lat, lng;
                try {
                    let g = typeof ie.geom === 'string' ? JSON.parse(ie.geom) : ie.geom;
                    if(g.coordinates) {
                        lng = g.coordinates[0];
                        lat = g.coordinates[1];
                    }
                } catch(e) { return; }

                if (lat && lng) {
                    const color = COLORES_LABEL[ie.nivelPrincipal] || COLORES_LABEL['Desconocido'];
                    const marker = L.circleMarker([lat, lng], {
                        radius: 5,
                        fillColor: color,
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                    
                    const popupContent = '<div class="custom-popup">' +
                        '<div class="popup-header">' + ie.nombre + '</div>' +
                        '<div class="popup-body">' +
                            '<div class="popup-row"><span class="popup-label">AMIE</span><span class="popup-value">' + ie.amie + '</span></div>' +
                            '<div class="popup-row"><span class="popup-label">PROVINCIA</span><span class="popup-value">' + ie.provincia + '</span></div>' +
                            '<div class="popup-row"><span class="popup-label">SOSTENIMIENTO</span><span class="popup-value">' + ie.sost + '</span></div>' +
                            '<div class="popup-row"><span class="popup-label">RÉGIMEN</span><span class="popup-value">' + ie.regimen + '</span></div>' +
                            '<div class="popup-row"><span class="popup-label">ÁREA</span><span class="popup-value">' + ie.area + '</span></div>' +
                            '<div class="popup-section-title">EVALUACIÓN SER ESTUDIANTE</div>' +
                            '<div class="popup-row">' +
                                '<span class="popup-label">ESTUDIANTES EVALUADOS</span>' +
                                '<span class="popup-value" style="color: var(--primary-blue); font-size: 12px;">' + formatNumber(ie.total) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                    
                    marker.bindPopup(popupContent, { 
                        className: 'custom-popup-wrapper' 
                    });
                    markersLayer.addLayer(marker);
                }
            });

            const labelsNivel = Object.keys(conteoNivel);
            const dataNivel = Object.values(conteoNivel);
            const colorsNivel = labelsNivel.map(label => COLORES_LABEL[label] || '#ccc');

            const labelsRegimen = Object.keys(conteoRegimen);
            const dataRegimen = Object.values(conteoRegimen);
            const colorsRegimen = labelsRegimen.map(label => COLORES_REGIMEN[label.toUpperCase()] || '#8e44ad');

            actualizarGrafico('chartNivel', labelsNivel, dataNivel, colorsNivel, 0);
            actualizarGrafico('chartRegimen', labelsRegimen, dataRegimen, colorsRegimen, 18);
        }

        function actualizarGrafico(canvasId, labels, data, colors, paddingBottom) {
            const ctx = document.getElementById(canvasId).getContext('2d');

            if (window[canvasId + 'Inst']) {
                window[canvasId + 'Inst'].destroy();
            }

            window[canvasId + 'Inst'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            bottom: paddingBottom
                        }
                    },
                    plugins: {
                        legend: { 
                            position: 'bottom', 
                            labels: { boxWidth: 10, font: {size: 10} } 
                        },
                        datalabels: {
                            color: '#fff',
                            font: { weight: 'bold', size: 9 },
                            formatter: (value, ctx) => {
                                let sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                let percentage = (value * 100 / sum).toFixed(1) + "%";
                                return (value * 100 / sum) < 3 ? null : percentage;
                            }
                        }
                    },
                    cutout: '55%'
                }
            });
        }

        const legend = L.control({position: 'bottomleft'});
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML += '<h4>Simbología (Subnivel)</h4>';
            
            const ordenSimbologia = ['Bachillerato', 'Básica Elemental', 'Básica Media', 'Básica Superior'];
            
            ordenSimbologia.forEach(label => {
                div.innerHTML += '<div><i style="background: ' + COLORES_LABEL[label] + '"></i> ' + label + '</div><div style="clear:both;"></div>';
            });
            return div;
        };
        legend.addTo(map);

        window.onload = init;
