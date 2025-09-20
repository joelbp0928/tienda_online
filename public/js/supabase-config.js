import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
// ⚠️ Solo claves públicas: URL + anon key
const SUPABASE_URL = "https://xcnplkdoiyyqbjhmyabb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjbnBsa2RvaXl5cWJqaG15YWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMTExMjAsImV4cCI6MjA3Mzg4NzEyMH0.URQvIuO5JVrXxK-TzTZHAzSzzpmGb-qmYEm8vYVrOjw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
