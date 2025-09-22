import supabase from '../js/supabase-config.js';

// ---- UI helpers ----
const $msg = (t = '') => document.getElementById('msg').textContent = t;
// Utilidad: slug
const slugify = s => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---------- CATEGORÍAS ----------
const categoryModal = new bootstrap.Modal(document.getElementById('modalCategory'));

document.getElementById('btnNewCategory').addEventListener('click', () => openCategoryModal());

document.getElementById('catName').addEventListener('input', (e)=>{
  if (!document.getElementById('catId').value) {
    document.getElementById('catSlug').value = slugify(e.target.value);
  }
});

export async function listCategories(){
  const el = document.getElementById('categories');
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,slug,created_at')
    .order('created_at', { ascending: false });

  if (error){ el.innerHTML = `<div class="text-warning">${error.message}</div>`; return; }
  if (!data?.length){ el.innerHTML = `<p class="text-secondary">No hay categorías.</p>`; return; }

  el.innerHTML = `
    <div class="table-responsive">
      <table class="table table-dark table-sm align-middle">
        <thead><tr><th>ID</th><th>Slug</th><th>Nombre</th><th>Creado</th><th class="text-end">Acciones</th></tr></thead>
        <tbody>
        ${data.map(c=>`
          <tr>
            <td>${c.id}</td>
            <td>${c.slug}</td>
            <td>${c.name}</td>
            <td>${new Date(c.created_at).toLocaleString()}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-light me-1" data-action="editCat" data-id="${c.id}">Editar</button>
              <button class="btn btn-sm btn-outline-danger" data-action="delCat" data-id="${c.id}">Eliminar</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  el.querySelectorAll('button[data-action="editCat"]').forEach(b=>{
    b.onclick = () => openCategoryModal(Number(b.dataset.id));
  });
  el.querySelectorAll('button[data-action="delCat"]').forEach(b=>{
    b.onclick = () => deleteCategory(Number(b.dataset.id));
  });
}

async function openCategoryModal(id){
  document.getElementById('formCategory').reset();
  document.getElementById('catId').value = id || '';
  document.getElementById('titleCategory').textContent = id ? 'Editar categoría' : 'Nueva categoría';

  if (id){
    const { data, error } = await supabase.from('categories')
      .select('id,name,slug').eq('id', id).single();
    if (error) return $msg(error.message);
    document.getElementById('catName').value = data.name;
    document.getElementById('catSlug').value = data.slug;
  }
  categoryModal.show();
}

document.getElementById('formCategory').addEventListener('submit', saveCategory);

async function saveCategory(e){
  e.preventDefault(); $msg('');
  const id   = document.getElementById('catId').value;
  const name = document.getElementById('catName').value.trim();
  const slug = slugify(document.getElementById('catSlug').value.trim());

  if (!name || !slug){ $msg('Nombre y slug son obligatorios.'); return; }

  // inserta/actualiza
  let resp;
  if (id){
    resp = await supabase.from('categories').update({ name, slug }).eq('id', Number(id));
  } else {
    resp = await supabase.from('categories').insert([{ name, slug }]);
  }
  if (resp.error){
    $msg(resp.error.message); return;
  }

  categoryModal.hide();
  await listCategories();
  // refresca el select de categorías en el modal de producto
  if (typeof loadCategories === 'function') await loadCategories();
}

async function deleteCategory(id){
  // Nota: products.category_id tiene ON DELETE SET NULL (no borra productos).
  const { count } = await supabase
    .from('products').select('id', { count:'exact', head:true })
    .eq('category_id', id);

  const ok = confirm(
    `¿Eliminar la categoría #${id}?` +
    `\nProductos asociados: ${count ?? 0}.` +
    `\nLos productos quedarán sin categoría.`
  );
  if (!ok) return;

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return $msg(error.message);

  $msg('Categoría eliminada.');
  await listCategories();
  if (typeof loadCategories === 'function') await loadCategories();
}
