import supabase from "./supabase-config.js";
import "./chatBot.js";
import { initAppShell } from "./app-shell.js";

const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const money = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v);

const imageCache = new Map();

async function fetchProducts(search = "") {
  let q = supabase
    .from("public_catalog_grid")
    .select("product_id, slug, name, price_from, variants_available, cover_url")
    .order("product_id", { ascending: false });

  if (search) q = q.ilike("name", `%${search}%`);

  const { data, error } = await q;
  if (error) {
    console.error(error.message);
    return [];
  }
  return data || [];
}

const resolveCover = (url) => {
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url) {
    const clean = String(url).replace(/^products\//, "");
    return supabase.storage.from("products").getPublicUrl(clean).data.publicUrl;
  }
  return "../img/demo-product.png";
};

function render(list) {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");

  if (!grid || !empty) return;

  grid.innerHTML = "";

  if (!list.length) {
    empty.classList.remove("d-none");
    return;
  }

  empty.classList.add("d-none");

  for (const p of list) {
    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3";
    const img = resolveCover(p.cover_url);

    col.innerHTML = `
      <a href="producto.html?slug=${encodeURIComponent(p.slug)}" class="text-decoration-none text-light">
        <div class="card h-100">
          <img
            src="${img}"
            class="card-img-top"
            alt="${p.name}"
            onerror="this.src='../img/demo-product.png'"
          >
          <div class="card-body d-flex flex-column">
            <h3 class="h6 mb-1">${p.name}</h3>
            <small class="text-secondary mb-2">
              Desde ${money(p.price_from)} • ${p.variants_available} variantes
            </small>
            <div class="mt-auto d-flex justify-content-between align-items-center">
              <span class="badge text-bg-dark w-100">Ver detalle</span>
            </div>
          </div>
        </div>
      </a>
    `;
    grid.appendChild(col);

    if (!canHover) continue;

    const imgEl = col.querySelector("img.card-img-top");
    if (!imgEl) continue;

    imgEl.dataset.baseSrc = img;

    imgEl.addEventListener("mouseenter", async () => {
      const imgs = await fetchProductImages(p.product_id);
      if (imgs.length <= 1) return;

      const base = imgEl.dataset.baseSrc;
      let listImgs = imgs;
      if (base && !imgs.includes(base)) listImgs = [base, ...imgs];

      startHoverCycle(imgEl, listImgs);
    });

    imgEl.addEventListener("mouseleave", () => {
      stopHoverCycle(imgEl);
    });
  }
}

async function fetchProductImages(productId) {
  if (imageCache.has(productId)) return imageCache.get(productId);

  const { data, error } = await supabase
    .from("product_images")
    .select("url")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(6);

  if (error) {
    console.error("Error cargando imágenes:", error.message);
    imageCache.set(productId, []);
    return [];
  }

  const urls = (data || []).map((r) => resolveCover(r.url)).filter(Boolean);
  imageCache.set(productId, urls);
  return urls;
}

function startHoverCycle(imgEl, urls) {
  if (!urls || urls.length <= 1) return;

  stopHoverCycle(imgEl);

  let i = 0;
  const baseSrc = imgEl.dataset.baseSrc || imgEl.src;

  imgEl._hoverTimer = setInterval(() => {
    i = (i + 1) % urls.length;
    const nextSrc = urls[i] || baseSrc;

    imgEl.style.opacity = "0";
    const swap = () => {
      imgEl.removeEventListener("transitionend", swap);
      imgEl.src = nextSrc;

      const onLoad = () => {
        imgEl.style.opacity = "1";
        imgEl.removeEventListener("load", onLoad);
      };
      imgEl.addEventListener("load", onLoad);
    };
    imgEl.addEventListener("transitionend", swap);
  }, 680);
}

function stopHoverCycle(imgEl) {
  if (imgEl._hoverTimer) {
    clearInterval(imgEl._hoverTimer);
    imgEl._hoverTimer = null;
  }
  const base = imgEl.dataset.baseSrc;
  if (base) imgEl.src = base;
}

async function load(search = "") {
  const data = await fetchProducts(search);
  render(data);
}

function setupSearch() {
  const qInput = document.getElementById("q");
  const searchInput = document.getElementById("searchInput");

  document.querySelectorAll("#btnSearch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = (qInput?.value || searchInput?.value || "").trim();
      load(q);
    });
  });

  qInput?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      const q = qInput.value.trim();
      load(q);
    }
  });

  searchInput?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      const q = searchInput.value.trim();
      load(q);
    }
  });
}

(async function init() {
  await initAppShell();
  setupSearch();
  await load();
})();