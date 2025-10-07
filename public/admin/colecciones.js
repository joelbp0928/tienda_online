// public/admin/colecciones.js
import supabase from '../js/supabase-config.js';

let collectionModal = null;
let onChanged = null;  // callback para avisar cambios al panel (p.ej. refrescar multiselect del producto)

// helpers
const $msg = (t='') => { const el = document.getElementById('msg'); if (el) el.textContent = t; };
const slugify = s => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

// ---- API para el panel ----
export function setCollectionsChangedCallback(fn){ onChanged = typeof fn === 'function' ? fn : null; }

export function initCollectionsUI(){
  // botón nueva
  document.getElementById('btnNewCollection')?.addEventListener('click', () => openCollectionModal());

  // autogenerar slug
  document.getElementById('colName')?.addEventListener('input', e=>{
    if (!document.getElementById('colId').value) {
      document.getElementById('colSlug').value = slugify(e.target.value);
    }
  });

  // submit
  document.getElementById('formCollection')?.addEventListener('submit', saveCollection);
}

export async function listCollections(){
  const box = document.getElementById('collections');
  if (!box) return;

  const { data, error } = await supabase
    .from('collections')
    .select('id,name,slug,description,created_at')
    .order('created_at', { ascending: false });

  if (error){ box.innerHTML = `<div class="text-warning">${error.message}</div>`; return; }
  if (!data?.length){ box.innerHTML = `<p class="text-secondary">No hay colecciones.</p>`; return; }

  box.innerHTML = `
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
                <button class="btn btn-sm btn-outline-light me-1" data-action="edit" data-id="${c.id}">Editar</button>
                <button class="btn btn-sm btn-outline-danger" data-action="del" data-id="${c.id}">Eliminar</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  box.querySelectorAll('button[data-action="edit"]').forEach(b => b.onclick = () => openCollectionModal(Number(b.dataset.id)));
  box.querySelectorAll('button[data-action="del"]').forEach(b => b.onclick = () => deleteCollection(Number(b.dataset.id)));
}

async function openCollectionModal(id){
  collectionModal = collectionModal || new bootstrap.Modal(document.getElementById('modalCollection'));
  document.getElementById('formCollection').reset();
  document.getElementById('colId').value = id || '';
  document.getElementById('titleCollection').textContent = id ? 'Editar colección' : 'Nueva colección';

  if (id){
    const { data, error } = await supabase
      .from('collections')
      .select('id,name,slug,description').eq('id', id).single();
    if (error) return $msg(error.message);
    document.getElementById('colName').value = data.name;
    document.getElementById('colSlug').value = data.slug;
    document.getElementById('colDesc').value = data.description || '';
  }
  collectionModal.show();
}

async function saveCollection(e){
  e.preventDefault(); $msg('');
  const id   = document.getElementById('colId').value;
  const name = document.getElementById('colName').value.trim();
  const slug = slugify(document.getElementById('colSlug').value.trim());
  const description = document.getElementById('colDesc').value.trim() || null;

  if (!name || !slug) return $msg('Nombre y slug son obligatorios.');

  let res;
  if (id){
    res = await supabase.from('collections').update({ name, slug, description }).eq('id', Number(id));
  } else {
    res = await supabase.from('collections').insert([{ name, slug, description }]);
  }
  if (res.error) return $msg(res.error.message);

  collectionModal.hide();
  await listCollections();
  if (onChanged) onChanged(); // avisa al panel (para refrescar multiselect del producto)
}

async function deleteCollection(id){
  // cuenta productos asociados
  const { count } = await supabase
    .from('product_collections')
    .select('product_id', { count:'exact', head:true })
    .eq('collection_id', id);

  const ok = confirm(`¿Eliminar la colección #${id}? Productos asociados: ${count ?? 0}.`);
  if (!ok) return;

  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) return $msg(error.message);

  $msg('Colección eliminada.');
  await listCollections();
  if (onChanged) onChanged();
}

/* ---------- Helpers para el multiselect del modal de producto ---------- */
export async function loadCollectionsSelect(selectEl){
  const { data, error } = await supabase.from('collections').select('id,name').order('name');
  if (error) { $msg(error.message); return; }
  selectEl.innerHTML = (data||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

export async function getProductCollectionIds(product_id){
  const { data, error } = await supabase
    .from('product_collections')
    .select('collection_id')
    .eq('product_id', product_id);
  if (error) { $msg(error.message); return []; }
  return (data||[]).map(r => r.collection_id);
}

export async function setProductCollections(product_id, ids){
  const { error: delErr } = await supabase.from('product_collections').delete().eq('product_id', product_id);
  if (delErr) return $msg(delErr.message);
  if (ids.length){
    const rows = ids.map(cid => ({ product_id, collection_id: Number(cid) }));
    const { error: insErr } = await supabase.from('product_collections').insert(rows);
    if (insErr) return $msg(insErr.message);
  }
}
