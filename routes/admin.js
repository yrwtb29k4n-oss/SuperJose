const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');

const router = express.Router();

// ===================================================================
// GET /admin/caixas — lista todos os caixas (ativos e desativados)
// ===================================================================
router.get('/caixas', async (req, res) => {
  const { data, error } = await supabase
    .from('caixas')
    .select('id, nome, ativo, criado_em')
    .order('id', { ascending: true });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// ===================================================================
// POST /admin/caixas — cria um novo caixa
// body: { caixaId, nome, senha }
// ===================================================================
router.post('/caixas', async (req, res) => {
  const { caixaId, nome, senha } = req.body;

  if (!caixaId || !nome || !senha) {
    return res.status(400).json({ erro: 'caixaId, nome e senha são obrigatórios' });
  }

  const senha_hash = await bcrypt.hash(senha, 10);

  const { data, error } = await supabase
    .from('caixas')
    .insert({ id: Number(caixaId), nome, senha_hash })
    .select('id, nome, ativo')
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  return res.status(201).json(data);
});

// ===================================================================
// DELETE /admin/caixas/:id — desativa um caixa (soft delete)
// Mantem o historico de Pix intacto; o caixa so deixa de conseguir logar.
// ===================================================================
router.delete('/caixas/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('caixas')
    .update({ ativo: false })
    .eq('id', id);

  if (error) return res.status(500).json({ erro: error.message });
  return res.json({ ok: true, mensagem: `Caixa ${id} desativado.` });
});

// ===================================================================
// GET /admin/historico/meses?caixaId=12&turno=1
// Lista os meses (YYYY-MM) que tem algum Pix registrado, pra popular o filtro
// ===================================================================
router.get('/historico/meses', async (req, res) => {
  const { caixaId, turno } = req.query;

  if (!caixaId || !turno) {
    return res.status(400).json({ erro: 'caixaId e turno são obrigatórios' });
  }

  const { data, error } = await supabase
    .from('transacoes_pix')
    .select('criado_em')
    .eq('caixa_id', caixaId)
    .eq('turno', turno)
    .order('criado_em', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });

  const meses = [...new Set(
    data.map(row => row.criado_em.slice(0, 7)) // "YYYY-MM"
  )];

  return res.json(meses);
});

// ===================================================================
// GET /admin/historico/resumo?caixaId=12&turno=1&mes=2026-08
// Totais por dia dentro do mes/turno selecionado (usa a view do banco)
// ===================================================================
router.get('/historico/resumo', async (req, res) => {
  const { caixaId, turno, mes } = req.query;

  if (!caixaId || !turno || !mes) {
    return res.status(400).json({ erro: 'caixaId, turno e mes são obrigatórios' });
  }

  const { data, error } = await supabase
    .from('vw_historico_caixa_turno_dia')
    .select('*')
    .eq('caixa_id', caixaId)
    .eq('turno', turno)
    .gte('dia', `${mes}-01`)
    .lt('dia', `${mes}-32`) // truque simples: qualquer dia do mes cai antes do dia 32
    .order('dia', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// ===================================================================
// GET /admin/historico/detalhe?caixaId=12&turno=1&dia=2026-08-08
// Lista cada Pix individual daquele caixa/turno/dia (para poder deletar um a um)
// ===================================================================
router.get('/historico/detalhe', async (req, res) => {
  const { caixaId, turno, dia } = req.query;

  if (!caixaId || !turno || !dia) {
    return res.status(400).json({ erro: 'caixaId, turno e dia são obrigatórios' });
  }

  const { data, error } = await supabase
    .from('transacoes_pix')
    .select('id, valor, status, criado_em, pago_em, mp_payment_id, external_reference')
    .eq('caixa_id', caixaId)
    .eq('turno', turno)
    .gte('criado_em', `${dia}T00:00:00`)
    .lte('criado_em', `${dia}T23:59:59`)
    .order('criado_em', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// ===================================================================
// DELETE /admin/pix/:id — apaga um Pix especifico
// ===================================================================
router.delete('/pix/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('transacoes_pix')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ erro: error.message });
  return res.json({ ok: true, mensagem: `Pix ${id} removido.` });
});

module.exports = router;
