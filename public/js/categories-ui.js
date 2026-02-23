import supabase from "./supabase-config.js";

// Normaliza para match por texto/slug
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Mapa de reglas → Font Awesome (puedes ajustar cuando quieras)
const ICON_RULES = [
  { test: ["playera", "playeras", "shirt", "tee", "tshirt"], icon: "fa-shirt" },
  { test: ["tote", "totebag", "bolsa", "bags", "bag"], icon: "fa-bag-shopping" },
  { test: ["arete", "aretes", "earring", "earrings"], icon: "fa-gem" },
  { test: ["gorra", "gorras", "cap", "caps"], icon: "fa-hat-cowboy" },
  { test: ["sticker", "stickers", "pegatina", "pegatinas"], icon: "fa-star" },
  { test: ["pulsera", "pulseras", "bracelet"], icon: "fa-link" },
  { test: ["collar", "collares", "necklace"], icon: "fa-ring" },
  { test: ["pin", "pins", "badge", "broche"], icon: "fa-thumbtack" },
  { test: ["poster", "posters", "print", "prints"], icon: "fa-image" },
];

// Fallback si no matchea nada
const DEFAULT_ICON = "fa-shapes";

function pickFAIcon({ name, slug }) {
  const text = `${norm(name)} ${norm(slug)}`;
  for (const rule of ICON_RULES) {
    if (rule.test.some((k) => text.includes(norm(k)))) return rule.icon;
  }
  return DEFAULT_ICON;
}

async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,slug")
    .order("name", { ascending: true });

  if (error) {
    console.warn("categories error:", error.message);
    return [];
  }
  return data || [];
}

export async function renderQuickCategories({
  containerId = "quickCategories",
  max = 8,
  catalogPath = "/html/catalogo.html",
} = {}) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const list = await fetchCategories();
  wrap.innerHTML = "";

  if (!list.length) {
    // Si no hay categorías, ocultamos la sección o dejamos algo mínimo
    wrap.innerHTML =
      `<div class="col-12"><p class="text-secondary small mb-0">Sin categorías.</p></div>`;
    return;
  }

  list.slice(0, max).forEach((c) => {
    const icon = pickFAIcon(c);
    const slug = encodeURIComponent(c.slug || "");
    const col = document.createElement("div");
    col.className = "col-6 col-md-3";

    col.innerHTML = `
      <a class="cat-card" href="${catalogPath}?cat=${slug}">
        <i class="fa-solid ${icon} icon"></i>
        <span>${c.name}</span>
      </a>
    `;
    wrap.appendChild(col);
  });
}