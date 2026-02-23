import {
  initCollectionsUI, listCollections, setCollectionsChangedCallback,
  loadCollectionsSelect, getProductCollectionIds, setProductCollections
} from './colecciones.js';
import supabase from '../js/supabase-config.js';
import { listCategories } from './categorias.js';

let meId = null, myRole = null;
let CAN_EDIT = true;

// ---- Guard ----
async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = 'login.html'; return null; }

  // Verifica rol por RPC (no por select directo)
  const { data: role, error: roleErr } = await supabase.rpc('whoami_role');
  if (roleErr || !role || !['staff', 'admin', 'owner'].includes(role)) {
    await supabase.auth.signOut();
    location.href = 'login.html';
    return null;
  }
  meId = user.id; myRole = role;    // <-- guarda para la UI
  return { user, profile: { email: user.email, role } };
}

// ---- Inicio ----
(async () => {
  const ctx = await requireAdmin();
  if (!ctx) return;

  // Limitar UI para staff (puede ver, no administrar usuarios)
  CAN_EDIT = (myRole !== 'staff');

  // Oculta la tarjeta de Usuarios
  if (myRole === 'staff') {
    const usersCard = document.getElementById('users')?.closest('.card');
    if (usersCard) usersCard.style.display = 'none';
    // Oculta botones "Nuevo" por si tus policies no permiten escribir
    document.getElementById('btnNewProduct')?.classList.add('d-none');
    document.getElementById('btnNewCategory')?.classList.add('d-none');
  }

  // --- Settings (solo owner) ---
  const btnSettings = document.getElementById('btnSettings');
  if (myRole === 'owner') {
    btnSettings?.classList.remove('d-none');
    btnSettings?.addEventListener('click', openStoreSettingsModal);
    showStoreSettingsMsg('');
  }

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
  });

  await loadCategories();
  if (myRole !== 'staff') await listUsers();
  await listProducts();
  await listCategories();
})();

// ---- UI helpers ----
const $msg = (t = '') => document.getElementById('msg').textContent = t;

// ---- Usuarios ----
async function listUsers() {
  const { data: list, error } = await supabase
    .from('profiles')
    .select('id,email,role,status,created_at')
    .order('created_at', { ascending: false });

  if (error) { $msg(error.message); return; }

  const wrap = document.getElementById('users');
  wrap.innerHTML = '';
  if (!list?.length) { wrap.innerHTML = '<p class="text-secondary">Sin usuarios.</p>'; return; }

  for (const u of list) {
    const canDelete =
      ['admin', 'owner'].includes(myRole) &&          // yo soy admin/owner
      meId !== u.id &&                                // no yo mismo
      !(u.role === 'owner' && myRole !== 'owner');    // solo owner borra owner

    const row = document.createElement('div');
    row.className = 'd-flex align-items-center justify-content-between border-bottom border-secondary py-2';
    row.innerHTML = `
      <div class="small">
        <div class="fw-semibold text-light">${u.email || '(sin email)'}</div>
        <div class="text-secondary">${u.role} · ${new Date(u.created_at).toLocaleString()}</div>
      </div>
      <div class="d-flex gap-2">
        ${['client', 'staff', 'admin', 'owner'].map(r =>
      `<button class="btn btn-sm ${u.role === r ? 'btn-light' : 'btn-outline-light'}" data-action="setRole" data-id="${u.id}" data-role="${r}">${r}</button>`
    ).join('')}
     ${canDelete ? `
          <button class="btn btn-sm btn-outline-danger"
                  data-action="delUser" data-id="${u.id}" data-email="${u.email}">Eliminar</button>` : ''}
      </div>`;
    wrap.appendChild(row);
  }
  // roles
  wrap.querySelectorAll('button[data-action="setRole"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await setRole(btn.dataset.id, btn.dataset.role);
    });
  });

  // eliminar
  wrap.querySelectorAll('button[data-action="delUser"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteUser(btn.dataset.id, btn.dataset.email);
    });
  });

  wrap.querySelectorAll('button[data-action="setRole"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const role = btn.dataset.role;
      await setRole(id, role);
    });
  });
}

async function setRole(userId, role) {
  // Sólo permite si yo soy owner o admin (el guard ya lo valida)
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return $msg(error.message);
  $msg('Rol actualizado.');
  listUsers();
}

