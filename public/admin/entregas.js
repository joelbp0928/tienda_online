import supabase from '../js/supabase-config.js';

let deliveryPointModal = null;
let deliverySlotModal = null;

const $msg = (t = '') => {
  const el = document.getElementById('msg');
  if (el) el.textContent = t;
};

function getPointFormData() {
  return {
    id: document.getElementById('deliveryPointId')?.value || '',
    name: document.getElementById('deliveryPointName')?.value.trim() || '',
    description: document.getElementById('deliveryPointDescription')?.value.trim() || null,
    address_reference: document.getElementById('deliveryPointReference')?.value.trim() || null,
    sort_order: Number(document.getElementById('deliveryPointSortOrder')?.value || 0),
    is_active: !!document.getElementById('deliveryPointActive')?.checked,
  };
}

function getSlotFormData() {
  return {
    id: document.getElementById('deliverySlotId')?.value || '',
    delivery_point_id: Number(document.getElementById('deliverySlotPoint')?.value || 0),
    slot_date: document.getElementById('deliverySlotDate')?.value || '',
    start_time: document.getElementById('deliverySlotStart')?.value || '',
    end_time: document.getElementById('deliverySlotEnd')?.value || null,
    capacity: Number(document.getElementById('deliverySlotCapacity')?.value || 1),
    reserved_count: Number(document.getElementById('deliverySlotReserved')?.value || 0),
    is_active: !!document.getElementById('deliverySlotActive')?.checked,
  };
}

function resetPointForm() {
  document.getElementById('formDeliveryPoint')?.reset();
  document.getElementById('deliveryPointId').value = '';
  document.getElementById('deliveryPointSortOrder').value = 0;
  document.getElementById('deliveryPointActive').checked = true;
  document.getElementById('titleDeliveryPoint').textContent = 'Nuevo punto de entrega';
}

function resetSlotForm() {
  document.getElementById('formDeliverySlot')?.reset();
  document.getElementById('deliverySlotId').value = '';
  document.getElementById('deliverySlotCapacity').value = 1;
  document.getElementById('deliverySlotReserved').value = 0;
  document.getElementById('deliverySlotActive').checked = true;
  document.getElementById('titleDeliverySlot').textContent = 'Nuevo horario de entrega';
}

async function loadDeliveryPointsSelect(selectedId = null) {
  const select = document.getElementById('deliverySlotPoint');
  if (!select) return;

  const { data, error } = await supabase
    .from('delivery_points')
    .select('id, name, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    select.innerHTML = `<option value="">No se pudieron cargar puntos</option>`;
    $msg(error.message);
    return;
  }

  select.innerHTML = `<option value="">Selecciona un punto</option>`;

  (data || []).forEach((point) => {
    const option = document.createElement('option');
    option.value = point.id;
    option.textContent = point.is_active ? point.name : `${point.name} (inactivo)`;
    if (selectedId && Number(selectedId) === Number(point.id)) option.selected = true;
    select.appendChild(option);
  });
}

export async function initEntregasUI() {
  deliveryPointModal = new bootstrap.Modal(document.getElementById('modalDeliveryPoint'));
  deliverySlotModal = new bootstrap.Modal(document.getElementById('modalDeliverySlot'));

  bindEntregasEvents();

  await Promise.all([
    listDeliveryPoints(),
    listDeliverySlots(),
    loadDeliveryPointsSelect(),
  ]);
}

function bindEntregasEvents() {
  document.getElementById('btnNewDeliveryPoint')?.addEventListener('click', async () => {
    $msg('');
    resetPointForm();
    deliveryPointModal?.show();
  });

  document.getElementById('btnNewDeliverySlot')?.addEventListener('click', async () => {
    $msg('');
    resetSlotForm();
    await loadDeliveryPointsSelect();
    deliverySlotModal?.show();
  });

  document.getElementById('formDeliveryPoint')?.addEventListener('submit', saveDeliveryPoint);
  document.getElementById('formDeliverySlot')?.addEventListener('submit', saveDeliverySlot);

  document.getElementById('deliveryPoints')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'edit-point') {
      await openDeliveryPointModal(id);
      return;
    }

    if (action === 'toggle-point') {
      await toggleDeliveryPoint(id);
      return;
    }
  });

  document.getElementById('deliverySlots')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === 'edit-slot') {
      await openDeliverySlotModal(id);
      return;
    }

    if (action === 'toggle-slot') {
      await toggleDeliverySlot(id);
      return;
    }
  });
}

