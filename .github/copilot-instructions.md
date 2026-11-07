# Condomínio San Gimignano — instruções para assistentes de código

Use português do Brasil na interface, nos nomes de negócio e na documentação. Este repositório é um sistema financeiro condominial; diferencie sempre **fonte implementada**, **validação operacional** e **pendência**. Não descreva como validado ponta a ponta o que ainda não tem check, testes, build e fluxo autenticado registrados.

## Escopo de acesso obrigatório

- A raiz é um quadro público, sem landing page e sem login.
- O rodapé pode oferecer o link discreto **Área do síndico** para `/sindico`.
- A única área privada é do síndico, com usuário literal `admin` e senha runtime `CONDO_ADMIN_PASSWORD`.
- Não criar login OAuth, signup, autenticação de moradores, portal, convites ou rotas montadas de membros.
- Dados legados de `condo_memberships` e `condo_invites` são preservados historicamente, mas nunca concedem acesso.
- Cookie Manus, `ownerId` vindo do browser, `user.role` de plataforma ou localStorage não autorizam edição.

## Arquitetura observada

- `client/`: React/TypeScript e interface responsiva para quadro público e área do síndico.
- `client/src/components/condo/rateio-panel.tsx`: prévia e configuração/atualização do rateio.
- `server/_core/`: Express, tRPC e contexto de sessão própria; Manus OAuth não é autorização do condomínio.
- `server/routers.ts`: deve expor somente o contrato atual `auth`, `publicDashboard`, `condo` e saúde/infra permitidos; não montar portal/convite.
- `server/syndic-auth.ts`: login `admin`, `scrypt`, comparação em tempo constante, sessão opaca, expiração e rate limit.
- `server/publicDashboard.ts`: projeção mínima da competência mais recente para o quadro público.
- `server/condo.ts`: `condo.get`, `condo.save`, persistência e revisão otimista.
- `server/condo-config.ts`: resolve um único condomínio configurado sem escolher a primeira linha em caso ambíguo.
- `shared/condo.ts`: schemas, tipos, snapshots e cálculo de cobrança/mês.
- `shared/rateio.ts`: distribuição pura em centavos, configuração opcional e snapshots.
- `shared/syndic.ts`: `SYNDIC_USERNAME`, caminho `/sindico`, `SyndicIdentity` e tipos de sessão.
- `shared/public-dashboard.ts`: DTO e categorias permitidas do quadro público.
- `drizzle/`: MySQL/Drizzle e migrações versionadas, incluindo sessão/rate limit aditivos e tabelas legadas.
- `docs/`: requisitos, arquitetura, regras financeiras, acesso, guia, operação, validação e limitações.

A persistência de `condo_states` continua usando estado JSON e `revision`. A sessão nova deve usar tabela própria aditiva (`syndic_sessions`) com `ownerId`, hash do token e expiração; `syndic_login_rate_limits` mantém contadores por global/IP. Nunca persistir token cru ou senha.

## APIs

Contrato requerido:

- `auth.login` público: `{ username, password }` e sucesso somente para `admin` + `CONDO_ADMIN_PASSWORD`.
- `auth.me` público: `null | SyndicIdentity`; nunca devolver usuário Manus como autorização.
- `auth.logout` público: revogar sessão própria e retornar sucesso.
- `publicDashboard.get` público: `PublicDashboard` mínimo, igual com/sem cookie admin.
- `condo.get` protegido: exige sessão própria do síndico.
- `condo.save` protegido: exige sessão própria, estado configurado, `revision` e competência aberta.

O DTO público só pode incluir `name`, `apartmentCount` e `latest` com `competence`, `status`, `totalExpensesCents`, `expenses` (`id`, `description`, `category`, `date`, `amountCents`) e `categories` (`category`, `amountCents`). Não retornar `ownerId`, `revision`, unidades, nomes, contatos, leituras, consumos individuais, cobranças privadas, pagamentos, multas, invites, memberships, token, hash ou sessão.

