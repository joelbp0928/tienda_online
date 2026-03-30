import { initAuth } from "./auth.js";
import { initCartPersistence } from "./carrito.js";

export async function initAppShell() {
  await initAuth();
  await initCartPersistence();
}