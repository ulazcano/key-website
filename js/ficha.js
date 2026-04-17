// === KEY PROPIEDADES — Ficha (Property Detail) ===

let lbImages = [];
let lbIndex = 0;

function openLb(index) {
  lbIndex = index;
  const lb = document.getElementById('lightbox');
  document.getElementById('lb-img').src = lbImages[lbIndex].src;
  document.getElementById('lb-caption').textContent = lbImages[lbIndex].label || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLb() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function lbNav(dir) {
  lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
  document.getElementById('lb-img').src = lbImages[lbIndex].src;
  document.getElementById('lb-caption').textContent = lbImages[lbIndex].label || '';
}

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
});

function renderFicha(p) {
  // Build lightbox image list: hero + thumbnails + gallery
  lbImages = [
    { src: p.imagenes.hero, label: 'Principal' },
    ...p.imagenes.thumbnails.map((src, i) => ({ src, label: `Foto ${i + 2}` })),
    ...p.imagenes.galeria
  ];

  // Update page title
  document.title = `${p.titulo} — ${p.direccion} | Key Propiedades`;

  const wrapper = document.getElementById('ficha-wrapper');
  wrapper.innerHTML = `
    <div class="ficha-card">
      <!-- HEADER -->
      <div class="ficha-header">
        <div class="ficha-hero-wrap" onclick="openLb(0)">
          <img src="${p.imagenes.hero}" alt="${p.titulo}">
          <div class="ficha-hero-overlay"></div>
          <div class="ficha-hero-price">
            <div class="ficha-price-main">${p.precio_formato}</div>
            <div class="ficha-price-sub">Precio de ${p.operacion.toLowerCase()}</div>
            ${p.gastos_comunes ? `<div class="ficha-price-gc">Gastos comunes ${p.gastos_comunes}</div>` : ''}
          </div>
          ${p.estado ? `<span class="ficha-badge">${p.estado}</span>` : ''}
        </div>
        <div class="thumb-grid">
          ${p.imagenes.thumbnails.map((src, i) => `
            <img src="${src}" alt="Foto ${i + 2}" onclick="openLb(${i + 1})" loading="lazy">
          `).join('')}
        </div>
      </div>

      <!-- BODY -->
      <div class="ficha-body">
        <div class="ficha-title">${p.titulo}</div>
        <div class="ficha-address">${p.direccion}</div>

        <!-- STATS -->
        <div class="ficha-stats">
          <div class="ficha-stat-box"><div class="ficha-stat-val">${p.dormitorios}</div><div class="ficha-stat-lbl">Dormitorios</div></div>
          <div class="ficha-stat-box"><div class="ficha-stat-val">${p.banos}</div><div class="ficha-stat-lbl">Ba&ntilde;os</div></div>
          <div class="ficha-stat-box"><div class="ficha-stat-val">${p.superficie_util}</div><div class="ficha-stat-lbl">m&sup2; &uacute;tiles</div></div>
          <div class="ficha-stat-box"><div class="ficha-stat-val">${p.piso.split(' ')[0]}</div><div class="ficha-stat-lbl">Piso</div></div>
          <div class="ficha-stat-box"><div class="ficha-stat-val">${p.estacionamientos}</div><div class="ficha-stat-lbl">Estac.</div></div>
        </div>

        <!-- HIGHLIGHT -->
        <div class="ficha-highlight">
          <div class="ficha-highlight-title">&#10022; Por qu&eacute; esta propiedad</div>
          <div class="ficha-highlight-text">${p.highlight}</div>
        </div>

        <!-- DESCRIPTION -->
        <div class="ficha-section-title">Descripci&oacute;n</div>
        <div class="ficha-desc">${p.descripcion}</div>

        <!-- ROOM GALLERY -->
        <div class="ficha-section-title">Recorrido por la propiedad</div>
        <div class="ficha-room-grid">
          ${p.imagenes.galeria.map((img, i) => `
            <div class="ficha-room-item" onclick="openLb(${p.imagenes.thumbnails.length + 1 + i})">
              <img src="${img.src}" alt="${img.label}" loading="lazy">
              <div class="ficha-room-label">${img.label}</div>
            </div>
          `).join('')}
        </div>

        <!-- CHARACTERISTICS -->
        <div class="ficha-section-title">Caracter&iacute;sticas</div>
        <div class="ficha-chars">
          ${p.caracteristicas.map(c => `<div class="ficha-char-item">${c}</div>`).join('')}
        </div>

        <!-- TAGS -->
        <div class="ficha-pills">
          ${p.tags.map(t => `<span class="ficha-pill ${t.tipo === 'gold' ? 'ficha-pill-gold' : ''}">${t.icono} ${t.texto}</span>`).join('')}
        </div>

        <!-- TECHNICAL SHEET -->
        <div class="ficha-section-title">Ficha t&eacute;cnica</div>
        <table class="ficha-table">
          ${p.ficha_tecnica.map(f => `<tr><td>${f.campo}</td><td>${f.valor}</td></tr>`).join('')}
        </table>

        <!-- BUILDING SERVICES -->
        ${p.servicios_edificio && p.servicios_edificio.length > 0 ? `
        <div class="ficha-section-title">Servicios del edificio</div>
        <div class="ficha-servicios">
          ${p.servicios_edificio.map(s => `
            <div class="ficha-serv-item"><span class="ficha-serv-icon">${s.icono}</span>${s.nombre}</div>
          `).join('')}
        </div>` : ''}

        <!-- TRANSPORT -->
        <div class="ficha-section-title">Conectividad y transporte</div>
        <ul class="ficha-metro-list">
          ${p.transporte.map(t => `
            <li class="ficha-metro-item">
              <span class="${t.tipo === 'metro' ? 'ficha-metro-badge' : 'ficha-bus-badge'}">${t.tipo === 'metro' ? 'Metro' : 'Bus'}</span>
              ${t.nombre}
              <span class="ficha-dist">${t.distancia} &middot; ${t.tiempo}</span>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- FOOTER -->
      <div class="ficha-footer">
        <div class="ficha-agent-name">${p.agente.nombre}</div>
        <div class="ficha-agent-contact">
          ${p.agente.telefono}<br>${p.agente.email}
        </div>
        <div class="ficha-cta-btns">
          <a href="https://wa.me/${p.agente.whatsapp.replace('+','')}" class="btn-wa" target="_blank">
            WhatsApp
          </a>
          <a href="tel:${p.agente.telefono}" class="btn-call">Llamar</a>
        </div>
        <div class="ficha-footer-brand">KEY PROPIEDADES</div>
      </div>
    </div>
  `;
}

// --- INIT FICHA ---
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = 'index.html';
    return;
  }

  // Wait for propiedades to load (from app.js)
  if (!propiedades || propiedades.length === 0) {
    await cargarPropiedades();
  }

  const propiedad = propiedades.find(p => p.id === id);

  if (!propiedad) {
    document.getElementById('ficha-wrapper').innerHTML =
      '<div class="no-results">Propiedad no encontrada. <a href="index.html">Volver al inicio</a></div>';
    return;
  }

  renderFicha(propiedad);
});
