// Datos fake para maquetación. Luego los traeremos de Supabase.
const MOCK_PRODUCTS = [
  { id:1, name:"K-pop Neon Tee", price:34900, img:"/assets/img/p1.jpg", tag:"Nuevo" },
  { id:2, name:"Indie MX Tour", price:32900, img:"/assets/img/p2.jpg" },
  { id:3, name:"Anime Panel Tote", price:21900, img:"/assets/img/p3.jpg", tag:"Drop" },
  { id:4, name:"Festival Gradient Cap", price:25900, img:"/assets/img/p4.jpg" },
  { id:5, name:"Retro Series Tee", price:34900, img:"/assets/img/p5.jpg" },
  { id:6, name:"Sticker Pack v1", price:9900,  img:"/assets/img/p6.jpg" },
  { id:7, name:"Cine Nights Tee", price:34900, img:"/assets/img/p7.jpg" },
  { id:8, name:"Minimal Line Tote", price:19900, img:"/assets/img/p8.jpg" },
];

const money = cents => `$${(cents/100).toFixed(2)} MXN`;

function renderProducts(list){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  list.forEach(p => {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    col.innerHTML = `
      <div class="card h-100 card-product position-relative">
        ${p.tag ? `<span class="badge text-bg-dark badge-drop">${p.tag}</span>` : ''}
        <img class="card-img-top" src="${p.img}" alt="${p.name}" onerror="this.src='https://picsum.photos/seed/${p.id}/600/600'">
        <div class="card-body d-flex flex-column">
          <h3 class="h6 mb-2">${p.name}</h3>
          <div class="mt-auto d-flex justify-content-between align-items-center">
            <span class="price">${money(p.price)}</span>
            <button class="btn btn-sm btn-dark" data-id="${p.id}"><i class="bi bi-plus-lg"></i></button>
          </div>
        </div>
      </div>`;
    grid.appendChild(col);
  });

  // eventos de "agregar"
  grid.querySelectorAll('button[data-id]').forEach(btn=>{
    btn.addEventListener('click', () => {
      addToCart(btn.getAttribute('data-id'));
    });
  });
}

function addToCart(id){
  // carrito mínimo en localStorage
  const key = 'cart';
  const cart = JSON.parse(localStorage.getItem(key) || '[]');
  const prod = MOCK_PRODUCTS.find(p => p.id == id);
  const existing = cart.find(i => i.id == prod.id);
  if(existing) existing.qty += 1;
  else cart.push({ id: prod.id, name: prod.name, price: prod.price, qty: 1 });
  localStorage.setItem(key, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount(){
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const total = cart.reduce((s,i)=> s + i.qty, 0);
  const badge = document.getElementById('cartCount');
  if(badge) badge.textContent = total;
}

function setupSearch(){
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('btnSearch');
  const doSearch = () => {
    const q = (input.value || '').trim().toLowerCase();
    if(!q) return renderProducts(MOCK_PRODUCTS);
    const filtered = MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(q));
    renderProducts(filtered);
  };
  btn.addEventListener('click', doSearch);
  input.addEventListener('keyup', e => { if(e.key === 'Enter') doSearch(); });
}

(function init(){
  document.getElementById('y').textContent = new Date().getFullYear();
  renderProducts(MOCK_PRODUCTS);
  updateCartCount();
  setupSearch();

  // Newsletter fake
  const form = document.getElementById('formNews');
  if(form){
    form.addEventListener('submit', ()=>{
      const email = document.getElementById('newsEmail').value.trim();
      if(email) alert('¡Gracias por suscribirte! (maqueta)');
    });
  }
})();