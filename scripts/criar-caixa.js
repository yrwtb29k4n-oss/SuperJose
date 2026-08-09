// scripts/criar-caixa.js
// Uso: node scripts/criar-caixa.js 12 "Caixa 12" "senha-do-caixa"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');

async function main() {
  const [, , id, nome, senha] = process.argv;
  if (!id || !nome || !senha) {
    console.log('Uso: node scripts/criar-caixa.js <id> "<nome>" "<senha>"');
    process.exit(1);
  }

  const senha_hash = await bcrypt.hash(senha, 10);

  const { error } = await supabase
    .from('caixas')
    .insert({ id: Number(id), nome, senha_hash });

  if (error) {
    console.error('Erro ao criar caixa:', error.message);
    process.exit(1);
  }

  console.log(`Caixa "${nome}" (id ${id}) criado com sucesso.`);
}

main();
