require('dotenv').config();
const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');
const pixRoutes = require('./routes/pix');
const adminRoutes = require('./routes/admin');
const autenticarCaixa = require('./middleware/auth');
const autenticarAdmin = require('./middleware/admin');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas publicas
app.use('/auth', authRoutes);

// Webhook do Mercado Pago (NAO leva autenticacao de caixa/admin,
// é o Mercado Pago que chama isso direto)
app.post('/webhook/mercadopago', pixRoutes.webhookHandler);

// Rotas do caixa (precisam de token JWT)
app.use('/pix', autenticarCaixa, pixRoutes.router);

// Rotas do admin (precisam da senha de admin)
app.use('/admin', autenticarAdmin, adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
