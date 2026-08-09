const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');

const router = express.Router();

// GET /admin/caixas
router.get('/caixas', async (req, res) => {
  const { data, error } = await supabase
    .from('caixas')
    .select('id, nome, ativo, criado_em')
    .order('id', { ascending: true });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// POST /admin/caixas  { caixaId, senha }
// O nome do caixa e gerado automaticamente como "Caixa <numero>".
router.post('/caixas', async (req, res) => {
  const { caixaId, senha } = req.body;

  if (!caixaId || !senha) {
    return res.status(400).json({ erro: 'caixaId e senha são obrigatórios' });
  }

  const nome = `Caixa ${caixaId}`;
  const senha_hash = await bcrypt.hash(senha, 10);

  const { data, error } = await supabase
    .from('caixas')
    .insert({ id: Number(caixaId), nome, senha_hash })
    .select('id, nome, ativo')
    .single();

  if (error) return res.status(500).json({ erro: error.message });
  return res.status(201).json(data);
});

// DELETE /admin/caixas/:id — soft delete
router.delete('/caixas/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('caixas')
    .update({ ativo: false })
    .eq('id', id);

  if (error) return res.status(500).json({ erro: error.message });
  return res.json({ ok: true, mensagem: `Caixa ${id} desativado.` });
});

// GET /admin/historico/meses?caixaId=12
router.get('/historico/meses', async (req, res) => {
  const { caixaId } = req.query;
  if (!caixaId) return res.status(400).json({ erro: 'caixaId é obrigatório' });

  const { data, error } = await supabase
    .from('vw_totais_pix_mes')
    .select('mes')
    .eq('caixa_id', caixaId)
    .order('mes', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json([...new Set(data.map(r => r.mes))]);
});

// GET /admin/historico/resumo?caixaId=12&mes=2026-08
router.get('/historico/resumo', async (req, res) => {
  const { caixaId, mes } = req.query;
  if (!caixaId || !mes) {
    return res.status(400).json({ erro: 'caixaId e mes são obrigatórios' });
  }

  const { data, error } = await supabase
    .from('vw_totais_pix_dia')
    .select('*')
    .eq('caixa_id', caixaId)
    .gte('dia', `${mes}-01`)
    .lt('dia', `${mes}-32`)
    .order('dia', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// GET /admin/historico/detalhe?caixaId=12&dia=2026-08-08
router.get('/historico/detalhe', async (req, res) => {
  const { caixaId, dia } = req.query;
  if (!caixaId || !dia) {
    return res.status(400).json({ erro: 'caixaId e dia são obrigatórios' });
  }

  const { data, error } = await supabase
    .from('transacoes_pix')
    .select('id, valor, turno, status, criado_em, pago_em, mp_payment_id, external_reference')
    .eq('caixa_id', caixaId)
    .gte('criado_em', `${dia}T00:00:00`)
    .lte('criado_em', `${dia}T23:59:59`)
    .order('criado_em', { ascending: false });

  if (error) return res.status(500).json({ erro: error.message });
  return res.json(data);
});

// DELETE /admin/pix/:id
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
