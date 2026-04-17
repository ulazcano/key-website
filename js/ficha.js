// === ALQUIMIA — La Vitrina (Property Detail) ===

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

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
});

function renderFicha(p) {
  lbImages = [
    { src: p.imagenes.hero, label: 'Principal' },
    ...p.imagenes.thumbnails.map((src, i) => ({ src, label: `Foto ${i + 2}` })),
    ...p.imagenes.galeria
  ];

  document.title = `${p.titulo} \u2014 ${p.direccion} | Alquimia`;

  const statsLine = [
    p.dormitorios ? `${p.dormitorios} dormitorios` : null,
    p.banos ? `${p.banos} ba\u00f1os` : null,
    p.superficie_util ? `${p.superficie_util} m\u00b2` : null,
    p.piso ? `piso ${p.piso.split(' ')[0]}` : null,
    p.estacionamientos ? `${p.estacionamientos} estac.` : null
  ].filter(Boolean).join(' <span class="vt-stat-sep"></span> ');

  const wrapper = document.getElementById('ficha-wrapper');
  wrapper.innerHTML = `
    <!-- 1. HERO FULL-BLEED -->
    <section class="vt-hero" onclick="openLb(0)" style="cursor:pointer">
      <img class="vt-hero-img" src="${p.imagenes.hero}" alt="${p.titulo}">
      <div class="vt-hero-scrim"></div>
      <div class="vt-hero-content">
        <span class="vt-hero-eyebrow">${p.operacion}</span>
        <h1 class="vt-hero-title">${p.titulo}</h1>
        <p class="vt-hero-address">${p.direccion}</p>
      </div>
      ${p.estado ? `<span class="vt-hero-badge">${p.estado}</span>` : ''}
    </section>

    <!-- 2. PRICE + STATS RIBBON -->
    <section class="vt-ribbon">
      <div class="vt-ribbon-inner">
        <div class="vt-price">${p.precio_formato}</div>
        <div class="vt-price-sub">Precio de ${p.operacion.toLowerCase()}${p.gastos_comunes ? ` &middot; GC ${p.gastos_comunes}` : ''}</div>
        <div class="vt-stats-line">${statsLine}</div>
      </div>
    </section>

    <!-- 3. EDITORIAL ZONE -->
    <section class="vt-editorial">
      <div class="vt-editorial-inner">
        <div class="vt-content">
          <blockquote class="vt-pullquote">${p.highlight}</blockquote>
          <div class="vt-desc">${p.descripcion}</div>
          <div class="vt-tags">
            ${p.tags.map(t => `<span class="vt-tag ${t.tipo === 'gold' ? 'vt-tag-gold' : ''}">${t.icono} ${t.texto}</span>`).join('')}
          </div>
        </div>
        <aside class="vt-agent-sidebar">
          <div class="vt-agent-card">
            <div class="vt-agent-eyebrow">Tu agente</div>
            <div class="vt-agent-name">${p.agente.nombre}</div>
            <div class="vt-agent-info">${p.agente.telefono}</div>
            <div class="vt-agent-info">${p.agente.email}</div>
            <a href="https://wa.me/${p.agente.whatsapp.replace('+','')}" class="vt-agent-wa" target="_blank">WhatsApp</a>
            <a href="tel:${p.agente.telefono}" class="vt-agent-call">Llamar</a>
          </div>
        </aside>
      </div>
    </section>

    <!-- 4. PHOTO STRIP -->
    <section class="vt-photos-section">
      <div class="vt-photos-header">
        <span class="vt-section-eyebrow">Recorrido</span>
        <span class="vt-photos-count">${p.imagenes.galeria.length} fotos</span>
      </div>
      <div class="vt-photo-strip">
        ${p.imagenes.galeria.map((img, i) => `
          <div class="vt-photo-item" onclick="openLb(${p.imagenes.thumbnails.length + 1 + i})">
            <img src="${img.src}" alt="${img.label}" loading="lazy">
            <span class="vt-photo-label">${img.label}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- 5. DETAILS (collapsible) -->
    <section class="vt-details">
      <div class="vt-details-inner">
        <details class="vt-detail-group" open>
          <summary class="vt-detail-summary">Caracter\u00edsticas</summary>
          <div class="vt-detail-body">
            <div class="vt-chars">
              ${p.caracteristicas.map(c => `<div class="vt-char-item">${c}</div>`).join('')}
            </div>
          </div>
        </details>
        <details class="vt-detail-group">
          <summary class="vt-detail-summary">Ficha t\u00e9cnica</summary>
          <div class="vt-detail-body">
            <table class="vt-table">
              ${p.ficha_tecnica.map(f => `<tr><td>${f.campo}</td><td>${f.valor}</td></tr>`).join('')}
            </table>
          </div>
        </details>
        ${p.servicios_edificio && p.servicios_edificio.length > 0 ? `
        <details class="vt-detail-group">
          <summary class="vt-detail-summary">Servicios del edificio</summary>
          <div class="vt-detail-body">
            <div class="vt-services">
              ${p.servicios_edificio.map(s => `<div class="vt-serv-item"><span class="vt-serv-icon">${s.icono}</span>${s.nombre}</div>`).join('')}
            </div>
          </div>
        </details>` : ''}
      </div>
    </section>

    <!-- 6. TRANSPORT BAND -->
    ${p.transporte && p.transporte.length > 0 ? `
    <section class="vt-transport">
      <div class="vt-transport-inner">
        <span class="vt-section-eyebrow" style="color:var(--oro)">Conectividad</span>
        <div class="vt-transport-list">
          ${p.transporte.map(t => `
            <div class="vt-transport-item">
              <span class="vt-transport-badge ${t.tipo === 'metro' ? 'vt-metro' : 'vt-bus'}">${t.tipo === 'metro' ? 'Metro' : 'Bus'}</span>
              <span class="vt-transport-name">${t.nombre}</span>
              <span class="vt-transport-dist">${t.distancia} &middot; ${t.tiempo}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>` : ''}

    <!-- 7. FINAL CTA -->
    <section class="vt-final-cta">
      <div class="vt-final-inner">
        <span class="vt-section-eyebrow" style="color:var(--oro)">Interesado en esta propiedad?</span>
        <div class="vt-final-agent">${p.agente.nombre}</div>
        <div class="vt-final-btns">
          <a href="https://wa.me/${p.agente.whatsapp.replace('+','')}" class="cta-primary" target="_blank">WhatsApp</a>
          <a href="tel:${p.agente.telefono}" class="cta-secondary">Llamar</a>
        </div>
        <div class="vt-final-brand">ALQUIMIA</div>
      </div>
    </section>
  `;

  // Scroll-reveal
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('vt-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.vt-ribbon, .vt-editorial, .vt-photos-section, .vt-details, .vt-transport, .vt-final-cta').forEach(el => {
    el.classList.add('vt-reveal');
    observer.observe(el);
  });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = 'index.html'; return; }
  if (!propiedades || propiedades.length === 0) await cargarPropiedades();
  const propiedad = propiedades.find(p => p.id === id);
  if (!propiedad) {
    document.getElementById('ficha-wrapper').innerHTML =
      '<div class="no-results">Propiedad no encontrada. <a href="index.html">Volver</a></div>';
    return;
  }
  renderFicha(propiedad);
});
