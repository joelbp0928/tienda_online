import supabase from "./supabase-config.js";
import { initAppShell } from "./app-shell.js";
import { fetchCartDetails, isClientLogged, updateCartBadge } from "./carrito.js";

const DEMO_IMG = "../img/demo-product.png";

function money(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

function toast(message) {
  const el = document.getElementById("appToast");
  const body = document.getElementById("appToastBody");
  if (!el || !body || typeof bootstrap === "undefined") return;
  body.textContent = message;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 }).show();
}

function setMinDate() {
  const input = document.getElementById("deliveryDate");
  if (!input) return;

  const now = new Date();
  now.setDate(now.getDate() + 1); // desde mañana
  input.min = now.toISOString().split("T")[0];
}

function getSelectedPaymentPlan() {
  const selected = document.querySelector('input[name="paymentPlan"]:checked');
  return selected?.value || "card_full";
}

function updatePaymentUI(subtotal) {
  const plan = getSelectedPaymentPlan();
  const transferBox = document.getElementById("transferBox");
  const cardBox = document.getElementById("cardBox");
  const summaryDeposit = document.getElementById("summaryDeposit");

  const needsTransferProof = plan === "transfer_full" || plan === "transfer_partial";
  const isPartial = plan === "card_partial" || plan === "transfer_partial";

  transferBox?.classList.toggle("d-none", !needsTransferProof);
  cardBox?.classList.toggle("d-none", !(plan === "card_full" || plan === "card_partial"));

  const deposit = isPartial ? subtotal * 0.5 : subtotal;
  if (summaryDeposit) summaryDeposit.textContent = money(deposit);
}

function renderSummary(items) {
  const list = document.getElementById("checkoutItems");
  const summaryItems = document.getElementById("summaryItems");
  const summarySubtotal = document.getElementById("summarySubtotal");
  const summaryTotal = document.getElementById("summaryTotal");

  const totalItems = items.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const subtotal = items.reduce((s, x) => s + Number(x.line_total || 0), 0);

  list.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "d-flex gap-3 align-items-center";
    row.innerHTML = `
      <img
        src="${item.cover_url || DEMO_IMG}"
        alt="${item.name}"
        style="width:64px;height:64px;object-fit:cover;border-radius:12px"
        onerror="this.src='${DEMO_IMG}'"
      />
      <div class="flex-grow-1">
        <div class="fw-semibold small">${item.name}</div>
        <div class="text-white-50 small">Cantidad: ${item.quantity}</div>
      </div>
      <div class="small">${money(item.line_total)}</div>
    `;
    list.appendChild(row);
  });

  summaryItems.textContent = totalItems;
  summarySubtotal.textContent = money(subtotal);
  summaryTotal.textContent = money(subtotal);

  updatePaymentUI(subtotal);
}

async function loadCheckout() {
  const items = await fetchCartDetails();

  if (!items.length) {
    toast("Tu carrito está vacío");
    setTimeout(() => {
      window.location.href = "/html/carrito.html";
    }, 800);
    return [];
  }

  renderSummary(items);
  updateCartBadge();
  return items;
}

function bindEvents(items) {
  const dateInput = document.getElementById("deliveryDate");
  const paymentRadios = document.querySelectorAll('input[name="paymentPlan"]');
  const btnPlaceOrder = document.getElementById("btnPlaceOrder");
  const pointSelect = document.getElementById("deliveryPoint");

  pointSelect?.addEventListener("change", renderSlotsFromDb);
  dateInput?.addEventListener("change", renderSlotsFromDb);

  paymentRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      const subtotal = items.reduce((s, x) => s + Number(x.line_total || 0), 0);
      updatePaymentUI(subtotal);
    });
  });

  btnPlaceOrder?.addEventListener("click", async () => {
    await submitOrder(items);
  });
}

