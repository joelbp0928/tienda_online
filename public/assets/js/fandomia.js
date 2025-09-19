// Mock para maquetación (luego vendrá Supabase)
const MOCK = [
  { id:1, name:"Aretes Pixel Heart", price:19900, img:"/assets/img/aretes.jpg", tag:"Nuevo" },
  { id:2, name:"Llavero Katana",     price:12900, img:"/assets/img/llavero.jpg" },
  { id:3, name:"Pin Estrella",       price: 9900, img:"/assets/img/pin.jpg", tag:"Drop" },
  { id:4, name:"Sticker Holo Pack",  price: 8900, img:"/assets/img/stickers.jpg" }
];
const money = c => `$${(c/100).toFixed(2)} MXN`;

function render(){
  const y = document.getElementById('y'); if(y) y.textContent = new Date().getFullYear();
  const grid = document.getElementById('grid'); if(!grid) return;
  grid.innerHTML = '';
  MOCK.forEach(p=>{
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    col.innerHTML = `
      <div class="card card-dark h-100 position-relative">
        ${p.tag ? `<span class="badge text-bg-light text-dark position-absolute m-2">${p.tag}</span>` : ''}
        <img class="card-img-top" src="${p.img}" alt="${p.name}" onerror="this.src='https://picsum.photos/seed/${p.id}/600/600'">
        <div class="card-body d-flex flex-column">
          <h3 class="h6 mb-2">${p.name}</h3>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <span class="price">${money(p.price)}</span>
            <button class="btn btn-accent btn-sm" data-id="${p.id}">Agregar</button>
          </div>
        </div>
      </div>`;
    grid.appendChild(col);
  });
}
render();


/* ---------- MOCK DE EVENTOS (luego lo leeremos de Supabase) ---------- */
const EVENTS = [
  {
    id: 'ev1',
    name: 'Anime Fest CDMX',
    date: '2025-10-05',
    place: 'World Trade Center',
    img: '/assets/img/event-anime.jpg',
    cta: '/eventos.html#anime-fest',
    note: 'Pre-orden disponible'
  },
  {
    id: 'ev2',
    name: 'Indie Music Market',
    date: '2025-10-19',
    place: 'Parque México',
    img: '/assets/img/event-indie.jpg',
    cta: '/eventos.html#indie-market',
    note: 'Entrega en punto de encuentro'
  },
  {
    id: 'ev3',
    name: 'Expo Fandom',
    date: '2025-11-02',
    place: 'Centro City Banamex',
    img: '/assets/img/event-fandom.jpg',
    cta: '/eventos.html#expo-fandom',
    note: 'Drop edición limitada'
  }
];

/* ---------- RENDER DEL CARRUSEL ---------- */
function renderEventsCarousel(){
  const slides = document.getElementById('eventSlides');
  const indicators = document.getElementById('eventIndicators');
  if(!slides || !indicators) return;

  slides.innerHTML = '';
  indicators.innerHTML = '';

  EVENTS.forEach((ev, idx) => {
    const item = document.createElement('div');
    item.className = 'carousel-item' + (idx === 0 ? ' active' : '');
    item.innerHTML = `
      <div class="event-card">
        <div class="event-media" style="background-image:url('${ev.img}');"></div>
        <div class="event-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start">
            <h3 class="h4 mb-2">${ev.name}</h3>
            <span class="badge rounded-pill">${ev.note ?? ''}</span>
          </div>
          <p class="mb-1 text-muted-2"><i class="bi bi-calendar-event"></i> ${formatDate(ev.date)}</p>
          <p class="mb-3 text-muted-2"><i class="bi bi-geo-alt"></i> ${ev.place}</p>
          <div class="mt-auto d-flex gap-2">
            <a class="btn btn-accent" href="${ev.cta}">Detalles</a>
            <a class="btn btn-outline-light" href="/catalogo.html?cat=playeras&evento=${encodeURIComponent(ev.name)}">Ver playeras del evento</a>
          </div>
        </div>
      </div>`;
    slides.appendChild(item);

    const li = document.createElement('button');
    li.type = 'button';
    li.setAttribute('data-bs-target', '#eventCarousel');
    li.setAttribute('data-bs-slide-to', String(idx));
    if(idx === 0) li.className = 'active';
    li.ariaLabel = ev.name;
    indicators.appendChild(li);
  });
}

function formatDate(iso){
  // dd MMM yyyy en español
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

/* ---------- INIT ---------- */
(function init(){
  // ... lo que ya tengas (render de productos, newsletter, etc.)
  renderEventsCarousel();
})();
