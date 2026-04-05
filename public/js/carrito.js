import supabase from "./supabase-config.js";

const CART_KEY = "cart_v1";
const SESSION_KEY = "cart_session_id";

function showToast(message) {
  const el = document.getElementById("appToast");
  const body = document.getElementById("appToastBody");
  if (!el || !body || typeof bootstrap === "undefined") return;
  body.textContent = message;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2200 }).show();
}

export function getOrCreateSessionId() {
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
    variant_id:
      i.variant_id === null || i.variant_id === undefined || i.variant_id === ""
        ? null
        : Number(i.variant_id),
    quantity: Math.max(1, Number(i.quantity || 1)),
  };
}

function sameKey(a, b) {
  return Number(a.product_id) === Number(b.product_id) &&
    (a.variant_id ?? null) === (b.variant_id ?? null);
}

function compactCartItems(items = []) {
  const compacted = [];

  for (const raw of items) {
    const item = normalizeItem(raw);
    if (!item.product_id) continue;

    const found = compacted.find((x) => sameKey(x, item));
    if (found) {
      found.quantity += item.quantity;
    } else {
      compacted.push({ ...item });
    }
  }

  return compacted;
}

function saveCompactCart(items = []) {
  const compacted = compactCartItems(items);
  writeLocalCart(compacted);
  return compacted;
}

export function getLocalCart() {
  return compactCartItems(readLocalCart());
}

export function getCartCount() {
  return compactCartItems(readLocalCart())
    .reduce((s, it) => s + Number(it.quantity || 0), 0);
}

export function updateCartBadge(badgeId = "cartCount") {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  badge.textContent = String(getCartCount());
}

export async function addToCart({ product_id, variant_id = null, quantity = 1 } = {}) {
  const item = normalizeItem({ product_id, variant_id, quantity });
  if (!item.product_id) throw new Error("Producto inválido");

  const cart = readLocalCart();
  cart.push(item);

  saveCompactCart(cart);
  updateCartBadge();
  await syncCartToDbIfClient();
}

export async function removeFromCart({ product_id, variant_id = null } = {}) {
  const target = normalizeItem({ product_id, variant_id, quantity: 1 });
  const next = readLocalCart().filter((x) => !sameKey(x, target));
  writeLocalCart(next);
  updateCartBadge();
  await syncCartToDbIfClient({ replace: true });
}

export async function setCartItemQuantity({ product_id, variant_id = null, quantity = 1 } = {}) {
  const target = normalizeItem({ product_id, variant_id, quantity });
  const cart = readLocalCart();
  const found = cart.find((x) => sameKey(x, target));

  if (!found) return;

  found.quantity = Math.max(1, Number(quantity || 1));
  writeLocalCart(cart);
  updateCartBadge();
  await syncCartToDbIfClient({ replace: true });
}

export async function clearCart() {
  writeLocalCart([]);
  updateCartBadge();
  await clearDbCartIfClient();
}

