import supabase from "./supabase-config.js";
import "./chatBot.js";

import { renderQuickCategories } from "./categories-ui.js";

const money = cents => `$${(cents / 100).toFixed(2)} MXN`;

const DEMO_IMG = './img/demo-product.png';

const resolvePublic = (bucket, pathOrUrl) => {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = String(pathOrUrl).replace(new RegExp(`^${bucket}/`), '');
  return supabase.storage.from(bucket).getPublicUrl(clean).data.publicUrl;
};

async function loadStoreSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, topbar_text, hero_title, hero_subtitle, hero_image_url, logo_url')
    .eq('id', 1)
    .maybeSingle();

  if (error) { console.warn('store_settings error:', error.message); return null; }
  // Si no existe aún la fila, no rompas el home
  return data || {
    store_name: 'TIENDA',
    topbar_text: '',
    hero_title: '',
    hero_subtitle: '',
    hero_image_url: null,
    logo_url: null
  };
}

function applyStoreSettings(s) {
  if (!s) return;

  // Topbar
  const topbar = document.getElementById('topbarText');
  if (topbar) topbar.textContent = s.topbar_text || '';

  // Brand
  const brandName = document.getElementById('brandName');
  if (brandName) brandName.textContent = s.store_name || 'TIENDA';

  const logo = document.getElementById('brandLogo');
  if (logo) {
    const url = resolvePublic('branding', s.logo_url) || './img/radioear.png';
    logo.src = url;
    logo.onerror = () => { logo.src = './img/radioear.png'; };
  }

  // Hero text
  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) heroTitle.innerHTML = s.hero_title || '';

  const heroSubtitle = document.getElementById('heroSubtitle');
  if (heroSubtitle) heroSubtitle.textContent = s.hero_subtitle || '';

  // Hero image
  const heroImg = document.getElementById('heroImg');
  if (heroImg) {
    const url = resolvePublic('branding', s.hero_image_url) || './img/Collage_generico.png';
    heroImg.src = url;
    heroImg.onerror = () => { heroImg.src = './img/Collage_generico.png'; };
  }

  // (Opcional) categorías rápidas dinámicas:
  // si quieres, te hago el render para reemplazar la sección "Categorías rápidas" con s.quick_categories
}

const resolveCover = (url) => {
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url) {
    const clean = String(url).replace(/^products\//, '');
    return supabase.storage.from('products').getPublicUrl(clean).data.publicUrl;
  }
  return DEMO_IMG;
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
function setupSearch() {
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('btnSearch');
  const doSearch = async () => {
    const q = (input.value || '').trim();
    if (!q) return renderProducts(await fetchAllProducts());
    const list = await searchProductsByName(q);
    renderProducts(list);
  };
  btn.addEventListener('click', doSearch);
  input.addEventListener('keyup', e => { if (e.key === 'Enter') doSearch(); });
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

  const settings = await loadStoreSettings();
  applyStoreSettings(settings);
  
  await renderQuickCategories();
  // AHORA: muestra TODO el catálogo
  const list = await fetchAllProducts();
  renderProducts(list);


  setupSearch();

  // Newsletter fake (dejas igual)
  const form = document.getElementById('formNews');
  if (form) {
    form.addEventListener('submit', () => {
      const email = document.getElementById('newsEmail').value.trim();
      if (email) alert('¡Gracias por suscribirte! (maqueta)');
    });
  }
})();