import supabase from './supabase-config.js';

const money = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

async function fetchProducts(search = '') {
  let q = supabase
    .from('public_catalog')
    .select('product_id, slug, name, price_from, variants_available')
    .order('product_id', { ascending: false });

  if (search) q = q.ilike('name', `%${search}%`);
  const { data, error } = await q;
  if (error) { console.error(error.message); return []; }
  return data;
}

function render(list) {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  grid.innerHTML = '';
  if (!list.length) { empty.classList.remove('d-none'); return; }
  empty.classList.add('d-none');

  for (const p of list) {
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-3';
    const img = `https://picsum.photos/seed/${p.product_id}/600/600`;

    col.innerHTML = `
      <a href="producto.html?slug=${encodeURIComponent(p.slug)}" class="text-decoration-none text-light">
        <div class="card h-100">
          <img src="${img}" class="card-img-top" alt="${p.name}">
          <div class="card-body d-flex flex-column">
            <h3 class="h6 mb-1">${p.name}</h3>
            <small class="text-secondary mb-2">Desde ${money(p.price_from)} • ${p.variants_available} variantes</small>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="badge text-bg-dark w-100">Ver detalle</span>

            </div>
          </div>
        </div>
      </a>`;
    grid.appendChild(col);
  }
}

async function fetchVariants(productId) {
  const { data: variants, error } = await supabase
    .from('product_variants')
    .select('id, size, color, price, stock')
    .eq('product_id', productId)
    .gt('stock', 0)
    .eq('is_active', true)
    .order('price');

  if (error) {
    console.error('Error cargando variantes:', error.message);
    return [];
  }
  return variants || [];
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