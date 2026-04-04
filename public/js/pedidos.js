import supabase from "./supabase-config.js";
import "./chatBot.js";
import { initAppShell } from "./app-shell.js";
import { updateCartBadge } from "./carrito.js";

function money(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();

  const map = {
    pending: "text-bg-warning",
    paid: "text-bg-info",
    preparing: "text-bg-primary",
    shipped: "text-bg-secondary",
    delivered: "text-bg-success",
    cancelled: "text-bg-danger",
  };

  const labels = {
    pending: "Pendiente",
    paid: "Pagado",
    preparing: "Preparando",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return `<span class="badge ${map[s] || "text-bg-dark"}">${labels[s] || status || "Sin estado"}</span>`;
}

function lineMeta(item) {
  const parts = [];
  if (item.size_snapshot) parts.push(`Talla: ${item.size_snapshot}`);
  if (item.color_snapshot) parts.push(`Color: ${item.color_snapshot}`);
  return parts.join(" · ");
}

function showGuestState() {
  document.getElementById("ordersLoading")?.classList.add("d-none");
  document.getElementById("ordersEmpty")?.classList.add("d-none");
  document.getElementById("ordersList")?.classList.add("d-none");
  document.getElementById("ordersGuestState")?.classList.remove("d-none");
}

function showEmptyState() {
  document.getElementById("ordersLoading")?.classList.add("d-none");
  document.getElementById("ordersGuestState")?.classList.add("d-none");
  document.getElementById("ordersList")?.classList.add("d-none");
  document.getElementById("ordersEmpty")?.classList.remove("d-none");
}

function showOrdersState() {
  document.getElementById("ordersLoading")?.classList.add("d-none");
  document.getElementById("ordersGuestState")?.classList.add("d-none");
  document.getElementById("ordersEmpty")?.classList.add("d-none");
  document.getElementById("ordersList")?.classList.remove("d-none");
}

async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user || null;
}

async function fetchMyOrders(customerId) {
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      status,
      subtotal,
      discount,
      shipping_cost,
      total,
      shipping_address_id,
      created_at
    `)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);

  if (!orders?.length) return [];

  const orderIds = orders.map((o) => o.id);
  const addressIds = [...new Set(orders.map((o) => o.shipping_address_id).filter(Boolean))];

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(`
      id,
      order_id,
      product_id,
      variant_id,
      name_snapshot,
      size_snapshot,
      color_snapshot,
      unit_price,
      quantity,
      line_total
    `)
    .in("order_id", orderIds)
    .order("id", { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  let addresses = [];
  if (addressIds.length) {
    const { data: addressData, error: addressError } = await supabase
      .from("addresses")
      .select(`
        id,
        label,
        line1,
        line2,
        city,
        state,
        postal_code,
        country
      `)
      .in("id", addressIds);

    if (!addressError) addresses = addressData || [];
  }

  const orderItemsByOrder = new Map();
  for (const item of items || []) {
    if (!orderItemsByOrder.has(item.order_id)) {
      orderItemsByOrder.set(item.order_id, []);
    }
    orderItemsByOrder.get(item.order_id).push(item);
  }

  return orders.map((order) => ({
    ...order,
    items: orderItemsByOrder.get(order.id) || [],
    address: addresses.find((a) => a.id === order.shipping_address_id) || null,
  }));
}

function renderOrders(orders) {
  const container = document.getElementById("ordersList");
  if (!container) return;

  container.innerHTML = "";

  for (const order of orders) {
    const itemsHtml = (order.items || [])
      .map(
        (item) => `
        <div class="order-item-row">
          <div class="d-flex justify-content-between gap-3 flex-wrap">
            <div>
              <div class="fw-semibold">${item.name_snapshot || "Producto"}</div>
              <div class="small text-white-50">
                ${lineMeta(item) || "Sin variante específica"}
              </div>
              <div class="small text-white-50">
                Cantidad: ${item.quantity}
              </div>
            </div>

            <div class="text-end">
              <div class="small text-white-50">Unitario</div>
              <div>${money(item.unit_price)}</div>
              <div class="fw-semibold mt-1">${money(item.line_total)}</div>
            </div>
          </div>
        </div>
      `
      )
      .join("");

    const addressHtml = order.address
      ? `
        <div class="order-address small text-white-50 mt-3">
          <div class="fw-semibold text-light mb-1">Dirección</div>
          <div>${order.address.label || "Entrega"}</div>
          <div>${order.address.line1 || ""} ${order.address.line2 || ""}</div>
          <div>${order.address.city || ""}, ${order.address.state || ""}, ${order.address.postal_code || ""}</div>
          <div>${order.address.country || ""}</div>
        </div>
      `
      : `
        <div class="order-address small text-white-50 mt-3">
          <div class="fw-semibold text-light mb-1">Dirección</div>
          <div>Sin dirección registrada</div>
        </div>
      `;

    const card = document.createElement("section");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-card-header d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <div class="small text-white-50">Pedido #${order.id}</div>
          <h2 class="h5 mb-1">Realizado el ${formatDate(order.created_at)}</h2>
          ${statusBadge(order.status)}
        </div>

        <div class="text-end">
          <div class="small text-white-50">Total</div>
          <div class="h5 mb-0">${money(order.total)}</div>
        </div>
      </div>

      <div class="row g-4 mt-1">
        <div class="col-lg-8">
          <div class="order-section-title">Productos</div>
          <div class="d-flex flex-column gap-3">
            ${itemsHtml || `<div class="text-white-50">Sin artículos.</div>`}
          </div>
        </div>

        <div class="col-lg-4">
          <div class="order-summary-box">
            <div class="order-section-title">Resumen</div>

            <div class="d-flex justify-content-between mb-2">
              <span class="text-white-50">Subtotal</span>
              <span>${money(order.subtotal)}</span>
            </div>

            <div class="d-flex justify-content-between mb-2">
              <span class="text-white-50">Descuento</span>
              <span>${money(order.discount)}</span>
            </div>

            <div class="d-flex justify-content-between mb-2">
              <span class="text-white-50">Envío</span>
              <span>${money(order.shipping_cost)}</span>
            </div>

            <hr class="border-secondary" />

            <div class="d-flex justify-content-between fw-semibold">
              <span>Total</span>
              <span>${money(order.total)}</span>
            </div>

            ${addressHtml}
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  }
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("btnSearch");

  const goSearch = () => {
    const q = (input?.value || "").trim();
    const url = q
      ? `./catalogo.html?q=${encodeURIComponent(q)}`
      : "./catalogo.html";
    window.location.href = url;
  };

  btn?.addEventListener("click", goSearch);
  input?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") goSearch();
  });
}

(async function init() {
  try {
    await initAppShell();
    updateCartBadge();
    setupSearch();

    const user = await getCurrentUser();
    if (!user) {
      showGuestState();
      return;
    }

    const orders = await fetchMyOrders(user.id);

    if (!orders.length) {
      showEmptyState();
      return;
    }

    renderOrders(orders);
    showOrdersState();
  } catch (err) {
    console.error(err);
    showEmptyState();
  }
})();