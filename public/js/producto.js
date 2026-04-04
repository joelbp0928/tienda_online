import supabase from "./supabase-config.js";
import "./chatBot.js";

import { addToCart, updateCartBadge } from "./carrito.js";
import { initAppShell } from "./app-shell.js";

const $ = (sel) => document.querySelector(sel);
const money = (v) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(v);

const DEMO_IMG = "../img/demo-product.png";

function getSlug() {
  const params = new URLSearchParams(location.search);
  return params.get("slug") || "";
}

function resolveImage(url) {
  if (!url) return DEMO_IMG;
  if (/^https?:\/\//i.test(url)) return url;

  const clean = String(url).replace(/^products\//, "");
  return supabase.storage.from("products").getPublicUrl(clean).data.publicUrl;
}

function showToast(message) {
  const el = document.getElementById("appToast");
  const body = document.getElementById("appToastBody");
  if (!el || !body || typeof bootstrap === "undefined") return;
  body.textContent = message;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2200 }).show();
}

async function fetchProductBySlug(slug) {
  // 1) Base pública para no depender de RLS en products
  const { data: base, error: baseError } = await supabase
    .from("public_catalog_grid")
    .select("product_id, slug, name, cover_url, price_from")
    .eq("slug", slug)
    .maybeSingle();

  if (baseError) throw new Error(baseError.message);
  if (!base) throw new Error("Producto no encontrado");

  // 2) Intentar traer descripción de products (si RLS lo permite)
  let description = "";
  let category_id = null;

  const { data: productExtra } = await supabase
    .from("products")
    .select("description, category_id")
    .eq("id", base.product_id)
    .maybeSingle();

  if (productExtra) {
    description = productExtra.description || "";
    category_id = productExtra.category_id ?? null;
  }

  // 3) Imágenes
  const { data: images, error: imagesError } = await supabase
    .from("product_images")
    .select("url, sort_order")
    .eq("product_id", base.product_id)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    console.warn("product_images error:", imagesError.message);
  }

  // 4) Variantes
  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id, size, color, price, stock")
    .eq("product_id", base.product_id)
    .eq("is_active", true)
    .gt("stock", 0)
    .order("price", { ascending: true });

  if (variantsError) {
    console.warn("product_variants error:", variantsError.message);
  }

  return {
    product: {
      id: base.product_id,
      name: base.name,
      slug: base.slug,
      description,
      category_id,
      price_from: base.price_from,
      cover_url: base.cover_url,
    },
    images: images || [],
    variants: variants || [],
  };
}

function render({ product, images, variants }) {
  const gallery = images.length
    ? images.map((i) => resolveImage(i.url))
    : [resolveImage(product.cover_url)];

  const mainImg = gallery[0] || DEMO_IMG;

  const variantOptions =
    variants
      .map(
        (v) => `
      <option value="${v.id}">
        ${[v.size, v.color].filter(Boolean).join(" / ") || "Única"} — ${money(v.price)} — Stock ${v.stock}
      </option>
    `
      )
      .join("") || `<option value="">No hay variantes con stock</option>`;

  $("#view").innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <div class="card bg-dark border-secondary">
          <img id="mainProductImg" src="${mainImg}" class="card-img-top" alt="${product.name}" onerror="this.src='${DEMO_IMG}'">
        </div>

        <div class="d-flex gap-2 mt-2 flex-wrap">
          ${gallery
            .slice(0, 6)
            .map(
              (src) => `
              <img
                src="${src}"
                width="72"
                height="72"
                class="rounded border"
                style="object-fit:cover;cursor:pointer"
                data-thumb-src="${src}"
                onerror="this.src='${DEMO_IMG}'"
              >
            `
            )
            .join("")}
        </div>
      </div>

      <div class="col-md-6">
        <h1 class="h3">${product.name}</h1>
        <p class="text-secondary">${product.description || "Sin descripción disponible."}</p>

        <div class="mb-2">
          <small class="text-white-50">Desde</small>
          <div class="h5 mb-0">${money(product.price_from || 0)}</div>
        </div>

        <label class="form-label mt-3">Variantes / Tallas</label>
        <select id="variant" class="form-select form-select-sm">
          ${variantOptions}
        </select>

        <div class="d-flex align-items-center gap-2 mt-3">
          <input
            id="qty"
            type="number"
            min="1"
            value="1"
            class="form-control form-control-sm"
            style="max-width:100px"
          >
          <button id="add" class="btn btn-light btn-sm">
            <i class="bi bi-bag-plus"></i> Agregar al carrito
          </button>
        </div>

        <div class="mt-4">
          <a class="btn btn-outline-light btn-sm" href="./catalogo.html">Seguir comprando</a>
        </div>
      </div>
    </div>
  `;

  // thumbs
  document.querySelectorAll("[data-thumb-src]").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const main = document.getElementById("mainProductImg");
      if (main) main.src = thumb.dataset.thumbSrc;
    });
  });

  // carrito nuevo
  $("#add").addEventListener("click", async () => {
    try {
      const rawVariant = $("#variant")?.value;
      const variant_id = rawVariant ? Number(rawVariant) : null;
      const quantity = Math.max(1, parseInt($("#qty")?.value || "1", 10));

      await addToCart({
        product_id: product.id,
        variant_id,
        quantity,
      });

      updateCartBadge();
      showToast("Producto agregado al carrito");
    } catch (err) {
      console.error(err);
      showToast(`No se pudo agregar: ${err.message || "Error"}`);
    }
  });
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

    const slug = getSlug();
    if (!slug) throw new Error("Producto no especificado");

    const data = await fetchProductBySlug(slug);
    render(data);
  } catch (e) {
    $("#view").innerHTML = `<div class="alert alert-danger">No se pudo cargar el producto: ${e.message}</div>`;
    console.error(e);
  }
})();