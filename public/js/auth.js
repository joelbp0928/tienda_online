// === AUTH UI (Login/Register) ===
 import  supabase from './supabase-config.js';

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
      await supabase
        .from("profiles")
        .upsert(
          { id: userId, email, role: "customer", status: "active" },
          { onConflict: "id" }
        );

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