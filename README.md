# Condomínio San Gimignano

**Gestao Condominio · gestaocondominio**

Sistema web de gestão financeira para o condomínio residencial San Gimignano. A raiz do aplicativo é um quadro público, sem landing page e sem login: ele consolida as despesas comuns da competência mensal mais recente cadastrada. A única área privada é a área do síndico, acessível em `/sindico`.

Os dez apartamentos de referência são **101, 102, 201, 202, 301, 302, 401, 402, 501 e 502**. A documentação não trata a fotografia de referência como fonte de valores financeiros, percentuais ou moradores. Registros legados de membros e convites podem permanecer no banco por histórico, mas não concedem acesso ao aplicativo.

## Funcionalidades

| Área | Comportamento |
| --- | --- |
| Quadro público | Exibe nome, quantidade de apartamentos e a competência cadastrada mais recente, aberta ou fechada, com despesas comuns consolidadas e categorias permitidas. Não depende de cookie de administrador. |
| Área do síndico | Cadastro de unidades, tarifas, leituras, cobranças, despesas, rateio, pagamentos manuais, CSV, fechamento e demais painéis financeiros existentes. |
| Login do síndico | Link discreto **Área do síndico** no quadro público; `/sindico` aceita somente o usuário `admin` e a senha configurada em `CONDO_ADMIN_PASSWORD`. |
| Água e gás | Consumo = leitura atual − anterior; valor calculado por tarifa de m³, com arredondamento inteiro em centavos. |
| Rateio | Divide despesas explicitamente marcadas entre unidades selecionadas, por partes iguais ou proporcionalmente à fração ideal. Prévia e confirmação por competência. |
| Exatidão | Distribuição por maiores restos; todos os centavos de cada despesa são preservados. |
| Cobranças | Água + gás + despesas rateadas + cota manual + reserva + multa + outros. Pagamentos são mantidos separadamente. |
| Histórico | Participantes, pesos e identificação da cobrança ficam registrados no mês. Competência fechada não aceita alterações financeiras sem reabertura explícita. |

Não há login OAuth, signup, convites, portal de moradores ou autenticação de moradores. O cookie da plataforma Manus, quando existir, não substitui a sessão opaca própria do síndico e nunca concede edição privada.

**Proteção contra duplicidade:** o rateio é adicional à cota manual e ao consumo individual. Uma despesa não entra sem marcação explícita. Ao escolher Água/Gás no formulário, a marcação é desativada para exigir nova decisão do síndico. Não rateie novamente um valor já cobrado por consumo individual.

Uma competência sem configuração de rateio mantém o cálculo anterior. Despesas antigas sem marcação ficam fora. A divisão igual funciona sem preencher frações cadastrais; as frações existentes em zero devem ser informadas pelo responsável somente antes de usar o método por fração ideal.

## Executar e desenvolver

Requisitos: **Node.js 22**, **pnpm 10.18.0** e **MySQL**. Para uso autorizado, configure `CONDO_ADMIN_PASSWORD` fora do Git, no gerenciador de segredos do ambiente de execução. O `.env.example` contém somente um placeholder vazio; ele nunca é uma senha padrão.

```bash
pnpm install --frozen-lockfile
pnpm db:migrate  # aplica somente migrações versionadas e revisadas
pnpm dev        # desenvolvimento; porta padrão 3000
```

```bash
pnpm check      # TypeScript
pnpm test       # testes sem gravação de dados reais
pnpm build      # frontend e servidor de produção
pnpm start      # execução do build
```

A saúde está em `GET /api/health`. **Desenvolvimento e produção usam o mesmo banco gerenciado**; testes destrutivos, limpeza de dados e seeds contra ele são proibidos. Não colocar segredos, sessões, tokens ou dados pessoais/financeiros reais nos commits.

## Documentação

O [índice completo](docs/index.md) organiza os [requisitos](docs/requisitos.md), a [arquitetura](docs/arquitetura.md), as [regras financeiras](docs/regras-financeiras.md), [acesso e segurança](docs/acesso-e-seguranca.md), o [guia de uso](docs/guia-de-uso.md), [desenvolvimento e implantação](docs/desenvolvimento-e-deploy.md) e as [limitações](docs/limitacoes.md).

Veja também [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md), [CHANGELOG](CHANGELOG.md), [instruções para o Copilot](.github/copilot-instructions.md) e o registro de [verificação da entrega](docs/validacao.md).

## Arquitetura

React/TypeScript + Tailwind no frontend; Express + tRPC no servidor; Zod para contratos; Drizzle/MySQL para persistência e migrações. `shared/condo.ts` compõe cobranças e totais, `shared/rateio.ts` distribui centavos, `server/condo.ts` valida e persiste o estado com revisão otimista, `server/syndic-auth.ts` controla o login/sessão própria e `server/publicDashboard.ts` projeta o DTO público.

A área pública é deliberadamente anônima e mínima. A área privada exige uma sessão opaca de 256 bits do síndico, com somente o hash persistido no MySQL e expiração de oito horas. `condo.get` e `condo.save` devem usar essa sessão própria e o condomínio configurado no servidor; não devem autorizar com cookie Manus, `ownerId` enviado pelo navegador ou dados legados de membros/convites.

## Status e limites

A mudança de escopo substitui os fluxos anteriores de OAuth, convites e portal de moradores. Os módulos e contratos novos estão documentados, mas a validação final de check, testes, build, rotas montadas, migração aditiva, hash do estado e ausência de vazamento deve ser registrada em [docs/validacao.md](docs/validacao.md) somente após a execução real. Não inventar contagem de testes, expiração verificada ou publicação.

Não há boleto/Pix integrado, baixa bancária, WhatsApp, tarifas progressivas, mínimo Copasa ou PDF automático com anexos. Essas funções exigem escopo próprio.

O código está publicado no repositório GitHub [rodrigovccruz/gestaocondominio](https://github.com/rodrigovccruz/gestaocondominio), configurado como público. A publicação sincroniza somente o código, os testes e a documentação; não faz deploy do site nem configura uma sessão do GitHub Copilot. O projeto mantém a licença MIT declarada em `package.json`.
