# Desenvolvimento e deploy

## Pré-requisitos

- Node.js 22;
- pnpm 10.18.0;
- MySQL acessível pelo ambiente;
- um gerenciador de segredos capaz de fornecer `CONDO_ADMIN_PASSWORD` em runtime.

O rateio não precisa de API externa. A autenticação do aplicativo também não depende de OAuth Manus: o login próprio usa o usuário fixo `admin` e o segredo de ambiente configurado pelo responsável.

## Variáveis de ambiente

Copie `.env.example` somente para o ambiente local e preencha valores fora do Git. O arquivo versionado contém apenas placeholders seguros. Nunca comite `.env`, senha real, tokens, hashes, URL de banco ou dumps financeiros.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão MySQL do ambiente |
| `CONDO_ADMIN_PASSWORD` | senha do síndico; obrigatória para login, fornecida somente por secret manager/runtime e nunca incluída no repositório |

`CONDO_ADMIN_PASSWORD` não possui valor padrão. Um placeholder vazio significa “não configurado”, não senha vazia válida. Se ausente em deployment, o login deve falhar fechado. A senha recebida por canal seguro deve ser configurada diretamente no escopo de segredos do ambiente; não é necessário nem permitido repeti-la em documentação, código, ticket ou chat.

Variáveis internas da plataforma podem existir fora deste contrato, mas cookie Manus, `MANUS_JWT_SECRET`, `MANUS_OAUTH_API_URL` ou portal OAuth não autorizam `condo.get`, `condo.save` nem substituem a sessão própria. Não reintroduzir configuração OAuth no `.env.example` para este fluxo.

## Instalação e desenvolvimento

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

O servidor usa `PORT` quando fornecida e o padrão é `3000`. Para verificar a aplicação em execução:

```sh
curl -fsS http://localhost:3000/api/health
```

A resposta esperada contém `{"status":"ok"}`. Isso comprova apenas saúde HTTP básica, não comprova rateio, login, autorização ou integração bancária.

## Qualidade antes de uma mudança

```sh
pnpm check
pnpm test
pnpm build
pnpm start
```

- `pnpm check`: verificação TypeScript sem emitir arquivos.
- `pnpm test`: testes Vitest.
- `pnpm build`: build Vite e bundle do servidor.
- `pnpm start`: inicia a versão compilada.

Execute `pnpm check` e os testes relevantes antes e depois de alterar regra financeira, autorização ou persistência. Não declarar quantidade de testes, cobertura ou integração como evidência sem guardar a saída real do comando.

## Migrações e dados compartilhados

`pnpm db:migrate` aplica migrações revisadas. A sessão própria e o limitador de tentativas devem entrar por migração aditiva, versionada e revisada antes de tocar o MySQL compartilhado. Não apagar tabelas/colunas legadas, recriar banco, rodar seed ou reescrever histórico para validar uma feature.

`pnpm db:push` existe no projeto para gerar/aplicar migração durante desenvolvimento de schema, mas não substitui revisão de migração para publicação. Em ambiente compartilhado, prefira a migração SQL gerada, revisada e aplicada uma vez com `pnpm db:migrate`.

A migração deve preservar o estado existente, as dez unidades de referência quando presentes e cobranças/pagamentos históricos. Registros legados de membros e convites podem permanecer, mas não devem ser usados para conceder login. Não criar moradores, convites, despesas ou pagamentos reais como dados de teste.

## Testes financeiros e de segurança

Use fixtures fictícias, dados em memória, mocks e banco isolado. Cubra pelo menos:

- água/gás, leitura regressiva e arredondamento por unidade;
- `sharedCents` separado de consumos, manuais e pagamentos;
- despesa sem `rateable` fora do rateio;
- método igual, fração positiva, soma/tolerância e pesos snapshot;
- maiores restos, desempate por `unitId` e soma exata de centavos;
- não duplicação acidental de água/gás;
- competência aberta versus fechada e reabertura isolada;
- concorrência por revisão;
- `auth.login` com `admin`/senha correta e credenciais erradas genéricas;
- segredo ausente com falha fechada, comparação `scrypt`/tempo constante e limite de cinco falhas em quinze minutos por IP e global;
- token de sessão aleatório de 256 bits, somente hash no banco, expiração de oito horas e revogação no logout;
- `auth.me` anônimo/autenticado e `auth.logout` seguido de negação;
- DTO público sem `ownerId`, `revision`, unidades, contatos, leituras, cobranças, pagamentos, multas individuais, convites ou tokens;
- competência pública maior por `YYYY-MM`, incluindo aberta, e estado vazio honesto;
- `condo.get/save` negados sem sessão própria e aceitos somente para o condomínio configurado;
- registros legados de memberships/invites sem efeito de autorização.

Não execute teste destrutivo no mesmo banco usado por Preview e produção. Se um teste precisar escrever, use banco isolado descartável, mock ou transação controlada fora do banco compartilhado.

## Publicação e verificação

Antes de publicar:

1. revisar diff e migrações;
2. executar `pnpm check`, testes relevantes e `pnpm build`;
3. aplicar migração aditiva revisada uma vez;
4. iniciar a versão compilada;
5. verificar `/api/health`;
6. validar o quadro público, login próprio, logout, sessão expirada e autorização de `condo.get/save` com dados não reais;
7. confirmar que não estão montadas rotas de OAuth, convite ou portal de moradores;
8. confirmar competência fechada, dados de outros condomínios e tokens continuam protegidos;
9. confirmar estado financeiro e hash sem alteração indevida;
10. registrar comandos e resultados, sem incluir segredos ou PII.

A conexão/criação do repositório GitHub permanece pendente de confirmação oficial. Não colocar URL futura nem afirmar transferência concluída. Publicar código ou salvar um Preview também não é autorização para o quadro privado.
