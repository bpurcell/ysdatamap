// D3-based grid clustering over a US map with zoom/pan and interactive controls

(function () {
  const container = document.getElementById('map');
  const width = container.clientWidth || 960;
  const height = Math.round(width * 0.62);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const gMap = svg.append('g').attr('class', 'map-root');
  const gStates = gMap.append('g').attr('class', 'states');
  const gClusters = svg.append('g').attr('class', 'clusters'); // not zoom-transformed; positions are screen-space with zoom applied at compute time

  const projection = d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(Math.min(width, height) * 1.15);
  const geoPath = d3.geoPath().projection(projection);

  const state = {
    gridSize: 40,
    scaleMultiplier: 1.2,
    minSum: 1,
    transform: d3.zoomIdentity,
    data: [],
  };

  // Controls wiring
  const gridSizeEl = document.getElementById('gridSize');
  const gridSizeValueEl = document.getElementById('gridSizeValue');
  const scaleEl = document.getElementById('scaleMultiplier');
  const scaleValueEl = document.getElementById('scaleMultiplierValue');
  const minClusterEl = document.getElementById('minCluster');
  const minClusterValueEl = document.getElementById('minClusterValue');

  function syncControlLabels() {
    gridSizeValueEl.textContent = String(state.gridSize);
    scaleValueEl.textContent = `${Number(state.scaleMultiplier).toFixed(1)}×`;
    minClusterValueEl.textContent = `${state.minSum}+`;
  }

  gridSizeEl.addEventListener('input', () => {
    state.gridSize = Number(gridSizeEl.value);
    syncControlLabels();
    renderClusters();
  });

  scaleEl.addEventListener('input', () => {
    state.scaleMultiplier = Number(scaleEl.value);
    syncControlLabels();
    renderClusters();
  });

  minClusterEl.addEventListener('input', () => {
    state.minSum = Number(minClusterEl.value);
    syncControlLabels();
    renderClusters();
  });

  // Zoom behavior: transform background map group; clusters recomputed in screen space
  const zoom = d3
    .zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [width, height]])
    .on('zoom', (event) => {
      state.transform = event.transform;
      gMap.attr('transform', event.transform);
      renderClusters();
    });

  svg.call(zoom);

  // Data loading
  Promise.all([
    // CDN Topology for US (states)
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'),
    d3.csv('./datall.csv', d => ({
      address: d['Address'],
      state: d['State'],
      city: d['City'],
      // The CSV header has an exact column: "New customer records"
      value: d['New customer records'] ? +d['New customer records'] : 0,
      lat: d['Latitude'] ? +d['Latitude'] : undefined,
      lon: d['Longitude'] ? +d['Longitude'] : undefined,
    }))
  ]).then(([us, rows]) => {
    state.data = rows.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon) && Number.isFinite(r.value));
    const statesGeo = topojson.feature(us, us.objects.states);
    drawStates(statesGeo);
    syncControlLabels();
    renderClusters();
  }).catch(err => {
    console.error('Failed to load data', err);
  });

  function drawStates(geojson) {
    if (!geojson || !geojson.features) return;
    gStates
      .selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', geoPath);
  }

  function renderClusters() {
    if (!state.data.length) return;

    const t = state.transform || d3.zoomIdentity;
    const gridSize = Math.max(2, state.gridSize);

    const cellMap = new Map();

    for (const row of state.data) {
      const proj = projection([row.lon, row.lat]);
      if (!proj) continue; // projected outside view
      const [px, py] = t.apply(proj);
      const cx = Math.floor(px / gridSize);
      const cy = Math.floor(py / gridSize);
      const key = `${cx},${cy}`;
      let cell = cellMap.get(key);
      if (!cell) {
        cell = { key, cx, cy, sum: 0, count: 0, sx: 0, sy: 0 };
        cellMap.set(key, cell);
      }
      cell.sum += row.value;
      cell.count += 1;
      cell.sx += px;
      cell.sy += py;
    }

    let clusters = Array.from(cellMap.values()).map(c => ({
      key: c.key,
      x: c.sx / Math.max(1, c.count),
      y: c.sy / Math.max(1, c.count),
      sum: c.sum,
      count: c.count,
    }));

    clusters = clusters.filter(c => c.sum >= state.minSum);

    const maxSum = d3.max(clusters, d => d.sum) || 1;
    const rScale = d3.scaleSqrt().domain([0, maxSum]).range([3, 26]);

    const sel = gClusters.selectAll('g.cluster').data(clusters, d => d.key);

    const selEnter = sel.enter().append('g').attr('class', 'cluster');
    selEnter.append('circle');
    selEnter.append('text');

    const selAll = selEnter.merge(sel);

    selAll.attr('transform', d => `translate(${d.x},${d.y})`);

    selAll.select('circle')
      .attr('r', d => rScale(d.sum) * state.scaleMultiplier);

    selAll.select('text')
      .text(d => d.sum)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => Math.max(9, Math.min(18, rScale(d.sum) * 0.9)));

    sel.exit().remove();
  }

  // Handle window resize: recompute projection and redraw
  window.addEventListener('resize', () => {
    const newW = container.clientWidth || width;
    const newH = Math.round(newW * 0.62);
    svg.attr('viewBox', `0 0 ${newW} ${newH}`);
    projection.translate([newW / 2, newH / 2]).scale(Math.min(newW, newH) * 1.15);
    gStates.selectAll('path').attr('d', geoPath);
    renderClusters();
  });
})();


