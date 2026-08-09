// Protege as rotas de administrador com uma senha simples (provisoria).
function autenticarAdmin(req, res, next) {
  const senha = req.headers['x-admin-senha'];

  if (!senha || senha !== process.env.ADMIN_SENHA) {
    return res.status(401).json({ erro: 'Senha de administrador incorreta' });
  }

  next();
}

module.exports = autenticarAdmin;
