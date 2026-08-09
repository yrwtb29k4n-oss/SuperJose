require('dotenv').config();
const express = require('express');

const authRoutes = require('../routes/auth');
const pixRoutes = require('../routes/pix');
const adminRoutes = require('../routes/admin');
const autenticarCaixa = require('../middleware/auth');
const autenticarAdmin = require('../middleware/admin');

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.post('/webhook/mercadopago', pixRoutes.webhookHandler);
app.use('/pix', autenticarCaixa, pixRoutes.router);
app.use('/admin', autenticarAdmin, adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

module.exports = app;
