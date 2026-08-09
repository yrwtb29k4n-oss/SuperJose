-- Rode este script no SQL Editor do painel do Supabase (projeto do sistema Pix)

create table if not exists caixas (
  id serial primary key,
  nome text not null,
  senha_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists transacoes_pix (
  id bigserial primary key,

  -- Qual caixa foi responsavel pelo Pix
  caixa_id integer not null references caixas(id),

  -- Valor definido pelo operador de caixa
  valor numeric(10,2) not null,

  -- Chave Pix (e-mail) do mercado usada NESSA cobranca especifica.
  -- Guardamos aqui (e nao so numa config) para manter historico fiel,
  -- mesmo se a chave do mercado mudar no futuro.
  mp_chave_pix_destino text not null,

  -- Identificador que amarra a cobranca ao caixa dentro do Mercado Pago
  -- (enviado no campo external_reference da API, ex: 'CX12-20260808-153045')
  external_reference text not null unique,

  -- ID do pagamento retornado pelo Mercado Pago apos a confirmacao
  mp_payment_id text,

  status text not null default 'pendente'
    check (status in ('pendente','aprovado','expirado','cancelado')),

  criado_em timestamptz not null default now(),
  pago_em timestamptz,

  -- Comprovante gerado no momento da confirmacao do pagamento
  comprovante_texto text,
  impresso boolean not null default false,
  impresso_em timestamptz
);

-- Indices para localizar rapido a transacao quando o webhook do Mercado Pago chegar
create index if not exists idx_transacoes_external_reference on transacoes_pix(external_reference);
create index if not exists idx_transacoes_mp_payment_id on transacoes_pix(mp_payment_id);
create index if not exists idx_transacoes_caixa_data on transacoes_pix(caixa_id, criado_em);

-- ---------------------------------------------------------------------
-- Views de fechamento: todos os Pix aprovados, agrupados por dia/mes
-- ---------------------------------------------------------------------

create or replace view vw_totais_pix_dia as
select
  caixa_id,
  date(pago_em) as dia,
  count(*) as qtd_pix,
  sum(valor) as total_recebido
from transacoes_pix
where status = 'aprovado'
group by caixa_id, date(pago_em)
order by dia desc, caixa_id;

create or replace view vw_totais_pix_mes as
select
  caixa_id,
  to_char(pago_em, 'YYYY-MM') as mes,
  count(*) as qtd_pix,
  sum(valor) as total_recebido
from transacoes_pix
where status = 'aprovado'
group by caixa_id, to_char(pago_em, 'YYYY-MM')
order by mes desc, caixa_id;

-- Exemplo de insercao de caixas (senha_hash deve ser gerada com bcrypt
-- pelo backend, nunca em texto puro direto no banco).