async function uploadTransferProof(file, customerId) {
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `proofs/${customerId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("payments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("payments").getPublicUrl(path);
  return data.publicUrl;
}

async function submitOrder(items) {
  const ok = await isClientLogged();
  if (!ok) {
    toast("Debes iniciar sesión como cliente");
    return;
  }

  const deliveryPointId = document.getElementById("deliveryPoint")?.value || "";
  const deliverySlotId = document.getElementById("deliverySlot")?.value || "";
  const deliveryNotes = document.getElementById("deliveryNotes")?.value?.trim() || "";
  const customerName = document.getElementById("customerName")?.value?.trim() || "";
  const customerPhone = document.getElementById("customerPhone")?.value?.trim() || "";
  const customerAddress = document.getElementById("customerAddress")?.value?.trim() || "";
  const paymentPlan = getSelectedPaymentPlan();
  const proofFile = document.getElementById("transferProof")?.files?.[0] || null;

  if (!deliveryPointId) return toast("Selecciona un punto de entrega");
  if (!deliveryDate) return toast("Selecciona una fecha de entrega");
  if (!deliverySlotId) return toast("Selecciona un horario disponible");
  if (!customerName || !customerPhone) return toast("Completa tus datos de contacto");

  const requiresProof = paymentPlan === "transfer_full" || paymentPlan === "transfer_partial";
  if (requiresProof && !proofFile) {
    return toast("Debes subir tu comprobante de transferencia");
  }

  const subtotal = items.reduce((s, x) => s + Number(x.line_total || 0), 0);
  const depositRequired =
    paymentPlan === "card_partial" || paymentPlan === "transfer_partial"
      ? subtotal * 0.5
      : subtotal;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return toast("No se pudo identificar al usuario");

  let proofUrl = null;
  try {
    if (requiresProof && proofFile) {
      proofUrl = await uploadTransferProof(proofFile, user.id);
    }
  } catch (err) {
    console.warn(err);
    return toast("No se pudo subir el comprobante");
  }

  const paymentStatusMap = {
    card_full: "pending_card_payment",
    card_partial: "pending_card_payment",
    transfer_full: "pending_transfer_review",
    transfer_partial: "pending_transfer_review",
  };

  const orderPayload = {
    customer_id: user.id,
    delivery_method: deliveryMethod,
    delivery_point_id: Number(deliveryPointId),
    delivery_slot_id: Number(deliverySlotId),
    delivery_date: deliveryDate,
    delivery_notes: deliveryNotes,
    payment_plan: paymentPlan,
    payment_status: paymentStatusMap[paymentPlan] || "pending",
    proof_url: proofUrl,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: customerAddress,
    subtotal,
    total: subtotal,
    deposit_required: depositRequired,
    status: "pending_confirmation",
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id")
    .single();

  if (orderError) {
    console.warn(orderError);
    return toast("No se pudo crear el pedido");
  }

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    line_total: item.line_total,
    size: item.size,
    color: item.color,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.warn(itemsError);
    return toast("El pedido se creó, pero hubo un problema al guardar los productos");
  }

  toast("Pedido creado correctamente");
  setTimeout(() => {
    window.location.href = "/html/pedidos.html";
  }, 1000);
}

async function loadDeliveryPoints() {
  const select = document.getElementById("deliveryPoint");
  if (!select) return;

  const { data, error } = await supabase
    .from("delivery_points")
    .select("id, name, description, address_reference")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.warn(error);
    return;
  }

  select.innerHTML = `<option value="">Selecciona un punto de entrega</option>`;

  (data || []).forEach((point) => {
    const option = document.createElement("option");
    option.value = point.id;
    option.textContent = point.address_reference
      ? `${point.name} — ${point.address_reference}`
      : point.name;
    select.appendChild(option);
  });
}

async function renderSlotsFromDb() {
  const pointId = document.getElementById("deliveryPoint")?.value || "";
  const dateStr = document.getElementById("deliveryDate")?.value || "";
  const select = document.getElementById("deliverySlot");
  const hint = document.getElementById("slotAvailabilityHint");

  if (!select || !hint) return;

  if (!pointId || !dateStr) {
    select.disabled = true;
    select.innerHTML = `<option value="">Selecciona punto y fecha primero</option>`;
    hint.textContent = "Selecciona un punto y una fecha para ver horarios disponibles.";
    return;
  }

  const { data, error } = await supabase
    .from("delivery_slots")
    .select("id, slot_date, start_time, end_time, capacity, reserved_count")
    .eq("delivery_point_id", pointId)
    .eq("slot_date", dateStr)
    .eq("is_active", true)
    .order("start_time", { ascending: true });

  if (error) {
    console.warn(error);
    select.disabled = true;
    select.innerHTML = `<option value="">No se pudieron cargar horarios</option>`;
    hint.textContent = "Ocurrió un problema al consultar disponibilidad.";
    return;
  }

  const available = (data || []).filter(
    (slot) => Number(slot.reserved_count || 0) < Number(slot.capacity || 0)
  );

  select.disabled = false;
  select.innerHTML = `<option value="">Selecciona un horario</option>`;

  if (!available.length) {
    select.innerHTML = `<option value="">Sin horarios disponibles</option>`;
    select.disabled = true;
    hint.textContent = "No hay horarios disponibles para esta fecha y punto.";
    return;
  }

  available.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.id;
    option.textContent = slot.end_time
      ? `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`
      : `${slot.start_time.slice(0, 5)}`;
    select.appendChild(option);
  });

  hint.textContent = `Hay ${available.length} horario(s) disponibles para este punto de entrega.`;
}

(async function init() {
  document.title = "Checkout";

  await initAppShell();
  setMinDate();

  const items = await loadCheckout();
  if (!items.length) return;

  bindEvents(items);
})();