export function bindAddToCartButtons(root = document) {
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-add-to-cart]");
    if (!btn) return;

    const product_id = Number(btn.dataset.productId);
    const variant_id = btn.dataset.variantId ? Number(btn.dataset.variantId) : null;
    const quantity = btn.dataset.qty ? Number(btn.dataset.qty) : 1;

    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Agregando...`;

    try {
      await addToCart({ product_id, variant_id, quantity });
      updateCartBadge();
      btn.innerHTML = `<i class="fa-solid fa-check me-1"></i> Agregado`;
      showToast("Producto agregado al carrito");
      setTimeout(() => {
        btn.innerHTML = prev;
      }, 900);
    } catch (err) {
      console.warn(err);
      btn.innerHTML = prev;
      showToast("No se pudo agregar al carrito");
    } finally {
      btn.disabled = false;
    }
  });
}

async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

async function getMyRole() {
  try {
    const { data: role, error } = await supabase.rpc("whoami_role");
    if (!error && role) return role;
  } catch { }

  try {
    const user = await getAuthUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data?.role) return data.role;
  } catch { }

  return null;
}

export async function isClientLogged() {
  const user = await getAuthUser();
  if (!user) {
    showToast("❌ Debes iniciar sesión como cliente para comprar");
    return false;
  }
  
  const role = await getMyRole();
  
  if (role !== "client") {
    showToast("❌ Solo se puede comprar con rol de cliente");
    return false;
  }
  
  return true;
}

async function clearDbCartIfClient() {
  const user = await getAuthUser();
  if (!user) return;

  const okClient = await isClientLogged();
  if (!okClient) return;

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("customer_id", user.id);

  if (error) console.warn("clear db cart error:", error.message);
}

export async function syncCartToDbIfClient({ replace = false } = {}) {
  const user = await getAuthUser();
  if (!user) return;

  const okClient = await isClientLogged();
  if (!okClient) return;

  const customer_id = user.id;
  const session_id = getOrCreateSessionId();
  const local = readLocalCart();

  if (replace) {
    const { error: deleteError } = await supabase
      .from("cart_items")
      .delete()
      .eq("customer_id", customer_id);

    if (deleteError) {
      console.warn("replace cart delete error:", deleteError.message);
      return;
    }
  }

  if (!local.length) return;

  const rows = local.map((it) => ({
    customer_id,
    session_id,
    product_id: it.product_id,
    variant_id: it.variant_id,
    quantity: it.quantity,
  }));

  const { error } = await supabase
    .from("cart_items")
    .upsert(rows, { onConflict: "customer_id,product_id,variant_id" });

  if (error) {
    console.warn("sync cart error:", error.message);
  }
}

export async function hydrateLocalFromDbIfClient() {
  const user = await getAuthUser();
  if (!user) return;

  const okClient = await isClientLogged();
  if (!okClient) return;

  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, variant_id, quantity, added_at")
    .eq("customer_id", user.id)
    .order("added_at", { ascending: true });

  if (error) {
    console.warn("hydrate cart error:", error.message);
    return;
  }

  const dbItems = (data || []).map((x) => ({
    product_id: x.product_id,
    variant_id: x.variant_id ?? null,
    quantity: x.quantity,
  }));

  if (!dbItems.length) return;

  saveCompactCart(dbItems);
  updateCartBadge();
}

export async function mergeGuestCartOnLogin() {
  await syncCartToDbIfClient({ replace: true });
}

export async function fetchCartDetails() {
  const cart = compactCartItems(readLocalCart());
  if (!cart.length) return [];

  const productIds = [...new Set(cart.map((x) => Number(x.product_id)).filter(Boolean))];
  const variantIds = [...new Set(cart.map((x) => x.variant_id).filter((v) => v !== null))];

  const { data: products, error: productsError } = await supabase
    .from("public_catalog_grid")
    .select("product_id, slug, name, price_from, cover_url")
    .in("product_id", productIds);

  if (productsError) {
    console.warn("fetch cart products error:", productsError.message);
    return [];
  }

  let variants = [];
  if (variantIds.length) {
    const { data: variantsData, error: variantsError } = await supabase
      .from("product_variants")
      .select("id, product_id, size, color, price, stock, is_active")
      .in("id", variantIds);

    if (!variantsError) variants = variantsData || [];
  }

  return cart.map((line) => {
    const product = (products || []).find((p) => Number(p.product_id) === Number(line.product_id));
    const variant = (variants || []).find((v) => Number(v.id) === Number(line.variant_id));

    const unitPrice = Number(variant?.price ?? product?.price_from ?? 0);
    const qty = Number(line.quantity || 1);

    return {
      product_id: Number(line.product_id),
      variant_id: line.variant_id ?? null,
      slug: product?.slug || "",
      name: product?.name || "Producto",
      cover_url: product?.cover_url || null,
      size: variant?.size || null,
      color: variant?.color || null,
      stock: variant?.stock ?? null,
      unit_price: unitPrice,
      quantity: qty,
      line_total: unitPrice * qty,
    };
  });
}

export async function initCartPersistence() {
  updateCartBadge();

  const { data } = await supabase.auth.getSession();
  const session = data?.session ?? null;

  if (session?.user) {
    await hydrateLocalFromDbIfClient();
  }

  updateCartBadge();
}