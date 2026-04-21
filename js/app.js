// === ALQUIMIA — Main App ===

let propiedades = [];
let ufValue = null;

// --- UF: fetch today's value ---
async function cargarUF() {
  try {
    const res = await fetch('https://mindicador.cl/api/uf');
    const data = await res.json();
    ufValue = data.serie[0].valor;
    console.log('UF loaded:', ufValue);
  } catch (e) {
    console.warn('UF API failed, using fallback:', e.message);
    ufValue = 40000; // fallback approximation
  }
}

function formatCLP(n) {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function formatUF(n) {
  return n.toLocaleString('es-CL', { maximumFractionDigits: 0 }) + ' UF';
}

function mainPrice(precio, moneda) {
  if (moneda === 'UF') return formatUF(precio);
  if (moneda === 'USD') return 'USD ' + Math.round(precio).toLocaleString('es-CL');
  return formatCLP(precio);
}

function dualPrice(precio, moneda) {
  if (!ufValue || !precio) return '';
  if (moneda === 'UF') {
    return `<span class="price-secondary">${formatCLP(precio * ufValue)}</span>`;
  }
  if (moneda === 'CLP') {
    return `<span class="price-secondary">${formatUF(precio / ufValue)}</span>`;
  }
  return '';
}

async function cargarPropiedades() {
  const res = await fetch('data/propiedades.json');
  propiedades = await res.json();
  return propiedades;
}

// --- HOME: Render property cards ---
function renderCards(lista) {
  const grid = document.getElementById('properties-grid');
  if (!grid) return;

  if (lista.length === 0) {
    grid.innerHTML = '<div class="no-results">No se encontraron propiedades con esos filtros.</div>';
    return;
  }

  grid.innerHTML = lista.map(p => `
    <a href="propiedad.html?id=${p.id}" class="property-card">
      <div class="card-img-wrap">
        <img src="${p.imagenes.hero}" alt="${p.titulo}" loading="lazy">
        ${p.estado ? `<span class="card-badge">${p.estado}</span>` : ''}
        <span class="card-op">${p.operacion}</span>
      </div>
      <div class="card-body">
        <div class="card-price">${mainPrice(p.precio, p.moneda)} ${dualPrice(p.precio, p.moneda)}</div>
        <div class="card-address">${p.direccion}</div>
        <div class="card-stats">
          <div class="card-stat"><span>${p.dormitorios}</span> dorm.</div>
          <div class="card-stat"><span>${p.banos}</span> ba&ntilde;os</div>
          <div class="card-stat"><span>${p.superficie_util}</span> m&sup2;</div>
          <div class="card-stat"><span>${p.estacionamientos}</span> estac.</div>
        </div>
      </div>
    </a>
  `).join('');
}

// --- HOME: Populate comuna filter ---
function poblarComunas() {
  const select = document.getElementById('search-comuna');
  if (!select) return;
  const comunas = [...new Set(propiedades.map(p => p.comuna))].sort();
  comunas.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

// --- HOME: Filter ---
function filtrarPropiedades() {
  const operacion = document.getElementById('search-operacion').value;
  const tipo = document.getElementById('search-tipo').value;
  const comuna = document.getElementById('search-comuna').value;
  const dorms = parseInt(document.getElementById('search-dormitorios').value) || 0;

  const resultado = propiedades.filter(p => {
    if (operacion && p.operacion !== operacion) return false;
    if (tipo && p.tipo !== tipo) return false;
    if (comuna && p.comuna !== comuna) return false;
    if (dorms && p.dormitorios < dorms) return false;
    return true;
  });

  renderCards(resultado);

  document.getElementById('propiedades').scrollIntoView({ behavior: 'smooth' });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([cargarPropiedades(), cargarUF()]);

  // If on home page
  if (document.getElementById('properties-grid')) {
    renderCards(propiedades);
    poblarComunas();
  }
});
