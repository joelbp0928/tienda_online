import supabase from './supabase-config.js';

import "./chatBot.js";

const $ = (sel) => document.querySelector(sel);
const money = v => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN' }).format(v);

function getSlug() {
  const params = new URLSearchParams(location.search);
  return params.get('slug') || '';
}

async function fetchProductBySlug(slug) {
  // info general del producto
  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, slug, description, category_id')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(error.message);

  // imágenes
  const { data: images } = await supabase
    .from('product_images')
    .select('url, sort_order')
    .eq('product_id', product.id)
    .order('sort_order');

  // variantes disponibles (talla/color/stock/precio)
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color, price, stock')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .gt('stock', 0)
    .order('price');

  return { product, images: images || [], variants: variants || [] };
}

function render({ product, images, variants }) {
  const img = images?.[0]?.url || `https://picsum.photos/seed/${product.id}/900/900`;

  const variantOptions = variants.map(v => `
    <option value="${v.id}">
      ${[v.size, v.color].filter(Boolean).join(' / ') || 'Única'} — ${money(v.price)} — Stock ${v.stock}
    </option>
  `).join('') || `<option disabled>No hay variantes con stock</option>`;

  $('#view').innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <div class="card">
          <img src="${img}" class="card-img-top" alt="${product.name}">
        </div>
        <div class="d-flex gap-2 mt-2 flex-wrap">
          ${images.slice(0,6).map(i => `
            <img src="${i.url}" width="72" height="72" class="rounded border" style="object-fit:cover;cursor:pointer"
                 onclick="document.querySelector('.card-img-top').src='${i.url}'">
          `).join('')}
        </div>
      </div>
      <div class="col-md-6">
        <h1 class="h3">${product.name}</h1>
        <p class="text-secondary">${product.description || ''}</p>

        <label class="form-label mt-2">Variantes / Tallas</label>
        <select id="variant" class="form-select form-select-sm">${variantOptions}</select>

        <div class="d-flex align-items-center gap-2 mt-3">
          <input id="qty" type="number" min="1" value="1" class="form-control form-control-sm" style="max-width:100px">
          <button id="add" class="btn btn-light btn-sm">
            <i class="bi bi-bag-plus"></i> Agregar al carrito
          </button>
        </div>

        <div class="mt-4">
          <a class="btn btn-outline-light btn-sm" href="./catalogo.html">Seguir comprando</a>
        </div>
      </div>
    </div>
  `;

  // handler de carrito mínimo (localStorage)
  $('#add').addEventListener('click', () => {
    const vId = Number($('#variant')?.value);
    const qty = Math.max(1, parseInt($('#qty').value || '1', 10));
    const key = 'cart';
    const cart = JSON.parse(localStorage.getItem(key) || '[]');

    // Si hay variantes, guardamos por variant_id; si no, por product_id
    const itemKey = vId ? `variant:${vId}` : `product:${product.id}`;
    const found = cart.find(i => i.key === itemKey);
    if (found) found.qty += qty;
    else cart.push({ key: itemKey, product_id: product.id, variant_id: vId || null, name: product.name, qty });

    localStorage.setItem(key, JSON.stringify(cart));
    alert('Producto agregado 🛒');
  });
}

(async function init(){
  try {
    const slug = getSlug();
    if (!slug) throw new Error('Producto no especificado');
    const data = await fetchProductBySlug(slug);
    render(data);
  } catch (e) {
    $('#view').innerHTML = `<div class="alert alert-danger">No se pudo cargar el producto: ${e.message}</div>`;
    console.error(e);
  }
})();
