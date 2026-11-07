# Changelog

As mudanças registram a evolução do aplicativo e sua documentação. Não há release GitHub nem publicação declarada por este arquivo.

## [Unreleased]

### Mudança de escopo — 2026-11-07

- A raiz passou a ser documentada como quadro público de despesas comuns, sem landing page e sem login.
- O quadro público consolida somente a competência `YYYY-MM` mais recente cadastrada, aberta ou fechada, e expõe o DTO mínimo de `shared/public-dashboard.ts`.
- A área privada passou a ser exclusiva do síndico em `/sindico`, com usuário `admin` e segredo de runtime `CONDO_ADMIN_PASSWORD`.
- O contrato novo documenta `auth.login`, `auth.me`, `auth.logout`, `publicDashboard.get`, `condo.get` e `condo.save` com sessão própria do aplicativo.
- A sessão própria usa token opaco de 256 bits, somente hash persistido no MySQL, validade de oito horas, comparação de senha com `scrypt`/tempo constante e rate limit por IP e global.
- `condo_memberships` e `condo_invites` permanecem somente como legado histórico; não concedem acesso e não montam portal, convite ou login de morador.
- A documentação passou a separar visibilidade/publicação da plataforma de autorização privada da aplicação.

### Financeiro preservado

- Rateio compartilhado continua com configuração opcional, métodos igual/fração, snapshots, despesas explicitamente rateáveis, maiores restos e desempate estável por `unitId`.
- Composição central mantém `sharedCents` separado de consumo, valores manuais e pagamentos; consumo usa arredondamento inteiro seguro.
- Painéis de unidades, leituras, despesas, rateio, quotas, pagamentos, CSV e fechamento permanecem como superfície administrativa.
- Competências fechadas continuam protegidas contra alteração de conteúdo; reabertura é ação explícita e isolada.

### Validação

- O resultado histórico anterior permanece em [docs/validacao.md](docs/validacao.md), incluindo os 12 arquivos e 60 testes observados naquela execução.
- A validação final do novo contrato — rotas, DTO, sessão, migração, estado vazio, maior competência, isolamento e preservação do estado — ainda deve ser registrada com saídas reais. Não inventar contagem, hash, expiração ou publicação.

### Fora do escopo atual

Não há OAuth para login do aplicativo, signup, autenticação de moradores, portal, convites, boleto/Pix integrado, baixa bancária, WhatsApp, tarifas progressivas, mínimo Copasa ou PDF automático com anexos. Essas funções exigem escopo próprio.

O repositório ativo continua gerenciado pelo Manus, sem URL GitHub confirmada.