async function deleteUser(userId, email) {
  try {
    const { data: { user: me } } = await supabase.auth.getUser();
    if (me && me.id === userId) return $msg('No puedes eliminarte a ti mismo.');

    const ok = confirm(`¿Eliminar al usuario ${email || userId} de forma permanente?\nEsta acción no se puede deshacer.`);
    if (!ok) return;

    const { data, error } = await supabase.rpc('admin_delete_user', { target_user: userId });
    if (error) {
      // Si ves 404 aquí, la función no es visible para tu rol:
      // revisa GRANT EXECUTE y que esté en el schema public (paso A).
      return $msg(`Error al eliminar: ${error.message}`);
    }

    $msg('Usuario eliminado.');
    await listUsers();
  } catch (e) {
    $msg(String(e));
  }
}

// ---- Productos (placeholder para la siguiente iteración) ----
let CATEGORIES = [];

// Utilidad: slug
const slugify = s => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Carga categorías para el <select>
async function loadCategories() {
  const { data, error } = await supabase.from('categories').select('id,name,slug').order('name');
  if (error) { $msg(error.message); return; }
  CATEGORIES = data || [];
  const sel = document.getElementById('prodCategory');
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

let COLLECTIONS = [];

async function loadCollections() {
  const { data, error } = await supabase.from('collections').select('id,name,slug').order('name');
  if (error) { $msg(error.message); return; }
  COLLECTIONS = data || [];
  const sel = document.getElementById('prodCollections');
  if (sel) {
    sel.innerHTML = COLLECTIONS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

// Listado de productos con acciones
async function listProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,is_active,created_at')
    .order('id', { ascending: false })
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
      ${data.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>${p.slug}</td>
          <td>${p.name}</td>
          <td>${p.is_active ? 'Sí' : 'No'}</td>
          <td>${new Date(p.created_at).toLocaleString()}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-light me-1" data-action="edit" data-id="${p.id}">Editar</button>
            <button class="btn btn-sm btn-outline-light me-1" data-action="variant" data-id="${p.id}">Variante +</button>
            <button class="btn btn-sm btn-outline-light me-1" data-action="image" data-id="${p.id}">Imagen +</button>
            <button class="btn btn-sm ${p.is_active ? 'btn-outline-warning' : 'btn-outline-success'}" data-action="toggle" data-id="${p.id}">
              ${p.is_active ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn btn-sm btn-outline-danger ms-1" data-action="delete" data-id="${p.id}">Eliminar</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;

  // Handlers de acciones
  wrap.querySelectorAll('button[data-action]').forEach(btn => {
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    if (action === 'edit') btn.onclick = () => openProductModal(id);
    if (action === 'variant') btn.onclick = () => openVariantModal(id);
    if (action === 'image') btn.onclick = () => openImageModal(id);
    if (action === 'toggle') btn.onclick = () => toggleProduct(id);
    if (action === 'delete') btn.onclick = () => deleteProduct(id);
  });
}

// ----- PRODUCTO -----
const productModal = new bootstrap.Modal(document.getElementById('modalProduct'));
document.getElementById('btnNewProduct').addEventListener('click', () => openProductModal());

document.getElementById('prodName').addEventListener('input', (e) => {
  const v = e.target.value;
  if (!document.getElementById('prodId').value) {
    document.getElementById('prodSlug').value = slugify(v);
  }
});

async function openProductModal(id) {
  await loadCategories();
  const selCol = document.getElementById('prodCollections');
  await loadCollectionsSelect(selCol);
  document.getElementById('formProduct').reset();
  document.getElementById('prodId').value = id || '';
  document.getElementById('titleProduct').textContent = id ? 'Editar producto' : 'Nuevo producto';

  if (id) {
    const { data, error } = await supabase.from('products')
      .select('id,name,slug,description,category_id,is_active').eq('id', id).single();
    if (error) return $msg(error.message);
    document.getElementById('prodName').value = data.name || '';
    document.getElementById('prodSlug').value = data.slug || '';
    document.getElementById('prodDesc').value = data.description || '';
    document.getElementById('prodCategory').value = data.category_id || (CATEGORIES[0]?.id || '');
    document.getElementById('prodActive').checked = !!data.is_active;
    const selected = await getProductCollectionIds(id);
    [...selCol.options].forEach(o => o.selected = selected.includes(Number(o.value)));
  } else {
    document.getElementById('prodCategory').value = CATEGORIES[0]?.id || '';
    document.getElementById('prodActive').checked = true;
  }
  productModal.show();
}

document.getElementById('formProduct').addEventListener('submit', saveProduct);

async function saveProduct(e) {
  e.preventDefault(); $msg('');
  const id = document.getElementById('prodId').value;
  const payload = {
    name: document.getElementById('prodName').value.trim(),
    slug: slugify(document.getElementById('prodSlug').value.trim()),
    description: document.getElementById('prodDesc').value.trim(),
    category_id: Number(document.getElementById('prodCategory').value),
    is_active: document.getElementById('prodActive').checked
  };

  let res;
  if (id) {
    res = await supabase.from('products').update(payload).eq('id', Number(id)).select('id').single();
  } else {
    res = await supabase.from('products').insert([payload]).select('id').single();
  }
  if (res.error) return $msg(res.error.message);

  const productId = id ? Number(id) : res.data.id;

  const sel = document.getElementById('prodCollections');
  const selectedIds = [...sel.selectedOptions].map(o => Number(o.value));
  await setProductCollections(productId, selectedIds);

  productModal.hide();
  await listProducts();
}

async function toggleProduct(id) {
  const { data, error } = await supabase.from('products').select('is_active').eq('id', id).single();
  if (error) return $msg(error.message);
  const { error: e2 } = await supabase.from('products').update({ is_active: !data.is_active }).eq('id', id);
  if (e2) return $msg(e2.message);
  await listProducts();
}

// ----- VARIANTE -----
const variantModal = new bootstrap.Modal(document.getElementById('modalVariant'));

function openVariantModal(productId) {
  document.getElementById('formVariant').reset();
  document.getElementById('varProductId').value = productId;
  document.getElementById('varActive').checked = true;
  variantModal.show();
}

document.getElementById('formVariant').addEventListener('submit', async (e) => {
  e.preventDefault(); $msg('');
  const product_id = Number(document.getElementById('varProductId').value);
  const size = document.getElementById('varSize').value.trim() || null;
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

function openImageModal(productId) {
  document.getElementById('formImage').reset();
  document.getElementById('imgProductId').value = productId;
  document.getElementById('imgOrder').value = 0;
  imageModal.show();
}

document.getElementById('formImage').addEventListener('submit', async (e) => {
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

// ---- Eliminar producto ----
async function deleteProduct(id) {
  try {
    // Opcional: contamos variantes e imágenes para avisarte
    const { count: varCount } = await supabase
      .from('product_variants')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    const { count: imgCount } = await supabase
      .from('product_images')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id);

    const ok = confirm(
      `¿Eliminar el producto #${id}?` +
      `\nSe eliminarán también ${varCount ?? 0} variante(s) y ${imgCount ?? 0} imagen(es).`
    );
    if (!ok) return;

    // Borrado: variants & images tienen FK ON DELETE CASCADE, así que basta con borrar el producto
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return $msg(error.message);

    $msg('Producto eliminado.');
    await listProducts();
  } catch (e) {
    $msg(String(e));
  }
}

// después de requireAdmin() y listeners:
setCollectionsChangedCallback(async () => {
  const sel = document.getElementById('prodCollections');
  if (sel) await loadCollectionsSelect(sel);
});

initCollectionsUI();
await listCollections();

const settingsModal = new bootstrap.Modal(document.getElementById('modalStoreSettings'));
const DEMO = '../img/demo-product.png';

const resolveBranding = (pathOrUrl) => {
  if (!pathOrUrl) return DEMO;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = String(pathOrUrl).replace(/^branding\//, '');
  return supabase.storage.from('branding').getPublicUrl(clean).data.publicUrl;
};

async function openStoreSettingsModal() {
  $msg('');
  showStoreSettingsMsg('');
  await reloadStoreSettingsModal();
  // carga fila singleton id=1 (0/1 row safe)
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, topbar_text, hero_title, hero_subtitle, hero_image_url, logo_url')
    .eq('id', 1)
    .maybeSingle();
  if (error) return $msg(error.message);

  const s = data || {};
  document.getElementById('setStoreName').value = s.store_name || '';
  document.getElementById('setTopbarText').value = s.topbar_text || '';
  document.getElementById('setHeroTitle').value = s.hero_title || '';
  document.getElementById('setHeroSubtitle').value = s.hero_subtitle || '';

  // miniaturas
  const logoThumb = document.getElementById('thumbLogo');
  const heroThumb = document.getElementById('thumbHero');
  logoThumb.src = resolveBranding(s.logo_url);
  heroThumb.src = resolveBranding(s.hero_image_url);
  logoThumb.onerror = () => (logoThumb.src = DEMO);
  heroThumb.onerror = () => (heroThumb.src = DEMO);

  // limpia inputs file
  document.getElementById('fileLogo').value = '';
  document.getElementById('fileHero').value = '';

  settingsModal.show();
}

document.getElementById('formStoreSettings')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // mensaje dentro del modal
  showStoreSettingsMsg('');

  if (myRole !== 'owner') {
    showStoreSettingsMsg('Solo owner puede modificar configuración.', 'danger');
    return;
  }

  setStoreSettingsLoading(true);

  const logoFile = document.getElementById('fileLogo')?.files?.[0] || null;
  const heroFile = document.getElementById('fileHero')?.files?.[0] || null;

  // Helper: borra cualquier variante logo.* / hero.* del bucket branding
  async function removeByPrefix(prefix) {
    const { data: files, error } = await supabase.storage
      .from('branding')
      .list('', { limit: 100 });

    if (error) throw new Error(error.message);

    const toDelete = (files || [])
      .filter(f => typeof f?.name === 'string' && f.name.toLowerCase().startsWith(prefix.toLowerCase() + '.'))
      .map(f => f.name);

    if (toDelete.length) {
      const { error: delErr } = await supabase.storage.from('branding').remove(toDelete);
      if (delErr) throw new Error(delErr.message);
    }
  }

  // Helper: sube archivo con nombre fijo y devuelve public URL
  async function uploadFixed(nameBase, file) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${nameBase}.${ext}`; // SIEMPRE logo.ext o hero.ext

    // borra logo.* / hero.* para evitar basura si cambias extensión
    await removeByPrefix(nameBase);

    const { error: upErr } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    return data.publicUrl;
  }

  try {
    // 1) Subidas opcionales (guardamos URL pública)
    let logoUrl = null;
    let heroUrl = null;

    if (logoFile) logoUrl = await uploadFixed('logo', logoFile);
    if (heroFile) heroUrl = await uploadFixed('hero', heroFile);

    // 2) Update DB (URL en vez de path)
    const payload = {
      store_name: document.getElementById('setStoreName').value.trim(),
      topbar_text: document.getElementById('setTopbarText').value.trim(),
      hero_title: document.getElementById('setHeroTitle').value.trim(),
      hero_subtitle: document.getElementById('setHeroSubtitle').value.trim(),
    };

    if (logoUrl) payload.logo_url = logoUrl;
    if (heroUrl) payload.hero_image_url = heroUrl;

    const { error: dbErr } = await supabase
      .from('store_settings')
      .update(payload)
      .eq('id', 1);

    if (dbErr) throw new Error(dbErr.message);

    // 3) Refresca miniaturas
    if (logoUrl) document.getElementById('thumbLogo').src = logoUrl;
    if (heroUrl) document.getElementById('thumbHero').src = heroUrl;

    // 4) Limpia inputs file
    document.getElementById('fileLogo').value = '';
    document.getElementById('fileHero').value = '';

    showStoreSettingsMsg('Configuración guardada correctamente ✅', 'success');
    await reloadStoreSettingsModal();

  } catch (err) {
    showStoreSettingsMsg(String(err?.message || err), 'danger');
  } finally {
    setStoreSettingsLoading(false);
  }
});

function showStoreSettingsMsg(text = '', type = 'success') {
  const el = document.getElementById('storeSettingsMsg');
  if (!el) return;

  if (!text) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${text}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;

  if (type === 'success') {
    setTimeout(() => { el.innerHTML = ''; }, 3000);
  }
}

function setStoreSettingsLoading(isLoading) {
  const btn = document.getElementById('btnSaveStoreSettings');
  if (!btn) return;

  const spinner = btn.querySelector('.spinner-border');
  const text = btn.querySelector('.btn-text');

  btn.disabled = isLoading;
  if (spinner) spinner.classList.toggle('d-none', !isLoading);
  if (text) text.textContent = isLoading ? 'Guardando...' : 'Guardar';
}

async function reloadStoreSettingsModal() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, topbar_text, hero_title, hero_subtitle, hero_image_url, logo_url')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    showStoreSettingsMsg(error.message, 'danger');
    return;
  }

  const s = data || {};
  document.getElementById('setStoreName').value = s.store_name || '';
  document.getElementById('setTopbarText').value = s.topbar_text || '';
  document.getElementById('setHeroTitle').value = s.hero_title || '';
  document.getElementById('setHeroSubtitle').value = s.hero_subtitle || '';

  // Miniaturas: si hay URL, úsala; si no, usa resolveBranding (tu demo)
  const logoThumb = document.getElementById('thumbLogo');
  const heroThumb = document.getElementById('thumbHero');

  logoThumb.src = bust(resolveBranding(s.logo_url));
  heroThumb.src = bust(resolveBranding(s.hero_image_url));

  logoThumb.onerror = () => (logoThumb.src = bust(resolveBranding(null)));
  heroThumb.onerror = () => (heroThumb.src = bust(resolveBranding(null)));

  // Limpia inputs file
  document.getElementById('fileLogo').value = '';
  document.getElementById('fileHero').value = '';
}

function bust(url) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}