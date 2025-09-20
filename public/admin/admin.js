// /admin/admin.js
import supabase from '../js/supabase-config.js';

// ---- Guard ----
async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = 'login.html'; return null; }

  // Verifica rol por RPC (no por select directo)
  const { data: role, error: roleErr } = await supabase.rpc('whoami_role');
  if (roleErr || !role || !['admin','owner'].includes(role)) {
    await supabase.auth.signOut();
    location.href = 'login.html';
    return null;
  }
  return { user, profile: { email: user.email, role } };
}

// ---- UI helpers ----
const $msg = (t='') => document.getElementById('msg').textContent = t;

// ---- Usuarios ----
async function listUsers(){
  const { data: list, error } = await supabase
    .from('profiles')
    .select('id,email,role,status,created_at')
    .order('created_at', { ascending:false });

  if (error) { $msg(error.message); return; }

  const wrap = document.getElementById('users');
  wrap.innerHTML = '';
  if(!list?.length){ wrap.innerHTML = '<p class="text-secondary">Sin usuarios.</p>'; return; }

  for(const u of list){
    const row = document.createElement('div');
    row.className = 'd-flex align-items-center justify-content-between border-bottom border-secondary py-2';
    row.innerHTML = `
      <div class="small">
        <div class="fw-semibold text-light">${u.email || '(sin email)'}</div>
        <div class="text-secondary">${u.role} · ${new Date(u.created_at).toLocaleString()}</div>
      </div>
      <div class="d-flex gap-2">
        ${['client','staff','admin','owner'].map(r =>
          `<button class="btn btn-sm ${u.role===r?'btn-light':'btn-outline-light'}" data-action="setRole" data-id="${u.id}" data-role="${r}">${r}</button>`
        ).join('')}
      </div>`;
    wrap.appendChild(row);
  }

  wrap.querySelectorAll('button[data-action="setRole"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id;
      const role = btn.dataset.role;
      await setRole(id, role);
    });
  });
}

async function setRole(userId, role){
  // Sólo permite si yo soy owner o admin (el guard ya lo valida)
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return $msg(error.message);
  $msg('Rol actualizado.');
  listUsers();
}

// ---- Productos (placeholder para la siguiente iteración) ----
let CATEGORIES = [];

// Utilidad: slug
const slugify = s => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita acentos
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

