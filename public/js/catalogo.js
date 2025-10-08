import supabase from './supabase-config.js';
import "./chatBot.js";

const money = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

// --- NUEVO: caché de imágenes por producto
const imageCache = new Map(); // product_id -> [urls]

async function fetchProducts(search = '') {
  let q = supabase
    .from('public_catalog_grid')
    .select('product_id, slug, name, price_from, variants_available, cover_url')
    .order('product_id', { ascending: false });

  if (search) q = q.ilike('name', `%${search}%`);
  const { data, error } = await q;
  if (error) { console.error(error.message); return []; }
  return data || [];
}

// resuelve URL de storage si guardaste solo la ruta
const resolveCover = (url) => {
  if (url && /^https?:\/\//i.test(url)) return url;           // ya es URL completa
  if (url) return supabase.storage.from('products').getPublicUrl(url).data.publicUrl;
  return '../img/demo-product.png'; // imagen por defecto
};

// renderiza productos en el grid
function render(list) {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  grid.innerHTML = '';
  if (!list.length) { empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  for (const p of list) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    const img = resolveCover(p.cover_url);

    col.innerHTML = `
      <a href="producto.html?slug=${encodeURIComponent(p.slug)}" class="text-decoration-none text-light">
        <div class="card h-100">
          <img src="${img}" class="card-img-top" alt="${p.name}" onerror="this.src='../img/demo-product.png'">
          <div class="card-body d-flex flex-column">
            <h3 class="h6 mb-1">${p.name}</h3>
            <small class="text-secondary mb-2">
              Desde ${money(p.price_from)} • ${p.variants_available} variantes
            </small>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="badge text-bg-dark w-100">Ver detalle</span>
            </div>
          </div>
        </div>
      </a>`;
    grid.appendChild(col);

    // Listeners de hover (mouseenter / mouseleave)
    const imgEl = col.querySelector('img.card-img-top');

    imgEl.addEventListener('mouseenter', async () => {
      const imgs = await fetchProductImages(p.product_id);
      if (imgs.length <= 1) return;
      // asegura que la primera del arreglo sea la portada actual para que la rotación incluya la cover
      const base = imgEl.dataset.baseSrc;
      let list = imgs;
      if (base && !imgs.includes(base)) list = [base, ...imgs];
      startHoverCycle(imgEl, list);
    });

    imgEl.addEventListener('mouseleave', () => {
      stopHoverCycle(imgEl);
    });
  }
}

// Trae hasta 6 imágenes ordenadas del producto
async function fetchProductImages(productId) {
  if (imageCache.has(productId)) return imageCache.get(productId);

  const { data, error } = await supabase
    .from('product_images')
    .select('url')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .limit(6);

  if (error) {
    console.error('Error cargando imágenes:', error.message);
    imageCache.set(productId, []); // cachea vacío para evitar spams
    return [];
  }

  const urls = (data || []).map(r => resolveCover(r.url)).filter(Boolean);
  imageCache.set(productId, urls);
  return urls;
}
// ciclo de hover
function startHoverCycle(imgEl, urls) {
  if (!urls || urls.length <= 1) return; // nada que rotar

  // evita dobles intervalos
  stopHoverCycle(imgEl);

  let i = 0;
  const baseSrc = imgEl.dataset.baseSrc || imgEl.src;

  imgEl._hoverTimer = setInterval(() => {
    i = (i + 1) % urls.length;
    const nextSrc = urls[i] || baseSrc;

    // pequeño fade
    imgEl.style.opacity = '0';
    const swap = () => {
      imgEl.removeEventListener('transitionend', swap);
      imgEl.src = nextSrc;
      // espera a que cargue para volver a 1 (si quieres evitar parpadeo)
      const onLoad = () => { imgEl.style.opacity = '1'; imgEl.removeEventListener('load', onLoad); };
      imgEl.addEventListener('load', onLoad);
    };
    imgEl.addEventListener('transitionend', swap);
  }, 680); // velocidad de rotación (ms)
}

function stopHoverCycle(imgEl) {
  if (imgEl._hoverTimer) {
    clearInterval(imgEl._hoverTimer);
    imgEl._hoverTimer = null;
  }
  // regresa a la imagen base
  const base = imgEl.dataset.baseSrc;
  if (base) imgEl.src = base;
}


async function load(search = '') {
  const data = await fetchProducts(search);
  render(data);
}

// eventos
document.getElementById('btnSearch').addEventListener('click', () => {
  const q = document.getElementById('q').value.trim();
  load(q);
});

document.getElementById('q').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') document.getElementById('btnSearch').click();
});

// inicio
load();