import supabase from "./supabase-config.js";
import { initAppShell } from "./app-shell.js";
import {
  fetchCartDetails,
  setCartItemQuantity,
  removeFromCart,
  clearCart,
  updateCartBadge,
  mergeGuestCartOnLogin,
  isClientLogged,
} from "./carrito.js";

const DEMO_IMG = "./img/demo-product.png";

function money(value) {
  return `$${Number(value || 0).toFixed(2)} MXN`;
}

function resolveCover(url) {
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url) {
    const clean = String(url).replace(/^products\//, "");
    return supabase.storage.from("products").getPublicUrl(clean).data.publicUrl;
  }
  return DEMO_IMG;
}

function showToast(message) {
  const el = document.getElementById("appToast");
  const body = document.getElementById("appToastBody");
  if (!el || !body || typeof bootstrap === "undefined") return;
  body.textContent = message;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2200 }).show();
}

function renderSummary(items) {
  const totalItems = items.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const subtotal = items.reduce((s, x) => s + Number(x.line_total || 0), 0);

  document.getElementById("summaryItems").textContent = totalItems;
  document.getElementById("summarySubtotal").textContent = money(subtotal);
  document.getElementById("summaryTotal").textContent = money(subtotal);
}

function lineMeta(item) {
  const parts = [];
  if (item.size) parts.push(`Talla: ${item.size}`);
  if (item.color) parts.push(`Color: ${item.color}`);
  return parts.join(" · ");
}

async function renderCartPage() {
  const list = document.getElementById("cartList");
  const empty = document.getElementById("cartEmpty");

  if (!list || !empty) return;

  const items = await fetchCartDetails();

  list.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("d-none");
    renderSummary([]);
    return;
  }

  empty.classList.add("d-none");

  for (const item of items) {
    const row = document.createElement("article");
    row.className = "cart-item-card";
    row.innerHTML = `
      <div class="cart-item-grid">
        <a href="/html/producto.html?slug=${encodeURIComponent(item.slug)}" class="cart-item-media">
          <img
            src="${resolveCover(item.cover_url)}"
            alt="${item.name}"
            class="cart-item-img"
            onerror="this.src='${DEMO_IMG}'"
          />
        </a>

        <div class="cart-item-main">
          <div class="d-flex justify-content-between gap-3 flex-wrap">
            <div>
              <h3 class="h6 mb-1">${item.name}</h3>
              <div class="small text-white-50">${lineMeta(item) || "Sin variante específica"}</div>
            </div>

            <button
              class="btn btn-sm btn-outline-danger"
              data-remove-item
              data-product-id="${item.product_id}"
              data-variant-id="${item.variant_id ?? ""}"
              title="Eliminar"
            >
              <i class="bi bi-trash3"></i>
            </button>
          </div>

          <div class="d-flex justify-content-between align-items-center gap-3 mt-3 flex-wrap">
            <div class="cart-qty-box">
              <button
                class="btn btn-sm btn-outline-light"
                data-qty-action="minus"
                data-product-id="${item.product_id}"
                data-variant-id="${item.variant_id ?? ""}"
              >-</button>

              <input
                class="form-control form-control-sm text-center cart-qty-input"
                type="number"
                min="1"
                value="${item.quantity}"
                data-qty-input
                data-product-id="${item.product_id}"
                data-variant-id="${item.variant_id ?? ""}"
              />

              <button
                class="btn btn-sm btn-outline-light"
                data-qty-action="plus"
                data-product-id="${item.product_id}"
                data-variant-id="${item.variant_id ?? ""}"
              >+</button>
            </div>

            <div class="text-end">
              <div class="small text-white-50">Precio unitario</div>
              <div>${money(item.unit_price)}</div>
            </div>

            <div class="text-end">
              <div class="small text-white-50">Subtotal</div>
              <div class="fw-semibold">${money(item.line_total)}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    list.appendChild(row);
  }

  renderSummary(items);
  updateCartBadge();
}

function getIdsFromElement(el) {
  return {
    product_id: Number(el.dataset.productId),
    variant_id: el.dataset.variantId ? Number(el.dataset.variantId) : null,
  };
}

function bindCartPageEvents() {
  const list = document.getElementById("cartList");
  const btnClear = document.getElementById("btnClearCart");
  const btnCheckout = document.getElementById("btnCheckout");

  list?.addEventListener("click", async (e) => {
    const removeBtn = e.target.closest("[data-remove-item]");
    if (removeBtn) {
      const ids = getIdsFromElement(removeBtn);
      await removeFromCart(ids);
      showToast("Producto eliminado");
      await renderCartPage();
      return;
    }

    const qtyBtn = e.target.closest("[data-qty-action]");
    if (qtyBtn) {
      const ids = getIdsFromElement(qtyBtn);
      const input = list.querySelector(
        `[data-qty-input][data-product-id="${ids.product_id}"][data-variant-id="${ids.variant_id ?? ""}"]`
      );
      const current = Number(input?.value || 1);
      const next = qtyBtn.dataset.qtyAction === "plus" ? current + 1 : Math.max(1, current - 1);

      await setCartItemQuantity({ ...ids, quantity: next });
      await renderCartPage();
    }
  });

  list?.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-qty-input]");
    if (!input) return;

    const ids = getIdsFromElement(input);
    const quantity = Math.max(1, Number(input.value || 1));

    await setCartItemQuantity({ ...ids, quantity });
    await renderCartPage();
  });

  btnClear?.addEventListener("click", async () => {
    const confirmed = window.confirm("¿Deseas vaciar todo el carrito?");
    if (!confirmed) return;

    await clearCart();
    showToast("Carrito vaciado");
    await renderCartPage();
  });

  btnCheckout?.addEventListener("click", async () => {
    const ok = await isClientLogged();

    if (!ok) {
      showToast("Inicia sesión como cliente para continuar");
      const modal = document.getElementById("modalLogin");
      if (modal && typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(modal).show();
      }
      return;
    }

    window.location.href = "/checkout.html";
  });
}

(async function initCarritoPage() {
  document.title = "Carrito | RadioEar";

  await initAppShell();
  await mergeGuestCartOnLogin();

  bindCartPageEvents();
  await renderCartPage();
})();