// Carga categorías para el <select>
async function loadCategories(){
  const { data, error } = await supabase.from('categories').select('id,name,slug').order('name');
  if (error) { $msg(error.message); return; }
  CATEGORIES = data || [];
  const sel = document.getElementById('prodCategory');
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// Listado de productos con acciones
async function listProducts(){
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,is_active,created_at')
    .order('id', { ascending:false })
    .limit(50);
  const wrap = document.getElementById('products');
  if (error) { wrap.innerHTML = `<div class="text-warning">${error.message}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = `<p class="text-secondary">Aún no hay productos.</p>`; return; }

  wrap.innerHTML = `<div class="table-responsive">
    <table class="table table-dark table-sm align-middle">
      <thead>
        <tr><th>ID</th><th>Slug</th><th>Nombre</th><th>Activo</th><th>Creado</th><th class="text-end">Acciones</th></tr>
      </thead>
      <tbody>
      ${data.map(p=>`
        <tr>
          <td>${p.id}</td>
          <td>${p.slug}</td>
          <td>${p.name}</td>
          <td>${p.is_active ? 'Sí':'No'}</td>
          <td>${new Date(p.created_at).toLocaleString()}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-light me-1" data-action="edit" data-id="${p.id}">Editar</button>
            <button class="btn btn-sm btn-outline-light me-1" data-action="variant" data-id="${p.id}">Variante +</button>
            <button class="btn btn-sm btn-outline-light me-1" data-action="image" data-id="${p.id}">Imagen +</button>
            <button class="btn btn-sm ${p.is_active?'btn-outline-warning':'btn-outline-success'}" data-action="toggle" data-id="${p.id}">
              ${p.is_active?'Desactivar':'Activar'}
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;

  // Handlers de acciones
  wrap.querySelectorAll('button[data-action]').forEach(btn=>{
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    if (action==='edit') btn.onclick = () => openProductModal(id);
    if (action==='variant') btn.onclick = () => openVariantModal(id);
    if (action==='image') btn.onclick = () => openImageModal(id);
    if (action==='toggle') btn.onclick = () => toggleProduct(id);
  });
}

// ----- PRODUCTO -----
const productModal = new bootstrap.Modal(document.getElementById('modalProduct'));
document.getElementById('btnNewProduct').addEventListener('click', ()=> openProductModal());

document.getElementById('prodName').addEventListener('input', (e)=>{
  const v = e.target.value;
  if (!document.getElementById('prodId').value) {
    document.getElementById('prodSlug').value = slugify(v);
  }
});

async function openProductModal(id){
  await loadCategories();
  document.getElementById('formProduct').reset();
  document.getElementById('prodId').value = id || '';
  document.getElementById('titleProduct').textContent = id ? 'Editar producto' : 'Nuevo producto';

  if (id){
    const { data, error } = await supabase.from('products')
      .select('id,name,slug,description,category_id,is_active').eq('id', id).single();
    if (error) return $msg(error.message);
    document.getElementById('prodName').value = data.name || '';
    document.getElementById('prodSlug').value = data.slug || '';
    document.getElementById('prodDesc').value = data.description || '';
    document.getElementById('prodCategory').value = data.category_id || (CATEGORIES[0]?.id || '');
    document.getElementById('prodActive').checked = !!data.is_active;
  } else {
    document.getElementById('prodCategory').value = CATEGORIES[0]?.id || '';
    document.getElementById('prodActive').checked = true;
  }
  productModal.show();
}

document.getElementById('formProduct').addEventListener('submit', saveProduct);

async function saveProduct(e){
  e.preventDefault(); $msg('');
  const id = document.getElementById('prodId').value;
  const payload = {
    name: document.getElementById('prodName').value.trim(),
    slug: slugify(document.getElementById('prodSlug').value.trim()),
    description: document.getElementById('prodDesc').value.trim(),
    category_id: Number(document.getElementById('prodCategory').value),
    is_active: document.getElementById('prodActive').checked
  };

  let error;
  if (id){
    ({ error } = await supabase.from('products').update(payload).eq('id', Number(id)));
  } else {
    ({ error } = await supabase.from('products').insert([payload]));
  }
  if (error) return $msg(error.message);

  productModal.hide();
  await listProducts();
}

async function toggleProduct(id){
  const { data, error } = await supabase.from('products').select('is_active').eq('id', id).single();
  if (error) return $msg(error.message);
  const { error: e2 } = await supabase.from('products').update({ is_active: !data.is_active }).eq('id', id);
  if (e2) return $msg(e2.message);
  await listProducts();
}

// ----- VARIANTE -----
const variantModal = new bootstrap.Modal(document.getElementById('modalVariant'));

function openVariantModal(productId){
  document.getElementById('formVariant').reset();
  document.getElementById('varProductId').value = productId;
  document.getElementById('varActive').checked = true;
  variantModal.show();
}

document.getElementById('formVariant').addEventListener('submit', async (e)=>{
  e.preventDefault(); $msg('');
  const product_id = Number(document.getElementById('varProductId').value);
  const size  = document.getElementById('varSize').value.trim() || null;
  const color = document.getElementById('varColor').value.trim() || null;
  const price = Number(document.getElementById('varPrice').value);
  const stock = Number(document.getElementById('varStock').value);
  const is_active = document.getElementById('varActive').checked;

  const { error } = await supabase.from('product_variants').insert([{ product_id, size, color, price, stock, is_active }]);
  if (error) return $msg(error.message);
  variantModal.hide();
  await listProducts();
});

// ----- IMAGEN -----
const imageModal = new bootstrap.Modal(document.getElementById('modalImage'));

function openImageModal(productId){
  document.getElementById('formImage').reset();
  document.getElementById('imgProductId').value = productId;
  document.getElementById('imgOrder').value = 0;
  imageModal.show();
}

document.getElementById('formImage').addEventListener('submit', async (e)=>{
  e.preventDefault(); $msg('');
  const product_id = Number(document.getElementById('imgProductId').value);
  const file = document.getElementById('imgFile').files[0];
  const sort_order = Number(document.getElementById('imgOrder').value) || 0;
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${product_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  // Sube a bucket 'products'
  const { error: upErr } = await supabase.storage.from('products').upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) return $msg(upErr.message);

  const { data: pub } = supabase.storage.from('products').getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: insErr } = await supabase.from('product_images').insert([{ product_id, url, sort_order }]);
  if (insErr) return $msg(insErr.message);

  imageModal.hide();
  await listProducts();
});

// ---- Inicio/boot ----
(async ()=>{
  const ctx = await requireAdmin(); // tu guard actual
  if (!ctx) return;

  document.getElementById('btnLogout').addEventListener('click', async ()=>{
    await supabase.auth.signOut();
    location.href = 'login.html';
  });

  await loadCategories();
  await listProducts();
})();


// ---- Inicio ----
(async ()=>{
  const ctx = await requireAdmin();
  if (!ctx) return;

  document.getElementById('btnLogout').addEventListener('click', async ()=>{
    await supabase.auth.signOut();
    location.href = 'login.html';
  });

  await listUsers();
  await listProducts();
})();