export async function listDeliveryPoints() {
  const { data, error } = await supabase
    .from('delivery_points')
    .select('id, name, description, address_reference, is_active, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  const wrap = document.getElementById('deliveryPoints');
  if (!wrap) return;

  if (error) {
    wrap.innerHTML = `<div class="text-warning">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    wrap.innerHTML = `<p class="text-secondary">Sin puntos de entrega.</p>`;
    return;
  }

  wrap.innerHTML = data.map((p) => `
    <div class="border border-secondary rounded p-3 mb-2">
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div class="fw-semibold d-flex align-items-center gap-2">
            <span>${p.name}</span>
            <span class="badge ${p.is_active ? 'text-bg-success' : 'text-bg-secondary'}">
              ${p.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div class="small text-secondary">${p.description || ''}</div>
          <div class="small text-secondary">${p.address_reference || ''}</div>
          <div class="small text-secondary">Orden: ${p.sort_order ?? 0}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap justify-content-end">
          <button
            class="btn btn-sm btn-outline-light"
            data-action="edit-point"
            data-id="${p.id}"
          >
            Editar
          </button>
          <button
            class="btn btn-sm ${p.is_active ? 'btn-outline-warning' : 'btn-outline-success'}"
            data-action="toggle-point"
            data-id="${p.id}"
          >
            ${p.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

export async function listDeliverySlots(pointId = null, date = null) {
  let query = supabase
    .from('delivery_slots')
    .select(`
      id,
      delivery_point_id,
      slot_date,
      start_time,
      end_time,
      capacity,
      reserved_count,
      is_active,
      delivery_points(name)
    `)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (pointId) query = query.eq('delivery_point_id', pointId);
  if (date) query = query.eq('slot_date', date);

  const { data, error } = await query;
  const wrap = document.getElementById('deliverySlots');
  if (!wrap) return;

  if (error) {
    wrap.innerHTML = `<div class="text-warning">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    wrap.innerHTML = `<p class="text-secondary">Sin horarios cargados.</p>`;
    return;
  }

  wrap.innerHTML = data.map((s) => `
    <div class="border border-secondary rounded p-3 mb-2">
      <div class="d-flex justify-content-between align-items-center gap-3">
        <div>
          <div class="fw-semibold d-flex align-items-center gap-2">
            <span>${s.delivery_points?.name || 'Punto'}</span>
            <span class="badge ${s.is_active ? 'text-bg-success' : 'text-bg-secondary'}">
              ${s.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div class="small text-secondary">
            ${s.slot_date} · ${formatHour(s.start_time)}${s.end_time ? ` - ${formatHour(s.end_time)}` : ''}
          </div>
          <div class="small text-secondary">
            Cupo: ${Number(s.reserved_count || 0)}/${Number(s.capacity || 0)}
          </div>
        </div>
        <div class="d-flex gap-2 flex-wrap justify-content-end">
          <button
            class="btn btn-sm btn-outline-light"
            data-action="edit-slot"
            data-id="${s.id}"
          >
            Editar
          </button>
          <button
            class="btn btn-sm ${s.is_active ? 'btn-outline-warning' : 'btn-outline-success'}"
            data-action="toggle-slot"
            data-id="${s.id}"
          >
            ${s.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function formatHour(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

async function openDeliveryPointModal(id) {
  $msg('');
  resetPointForm();

  const { data, error } = await supabase
    .from('delivery_points')
    .select('id, name, description, address_reference, sort_order, is_active')
    .eq('id', id)
    .single();

  if (error) {
    $msg(error.message);
    return;
  }

  document.getElementById('deliveryPointId').value = data.id;
  document.getElementById('deliveryPointName').value = data.name || '';
  document.getElementById('deliveryPointDescription').value = data.description || '';
  document.getElementById('deliveryPointReference').value = data.address_reference || '';
  document.getElementById('deliveryPointSortOrder').value = data.sort_order ?? 0;
  document.getElementById('deliveryPointActive').checked = !!data.is_active;
  document.getElementById('titleDeliveryPoint').textContent = 'Editar punto de entrega';

  deliveryPointModal?.show();
}

async function openDeliverySlotModal(id) {
  $msg('');
  resetSlotForm();

  const { data, error } = await supabase
    .from('delivery_slots')
    .select('id, delivery_point_id, slot_date, start_time, end_time, capacity, reserved_count, is_active')
    .eq('id', id)
    .single();

  if (error) {
    $msg(error.message);
    return;
  }

  await loadDeliveryPointsSelect(data.delivery_point_id);

  document.getElementById('deliverySlotId').value = data.id;
  document.getElementById('deliverySlotDate').value = data.slot_date || '';
  document.getElementById('deliverySlotStart').value = formatHour(data.start_time);
  document.getElementById('deliverySlotEnd').value = data.end_time ? formatHour(data.end_time) : '';
  document.getElementById('deliverySlotCapacity').value = Number(data.capacity || 1);
  document.getElementById('deliverySlotReserved').value = Number(data.reserved_count || 0);
  document.getElementById('deliverySlotActive').checked = !!data.is_active;
  document.getElementById('titleDeliverySlot').textContent = 'Editar horario de entrega';

  deliverySlotModal?.show();
}

async function saveDeliveryPoint(e) {
  e.preventDefault();
  $msg('');

  const form = getPointFormData();

  if (!form.name) {
    $msg('El nombre del punto es obligatorio.');
    return;
  }

  if (form.sort_order < 0) {
    $msg('El orden no puede ser negativo.');
    return;
  }

  const payload = {
    name: form.name,
    description: form.description,
    address_reference: form.address_reference,
    sort_order: form.sort_order,
    is_active: form.is_active,
  };

  let response;
  if (form.id) {
    response = await supabase
      .from('delivery_points')
      .update(payload)
      .eq('id', Number(form.id));
  } else {
    response = await supabase
      .from('delivery_points')
      .insert([payload]);
  }

  if (response.error) {
    $msg(response.error.message);
    return;
  }

  deliveryPointModal?.hide();
  $msg(form.id ? 'Punto actualizado.' : 'Punto creado.');

  await Promise.all([
    listDeliveryPoints(),
    loadDeliveryPointsSelect(),
  ]);
}

async function saveDeliverySlot(e) {
  e.preventDefault();
  $msg('');

  const form = getSlotFormData();

  if (!form.delivery_point_id) {
    $msg('Selecciona un punto de entrega.');
    return;
  }

  if (!form.slot_date) {
    $msg('Selecciona una fecha.');
    return;
  }

  if (!form.start_time) {
    $msg('La hora de inicio es obligatoria.');
    return;
  }

  if (form.capacity < 1) {
    $msg('El cupo debe ser al menos 1.');
    return;
  }

  if (form.reserved_count < 0) {
    $msg('Reservados no puede ser negativo.');
    return;
  }

  if (form.reserved_count > form.capacity) {
    $msg('Reservados no puede ser mayor al cupo.');
    return;
  }

  if (form.end_time && form.end_time <= form.start_time) {
    $msg('La hora fin debe ser mayor que la hora inicio.');
    return;
  }

  const payload = {
    delivery_point_id: form.delivery_point_id,
    slot_date: form.slot_date,
    start_time: form.start_time,
    end_time: form.end_time || null,
    capacity: form.capacity,
    reserved_count: form.reserved_count,
    is_active: form.is_active,
  };

  let response;
  if (form.id) {
    response = await supabase
      .from('delivery_slots')
      .update(payload)
      .eq('id', Number(form.id));
  } else {
    response = await supabase
      .from('delivery_slots')
      .insert([payload]);
  }

  if (response.error) {
    $msg(response.error.message);
    return;
  }

  deliverySlotModal?.hide();
  $msg(form.id ? 'Horario actualizado.' : 'Horario creado.');

  await listDeliverySlots();
}

async function toggleDeliveryPoint(id) {
  $msg('');

  const { data, error } = await supabase
    .from('delivery_points')
    .select('id, is_active, name')
    .eq('id', id)
    .single();

  if (error) {
    $msg(error.message);
    return;
  }

  const nextValue = !data.is_active;
  const actionLabel = nextValue ? 'activar' : 'desactivar';
  const ok = window.confirm(`¿Deseas ${actionLabel} el punto "${data.name}"?`);
  if (!ok) return;

  const { error: updateError } = await supabase
    .from('delivery_points')
    .update({ is_active: nextValue })
    .eq('id', id);

  if (updateError) {
    $msg(updateError.message);
    return;
  }

  $msg(`Punto ${nextValue ? 'activado' : 'desactivado'}.`);

  await Promise.all([
    listDeliveryPoints(),
    loadDeliveryPointsSelect(),
  ]);
}

async function toggleDeliverySlot(id) {
  $msg('');

  const { data, error } = await supabase
    .from('delivery_slots')
    .select('id, is_active, slot_date, start_time')
    .eq('id', id)
    .single();

  if (error) {
    $msg(error.message);
    return;
  }

  const nextValue = !data.is_active;
  const label = `${data.slot_date} ${formatHour(data.start_time)}`;
  const ok = window.confirm(`¿Deseas ${nextValue ? 'activar' : 'desactivar'} el horario ${label}?`);
  if (!ok) return;

  const { error: updateError } = await supabase
    .from('delivery_slots')
    .update({ is_active: nextValue })
    .eq('id', id);

  if (updateError) {
    $msg(updateError.message);
    return;
  }

  $msg(`Horario ${nextValue ? 'activado' : 'desactivado'}.`);
  await listDeliverySlots();
}