// === AUTH UI (Login/Register) ===
import supabase from './supabase-config.js';
import { syncCartToDbIfClient } from "./carrito.js";

function showToast(message) {
  const el = document.getElementById("appToast");
  const body = document.getElementById("appToastBody");
  if (!el || !body) return alert(message);
  body.textContent = message;
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 2200 });
  t.show();
}

function setLoading(btn, isLoading, textLoading = "Procesando...") {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.dataset._oldHtml ??= btn.innerHTML;
  btn.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm me-2"></span>${textLoading}` : btn.dataset._oldHtml;
}

export async function initAuthState() {
  const cachedCustomer = getCachedCustomer();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.warn("Error getting session:", error.message);
    updateAuthUI({ session: null, customer: null });
    return;
  }

  const session = data?.session ?? null;

  if (!session?.user) {
    localStorage.removeItem("customer");
    updateAuthUI({ session: null, customer: null });
    return;
  }

  updateAuthUI({ session, customer: cachedCustomer });

  const customer = await getCurrentCustomer(session.user);

  if (customer) {
    localStorage.setItem("customer", JSON.stringify(customer));
  }

  updateAuthUI({ session, customer: customer || cachedCustomer });
}

export function initAuthModals() {
  const formLogin = document.getElementById("formLogin");
  const formRegister = document.getElementById("formRegister");

  const btnGoRegister = document.getElementById("btnGoRegister");
  const btnGoLogin = document.getElementById("btnGoLogin");

  const modalLoginEl = document.getElementById("modalLogin");
  const modalRegisterEl = document.getElementById("modalRegister");

  if (!formLogin || !formRegister || !modalLoginEl || !modalRegisterEl) return;

  const modalLogin = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
  const modalRegister = bootstrap.Modal.getOrCreateInstance(modalRegisterEl);

  // Switch modals
  btnGoRegister?.addEventListener("click", () => {
    modalLogin.hide();
    modalRegister.show();
  });

  btnGoLogin?.addEventListener("click", () => {
    modalRegister.hide();
    modalLogin.show();
  });

  // Login submit
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail")?.value?.trim();
    const password = document.getElementById("loginPassword")?.value;

    const btn = document.getElementById("btnLoginSubmit");
    setLoading(btn, true, "Entrando...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const customer = await getCurrentCustomer(data.user);
      if (customer) {
        localStorage.setItem("customer", JSON.stringify(customer));
      }
      updateAuthUI({ session: data.session, customer });

      await syncCartToDbIfClient({ replace: true });

      showToast("✅ Sesión iniciada correctamente");
      modalLogin.hide();

      // Aquí puedes refrescar UI, carrito, etc.
      // await setupPosts?.(); o loadProducts... depende tu app
    } catch (err) {
      console.warn(err);
      showToast(`❌ No se pudo iniciar sesión: ${err.message || "Error"}`);
    } finally {
      setLoading(btn, false);
    }
  });

  // Register submit
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();

    const full_name = document.getElementById("regFullName")?.value?.trim();
    const phone = document.getElementById("regPhone")?.value?.trim();
    const email = document.getElementById("regEmail")?.value?.trim();
    const password = document.getElementById("regPassword")?.value;

    const btn = document.getElementById("btnRegisterSubmit");
    setLoading(btn, true, "Creando...");

    try {
      // 1) Crear usuario en Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;

      // Nota: dependiendo tu config de Supabase, puede requerir confirmación por correo.
      // Si NO requiere confirmación, el usuario ya queda logueado.
      // Si requiere confirmación, no habrá session activa aún.

      const userId = signUpData?.user?.id;
      if (!userId) {
        showToast("✅ Cuenta creada. Revisa tu correo para confirmar e iniciar sesión.");
        modalRegister.hide();
        return;
      }

      // 2) Guardar en tabla customers (tu DB)
      // customers: id(uuid), email, full_name, phone, created_at
      // id = auth.users.id
      const { error: customerError } = await supabase
        .from("customers")
        .upsert(
          { id: userId, email, full_name, phone },
          { onConflict: "id" }
        );

      if (customerError) throw customerError;

      // 3) (Opcional) Guardar/actualizar en profiles si lo usas
      // profiles: id(uuid), email, role, status, created_at
      // Ajusta role/status como manejes tu app
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          { id: userId, email, role: "client", status: "active" },
          { onConflict: "id" }
        );

      if (profileError) throw profileError;
      const customer = await getCurrentCustomer({ id: userId });
      if (customer) {
        localStorage.setItem("customer", JSON.stringify(customer));
      }
      const { data: sessionData } = await supabase.auth.getSession();
      updateAuthUI({ session: sessionData?.session ?? null, customer });

      await syncCartToDbIfClient({ replace: true });

      showToast("✅ Registro exitoso. ¡Ya puedes hacer pedidos!");
      modalRegister.hide();

      // refrescar UI si quieres
    } catch (err) {
      console.warn(err);
      showToast(`❌ No se pudo registrar: ${err.message || "Error"}`);
    } finally {
      setLoading(btn, false);
    }
  });
}

function getShortName(fullNameOrEmail = "") {
  const value = (fullNameOrEmail || "").trim();
  if (!value) return "Mi cuenta";

  const parts = value.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

async function getCurrentCustomer(user) {
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("id, email, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("Error loading current customer:", error.message);
    return null;
  }

  return data;
}

function updateAuthUI({ session = null, customer = null } = {}) {
  const guestActions = document.getElementById("guestActions");
  const userActions = document.getElementById("userActions");
  const navUserName = document.getElementById("navUserName");

  if (!guestActions || !userActions || !navUserName) return;

  if (session?.user) {
    guestActions.classList.add("d-none");
    userActions.classList.remove("d-none");
    userActions.classList.add("d-flex");

    const displayName =
      customer?.full_name ||
      session.user.user_metadata?.full_name ||
      session.user.email ||
      "Mi cuenta";

    navUserName.textContent = getShortName(displayName);
  } else {
    guestActions.classList.remove("d-none");
    userActions.classList.add("d-none");
    userActions.classList.remove("d-flex");
    navUserName.textContent = "Usuario";
  }
}

export function initLogout() {
  const btnLogout = document.getElementById("btnLogout");
  if (!btnLogout) return;

  btnLogout.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      localStorage.removeItem("customer");
      updateAuthUI({ session: null, customer: null });
      showToast("👋 Sesión cerrada");
    } catch (err) {
      console.warn(err);
      showToast(`❌ No se pudo cerrar sesión: ${err.message || "Error"}`);
    }
  });
}

function watchAuthState() {
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const customer = await getCurrentCustomer(session.user);
      if (customer) {
        localStorage.setItem("customer", JSON.stringify(customer));
      }
      updateAuthUI({ session, customer });
    } else {
      localStorage.removeItem("customer");
      updateAuthUI({ session: null, customer: null });
    }
  });
}

export function getCachedCustomer() {
  try {
    return JSON.parse(localStorage.getItem("customer") || "null");
  } catch {
    return null;
  }
}

export async function initAuth() {
  initAuthModals();
  initLogout();
  await initAuthState();
  watchAuthState();
}