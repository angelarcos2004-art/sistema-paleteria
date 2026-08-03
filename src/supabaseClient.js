import { createClient } from '@supabase/supabase-js';

// Constantes que almacenan la URL del proyecto y la clave anonima publica.
const SUPABASE_URL = 'https://zvczvklctilcvwexxqzl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2Y3p2a2xjdGlsY3Z3ZXh4cXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjUyNDcsImV4cCI6MjEwMTMwMTI0N30.O-UncrTNalIzV54Hp9Ort7EwQiyB2VGoiYL4plSyVoY';

// Instancia global del cliente de Supabase para su importacion en los componentes.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
