// /admin/admin.js
import supabase from '../public/js/supabase-config.js';

// ---- Guard ----
async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = '/admin/login.html'; return null; }

  // Verifica rol por RPC (no por select directo)
  const { data: role, error: roleErr } = await supabase.rpc('whoami_role');
  if (roleErr || !role || !['admin','owner'].includes(role)) {
    await supabase.auth.signOut();
    location.href = '/admin/login.html';
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
async function listProducts(){
  const { data, error } = await supabase
    .from('products')
    .select('id,slug,name,is_active,created_at')
    .order('id', { ascending:false })
    .limit(20);

  const wrap = document.getElementById('products');
  if (error) { wrap.innerHTML = `<div class="text-warning">${error.message}</div>`; return; }
  if (!data?.length) { wrap.innerHTML = `<p class="text-secondary">Aún no hay productos.</p>`; return; }

  wrap.innerHTML = `<div class="table-responsive">
    <table class="table table-dark table-sm align-middle">
      <thead><tr><th>ID</th><th>Slug</th><th>Nombre</th><th>Activo</th><th>Creado</th></tr></thead>
      <tbody>
        ${data.map(p=>`
          <tr>
            <td>${p.id}</td>
            <td>${p.slug}</td>
            <td>${p.name}</td>
            <td>${p.is_active ? 'Sí':'No'}</td>
            <td>${new Date(p.created_at).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ---- Inicio ----
(async ()=>{
  const ctx = await requireAdmin();
  if (!ctx) return;

  document.getElementById('btnLogout').addEventListener('click', async ()=>{
    await supabase.auth.signOut();
    location.href = '/admin/login.html';
  });

  await listUsers();
  await listProducts();
})();