A competência pública é a maior string `YYYY-MM` cadastrada, inclusive aberta. Sem meses, usar `latest: null`, sem fabricar mês/valores do estado inicial. Configuração ambígua deve falhar fechada.

## Regras financeiras

- Moeda e tarifas são inteiros em centavos; leituras são inteiros em milésimos de m³.
- Consumo é leitura atual menos anterior; leitura regressiva é inválida.
- Arredondar valor de consumo por unidade com aritmética inteira segura/BigInt (`(consumo × tarifa + 500) / 1000`).
- Composição: água + gás + `sharedCents` + condomínio + reserva + multa + outros.
- Saldo de caixa = saldo inicial + pagamentos - despesas.
- Saldo projetado = saldo inicial + cobranças - despesas; não apresentar como dinheiro disponível.
- Preservar pagamentos e valores manuais.
- Competência fechada é imutável no conteúdo; reabertura é explícita e isolada.
- Unidade com histórico é desativada, não apagada; preservar snapshots de número/morador.

## Rateio autorizado

- `allocation` é opcional por competência; sem configuração, não há rateio.
- Incluir somente despesas com `rateable === true`; legado sem marcação fica fora.
- `equal` usa peso 1 por participante.
- `fraction` exige pesos positivos e soma de 100% com tolerância de 0,01 ponto percentual; converter fração × 1000 em peso inteiro.
- Snapshot de participantes/pesos é histórico estável; mudanças cadastrais não reescrevem competência.
- Maiores restos em centavos, desempate estável por `unitId`; soma por despesa deve ser exata.
- Mostrar `sharedCents` separado de consumo individual, valores manuais e pagamentos.
- Água/gás individual já cobrados não devem ser rateados de novo sem escolha explícita.
- Não inventar frações para unidades com zero/ausência; não tratar arredondamento do método igual como nova regra legal.
- Não é necessária API externa para o cálculo.

## Segurança

A senha vem somente de `CONDO_ADMIN_PASSWORD`; ausência deve falhar fechado. Usar `scrypt` e comparação em tempo constante. Criar token de sessão opaco de 256 bits, guardar somente SHA-256 no MySQL, expirar em oito horas e revogar no logout. Aplicar limite padrão de cinco falhas em quinze minutos tanto por IP quanto global. Erros de credencial devem ser genéricos. Nunca logar senha, token cru, hash, cookie, segredo, `DATABASE_URL` ou PII.

A sessão Manus, se existir por compatibilidade de plataforma, nunca autoriza `condo.get/save`. Autorizar no servidor em cada leitura e mutação. Não confiar em `ownerId`, role, unidade ou e-mail enviados pelo navegador.

## Dados, migrações e limites

Preserve as unidades de referência 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502 quando existirem. Não importar números ilegíveis da fotografia, não criar seed financeiro e não criar moradores/pagamentos/convites reais para teste. Use somente migrações aditivas, revisadas; não reescrever histórico nem usar force push.

Não há mínimo Copasa, tarifa progressiva, saldo automático por unidade, boleto/Pix, conciliação bancária, WhatsApp, fluxo de convite ou PDF automático anexado. Não inserir URL futura de GitHub: a transferência não está confirmada.

## Qualidade

Requisitos: Node.js 22, pnpm 10.18.0 e MySQL. Comandos principais: `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm check`, `pnpm test`, `pnpm build`, `pnpm start`; saúde em `/api/health`. Testes devem cobrir finanças, conservação de centavos, duplicidade, fechamento, concorrência, login correto/incorreto, segredo ausente, rate limit, expiração/revogação, DTO sem vazamento, maior competência aberta, estado vazio, isolamento de `condo.get/save` e legado sem autorização. Não execute testes destrutivos no banco compartilhado Preview/produção. Não alegar contagem final de testes, cobertura, integração ou publicação sem resultado capturado.

Consulte `README.md` e `docs/` antes de modificar regras. Mantenha a licença MIT existente.
