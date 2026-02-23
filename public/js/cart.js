import supabase from "./supabase-config.js";

const CART_KEY = "cart_v1";
const SESSION_KEY = "cart_session_id";

function getOrCreateSessionId() {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function readLocalCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function normalizeItem(i) {
  return {
    product_id: Number(i.product_id),
    variant_id: i.variant_id === null || i.variant_id === undefined || i.variant_id === "" ? null : Number(i.variant_id),
    quantity: Math.max(1, Number(i.quantity || 1)),
  };
}

function sameKey(a, b) {
  return Number(a.product_id) === Number(b.product_id) && (a.variant_id ?? null) === (b.variant_id ?? null);
}

export function getCartCount() {
  const cart = readLocalCart();
  return cart.reduce((s, it) => s + Number(it.quantity || 0), 0);
}

export function updateCartBadge(badgeId = "cartCount") {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  badge.textContent = String(getCartCount());
}

/**
 * Agrega al carrito (guest o logeado).
 * product_id: requerido
 * variant_id: opcional (null si aún no eliges variante)
 */
export async function addToCart({ product_id, variant_id = null, quantity = 1 } = {}) {
  const item = normalizeItem({ product_id, variant_id, quantity });
  if (!item.product_id) return;

  // 1) Local cache (siempre)
  const cart = readLocalCart();
  const found = cart.find((x) => sameKey(x, item));
  if (found) found.quantity = Number(found.quantity) + item.quantity;
  else cart.push(item);

  writeLocalCart(cart);
  updateCartBadge();

  // 2) Sync a DB solo si es client logeado
  await syncCartToDbIfClient();
}

/**
 * Vincula botones del DOM: cualquier elemento con data-add-to-cart
 * Ejemplo:
 * <button data-add-to-cart data-product-id="123" data-variant-id="4">Añadir</button>
 */
export function bindAddToCartButtons(root = document) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-to-cart]");
    if (!btn) return;

    const product_id = Number(btn.dataset.productId);
    const variant_id = btn.dataset.variantId ? Number(btn.dataset.variantId) : null;
    const quantity = btn.dataset.qty ? Number(btn.dataset.qty) : 1;

    btn.disabled = true;
    const prev = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Agregando...`;

    try {
      await addToCart({ product_id, variant_id, quantity });
      btn.innerHTML = `<i class="fa-solid fa-check me-1"></i> Agregado`;
      setTimeout(() => (btn.innerHTML = prev), 900);
    } catch (err) {
      console.warn(err);
      btn.innerHTML = prev;
      alert("No se pudo agregar al carrito.");
    } finally {
      btn.disabled = false;
    }
  });
}

// -------- Auth / Role helpers --------
async function getMyRole() {
  // 1) intenta RPC si existe (como en admin)
  try {
    const { data: role, error } = await supabase.rpc("whoami_role");
    if (!error && role) return role;
  } catch {}

  // 2) fallback a profiles (si existe y hay permiso)
  try {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user.id).maybeSingle();
    if (!error && data?.role) return data.role;
  } catch {}

  return null;
}

async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

async function isClientLogged() {
  const user = await getAuthUser();
  if (!user) return false;
  const role = await getMyRole();
  return role === "client";
}

// -------- Sync con DB (cart_items) --------
export async function syncCartToDbIfClient() {
  const user = await getAuthUser();
  if (!user) return;

  const okClient = await isClientLogged();
  if (!okClient) return;

  const customer_id = user.id; // asumiendo que customers.id = auth.uid()
  const session_id = getOrCreateSessionId();
  const local = readLocalCart();

  if (!local.length) {
    // Si no hay local, podrías traer DB -> local (opcional)
    await hydrateLocalFromDb(customer_id, session_id);
    updateCartBadge();
    return;
  }

  // Upsert rows en DB
  const rows = local.map((it) => ({
    customer_id,
    session_id,              // útil para rastrear que venía de guest
    product_id: it.product_id,
    variant_id: it.variant_id,
    quantity: it.quantity,
  }));

  // Nota: para que upsert sea “perfecto”, conviene el unique index sugerido arriba
  const { error } = await supabase
    .from("cart_items")
    .upsert(rows, { onConflict: "customer_id,session_id,product_id,variant_id" });

  if (error) {
    console.warn("sync cart error:", error.message);
  }
}

async function hydrateLocalFromDb(customer_id, session_id) {
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id,variant_id,quantity")
    .eq("customer_id", customer_id)
    .order("added_at", { ascending: true });

  if (error) return;

  const dbItems = (data || []).map((x) => ({
    product_id: x.product_id,
    variant_id: x.variant_id ?? null,
    quantity: x.quantity,
  }));

  if (!dbItems.length) return;

  writeLocalCart(dbItems);
}