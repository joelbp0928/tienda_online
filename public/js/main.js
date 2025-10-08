import supabase from "./supabase-config.js";
import "./chatBot.js";

const money = cents => `$${(cents / 100).toFixed(2)} MXN`;

// Resuelve la URL de portada (usa el mismo bucket que en catálogo)
const resolveCover = (url) => {
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url) return supabase.storage.from('products').getPublicUrl(url).data.publicUrl;
  return './img/demo-product.png'; // imagen fallback
};

// ========== QUERIES ==========
// View recomendada: public_catalog_grid (product_id, slug, name, price_from, variants_available, cover_url)
// Por ahora: TODO el catálogo (sin filtro destacado)
async function fetchAllProducts() {
  const { data, error } = await supabase
    .from('public_catalog_grid')
    .select('product_id, slug, name, price_from, cover_url')
    .order('product_id', { ascending: false });

  if (error) { console.error(error.message); return []; }
  return (data || []).map(p => ({
    id: p.product_id,
    slug: p.slug,
    name: p.name,
    price: p.price_from,
    img: resolveCover(p.cover_url),
  }));
}

// Más adelante: solo destacados
// Opciones: a) agregar un boolean "is_featured" en products; b) una tabla puente de destacados.
// Ejemplo asumiendo un campo booleano `is_featured` en otra vista o tabla:
async function fetchFeaturedProducts() {
  const { data, error } = await supabase
    .from('public_catalog_grid')
    .select('product_id, slug, name, price_from, cover_url, is_featured')
    .eq('is_featured', true)
    .order('product_id', { ascending: false });

  if (error) { console.error(error.message); return []; }
  return (data || []).map(p => ({
    id: p.product_id,
    slug: p.slug,
    name: p.name,
    price: p.price_from,
    img: resolveCover(p.cover_url),
  }));
}


// Búsqueda por nombre (para el buscador del navbar en home)
async function searchProductsByName(q) {
  const { data, error } = await supabase
    .from('public_catalog_grid')
    .select('product_id, slug, name, price_from, cover_url')
    .ilike('name', `%${q}%`)
    .order('product_id', { ascending: false });

  if (error) { console.error(error.message); return []; }
  return (data || []).map(p => ({
    id: p.product_id,
    slug: p.slug,
    name: p.name,
    price: p.price_from,
    img: resolveCover(p.cover_url),
  }));
}

function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';
  list.forEach(p => {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    col.innerHTML = `
      <a href="/html/producto.html?slug=${encodeURIComponent(p.slug)}" class="text-decoration-none text-light">
        <div class="card h-100 card-product position-relative">
          <img class="card-img-top" src="${p.img}" alt="${p.name}" onerror="this.src='./img/demo-product.png'">
          <div class="card-body d-flex flex-column">
            <h3 class="h6 mb-2">${p.name}</h3>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="price">${money(p.price)}</span>
              <span class="btn btn-sm btn-dark">Ver</span>
            </div>
          </div>
        </div>
      </a>`;
    grid.appendChild(col);
  });
}

// ========== SEARCH NAVBAR ==========
function setupSearch(){
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('btnSearch');
  const doSearch = async () => {
    const q = (input.value || '').trim();
    if(!q) return renderProducts(await fetchAllProducts());
    const list = await searchProductsByName(q);
    renderProducts(list);
  };
  btn.addEventListener('click', doSearch);
  input.addEventListener('keyup', e => { if(e.key === 'Enter') doSearch(); });
}

function addToCart(id) {
  // carrito mínimo en localStorage
  const key = 'cart';
  const cart = JSON.parse(localStorage.getItem(key) || '[]');
  const prod = MOCK_PRODUCTS.find(p => p.id == id);
  const existing = cart.find(i => i.id == prod.id);
  if (existing) existing.qty += 1;
  else cart.push({ id: prod.id, name: prod.name, price: prod.price, qty: 1 });
  localStorage.setItem(key, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = total;
}

(async function init() {
  document.getElementById('y').textContent = new Date().getFullYear();

    // AHORA: muestra TODO el catálogo
  const list = await fetchAllProducts();
  renderProducts(list);

  setupSearch();

  // Newsletter fake (dejas igual)
  const form = document.getElementById('formNews');
  if(form){
    form.addEventListener('submit', ()=>{
      const email = document.getElementById('newsEmail').value.trim();
      if(email) alert('¡Gracias por suscribirte! (maqueta)');
    });
  }
})();