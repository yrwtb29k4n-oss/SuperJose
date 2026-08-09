const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('Faltam SUPABASE_URL / SUPABASE_SECRET_KEY no .env');
}

// Usamos a secret key aqui porque este é um backend confiável
// (roda no nosso servidor, nunca no navegador/app do cliente).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = supabase;
