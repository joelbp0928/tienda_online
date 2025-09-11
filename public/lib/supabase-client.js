import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY"; // pública, pero limita RLS

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
