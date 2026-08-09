const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');

const router = express.Router();

// POST /auth/login  { caixaId: 12, senha: "1234", turno: 1 }
router.post('/login', async (req, res) => {
  const { caixaId, senha, turno } = req.body;

  if (!caixaId || !senha || !turno) {
    return res.status(400).json({ erro: 'caixaId, senha e turno são obrigatórios' });
  }

  if (![1, 2].includes(Number(turno))) {
    return res.status(400).json({ erro: 'Turno deve ser 1 ou 2' });
  }

  const { data: caixa, error } = await supabase
    .from('caixas')
    .select('id, nome, senha_hash, ativo')
    .eq('id', caixaId)
    .single();

  if (error || !caixa) {
    return res.status(401).json({ erro: 'Caixa não encontrado' });
  }

  if (!caixa.ativo) {
    return res.status(403).json({ erro: 'Caixa desativado' });
  }

  const senhaOk = await bcrypt.compare(senha, caixa.senha_hash);
  if (!senhaOk) {
    return res.status(401).json({ erro: 'Senha incorreta' });
  }

  const token = jwt.sign(
    { caixaId: caixa.id, nome: caixa.nome, turno: Number(turno) },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  return res.json({
    token,
    caixa: { id: caixa.id, nome: caixa.nome, turno: Number(turno) },
  });
});

module.exports = router;
