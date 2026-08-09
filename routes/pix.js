const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const supabase = require('../db/supabase');

const router = express.Router();

const MP_API = 'https://api.mercadopago.com/v1/payments';

function gerarExternalReference(caixaId, turno) {
  const agora = new Date();
  const yyyy = agora.getFullYear();
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  const hh = String(agora.getHours()).padStart(2, '0');
  const mi = String(agora.getMinutes()).padStart(2, '0');
  const ss = String(agora.getSeconds()).padStart(2, '0');
  return `CX${caixaId}-T${turno}-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

// ===================================================================
// POST /pix/gerar  { valor: 25.90 }
// Cria a cobranca no Mercado Pago e grava a transacao como 'pendente'
// ===================================================================
router.post('/gerar', async (req, res) => {
  const { valor, turno } = req.body;
  const caixaId = req.caixa.id;

  if (!valor || isNaN(valor) || valor <= 0) {
    return res.status(400).json({ erro: 'Valor invalido' });
  }

  if (turno !== '1' && turno !== '2') {
    return res.status(400).json({ erro: 'Turno invalido. Selecione 1 ou 2.' });
  }

  const externalReference = gerarExternalReference(caixaId, turno);

  try {
    const mpResp = await fetch(MP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(valor),
        description: `Pix Super Jose - ${req.caixa.nome}`,
        payment_method_id: 'pix',
        payer: { email: process.env.MP_CHAVE_PIX },
        external_reference: externalReference,
        notification_url: process.env.NOTIFICATION_URL,
      }),
    });

    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      console.error('Erro Mercado Pago:', mpData);
      return res.status(502).json({ erro: 'Falha ao gerar cobranca no Mercado Pago' });
    }

    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    const mpPaymentId = String(mpData.id);

    const { error } = await supabase.from('transacoes_pix').insert({
      caixa_id: caixaId,
      turno,
      valor: Number(valor),
      mp_chave_pix_destino: process.env.MP_CHAVE_PIX,
      external_reference: externalReference,
      mp_payment_id: mpPaymentId,
      status: 'pendente',
    });

    if (error) {
      console.error('Erro ao salvar transacao:', error);
      return res.status(500).json({ erro: 'Falha ao salvar transacao' });
    }

    return res.json({ externalReference, qrCodeBase64 });
  } catch (e) {
    console.error('Erro inesperado ao gerar Pix:', e);
    return res.status(500).json({ erro: 'Erro interno ao gerar Pix' });
  }
});

// ===================================================================
// GET /pix/status/:externalReference
// O front faz polling nesta rota ate o status virar 'aprovado'
// ===================================================================
router.get('/status/:externalReference', async (req, res) => {
  const { externalReference } = req.params;

  const { data, error } = await supabase
    .from('transacoes_pix')
    .select('valor, status, pago_em, mp_payment_id')
    .eq('external_reference', externalReference)
    .eq('caixa_id', req.caixa.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ erro: 'Transacao nao encontrada' });
  }

  return res.json({
    status: data.status,
    valor: data.valor,
    pagoEm: data.pago_em,
    mpPaymentId: data.mp_payment_id,
  });
});

// ===================================================================
// Webhook do Mercado Pago — chamado automaticamente quando o pagamento
// muda de status. Nao tem autenticacao de caixa/admin.
// ===================================================================
async function webhookHandler(req, res) {
  try {
    const paymentId = req.query['data.id'] || req.body?.data?.id;

    if (!paymentId) {
      return res.status(200).json({ ok: true }); // ignora notificacoes sem id
    }

    const mpResp = await fetch(`${MP_API}/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      console.error('Erro ao consultar pagamento no Mercado Pago:', mpData);
      return res.status(200).json({ ok: true });
    }

    const statusMap = {
      approved: 'aprovado',
      rejected: 'cancelado',
      cancelled: 'cancelado',
      refunded: 'cancelado',
    };
    const novoStatus = statusMap[mpData.status] || 'pendente';

    const atualizacao = { status: novoStatus };
    if (novoStatus === 'aprovado') {
      atualizacao.pago_em = new Date().toISOString();
      atualizacao.comprovante_texto = `Pix aprovado - R$ ${mpData.transaction_amount} - ${mpData.external_reference}`;
    }

    const { error } = await supabase
      .from('transacoes_pix')
      .update(atualizacao)
      .eq('external_reference', mpData.external_reference);

    if (error) console.error('Erro ao atualizar transacao via webhook:', error);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Erro no webhook do Mercado Pago:', e);
    return res.status(200).json({ ok: true }); // sempre 200 pro MP nao reenviar em loop
  }
}

module.exports = { router, webhookHandler };
