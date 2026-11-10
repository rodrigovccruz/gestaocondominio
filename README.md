# Condomínio San Gimignano

App web para a gestão financeira de um condomínio pequeno (10 apartamentos). O síndico lança as despesas e as leituras, o app calcula quanto cada apartamento paga e confere o saldo com o extrato do banco.

## Como funciona

**Quadro (`/`)**: página aberta, sem login. Mostra o mês mais recente (ou outro escolhido): quanto cada apartamento paga, as despesas e o caixa do condomínio. Não mostra nomes de moradores nem quem está devendo.

**Área do síndico (`/sindico`)**: usuário `admin` e a senha definida em `CONDO_ADMIN_PASSWORD`.

O mês do síndico:

0. **Cadastro** (uma vez, e quando mudar): apartamentos, isentos e as **tarifas vigentes**: salário mínimo, taxa de condomínio em % do mínimo, fundo de manutenção e de reserva em % da taxa, taxa de administração e preços do m³ de água e gás.
1. **Novo mês**: as leituras anteriores vêm do mês passado; taxa, percentuais e preços vêm das tarifas vigentes. O mês guarda a cópia, então mudar o salário mínimo não altera meses já criados.
2. **Leituras**: digita a leitura atual de água e gás de cada apartamento.
3. **Cobrança**: confere a taxa, os percentuais e os preços do m³ (a água pode ser calculada pela conta da Copasa dos aptos) e lança cobranças avulsas (multa, reembolso).
4. **Despesas**: lança cada conta paga (marcando as que saem do fundo de reserva).
5. **Pagamentos**: registra quanto cada apartamento pagou (o que entrou no banco).
6. **Painel**: digita o saldo do extrato e vê se bateu. Fecha o mês.

## Regras de cálculo

São as mesmas da planilha do condomínio (conferido com outubro/2026 em `shared/planilha-outubro.test.ts`).

| Item                  | Quanto cada apartamento paga                 |
| --------------------- | -------------------------------------------- |
| Água                  | Consumo do hidrômetro × preço do m³ do mês   |
| Gás                   | Consumo do medidor × preço do m³ do mês      |
| Taxa de condomínio    | Valor fixo por apartamento                   |
| Fundo de manutenção   | % da taxa de condomínio                      |
| Fundo de reserva      | % da taxa de condomínio (vai para o fundo)   |
| Taxa de administração | Valor fixo por apartamento                   |
| Cobrança avulsa       | Só no apartamento lançado (multa, reembolso) |

**Isento** (ex.: síndico, marcado no Cadastro): não paga taxa de condomínio, manutenção nem administração; paga consumo, fundo de reserva e avulsos.

As partes são somadas sem arredondar e só o total de cada apartamento é arredondado para centavos, como na planilha. As despesas não entram na cota: saem do caixa.

**Saldo de cada apartamento:** a pagar no mês = saldo anterior + cota do mês. O que não for pago passa para o mês seguinte; pagamento a mais vira crédito. Pagamento atrasado é lançado no mês em que entrou no banco, sem reabrir o mês antigo.

**Caixa:** saldo do mês = saldo anterior + recebido − despesas. O primeiro saldo anterior é o "Saldo no banco" com a sua data (aba Cadastro); depois, o fechamento de um mês é a abertura do seguinte. Ao informar o extrato, o painel mostra a diferença.

**Despesa paga ou a pagar:** cada despesa tem uma situação. A despesa só sai do dinheiro quando está **paga**, no dia em que saiu do banco (sem data, vale o último dia do mês da despesa). A **a pagar** não sai do dinheiro, mas entra na previsão do fim do mês.

**Data do saldo inicial:** o saldo inicial vale para um dia (o saldo do dia no extrato). Despesa paga até esse dia já está dentro do saldo e não é descontada de novo. Assim o app começa a contar no meio da história do condomínio sem precisar refazer os meses antigos.

**Dinheiro agora e previsão:** dinheiro agora = saldo inicial + recebido − despesas pagas. Previsão do fim do mês = dinheiro agora + a receber dos apartamentos − despesas a pagar.

**Fundo de reserva:** saldo anterior + fundo de reserva cobrado no mês − despesas pagas pelo fundo. O caixa do condomínio é o saldo do banco menos o fundo, e pode ficar negativo.

**Mês fechado** não aceita alteração. Para corrigir, reabra, corrija e feche de novo.

## Rodar

Requisitos: Node.js 22, pnpm 10.18 e Postgres.

```bash
pnpm install --frozen-lockfile
pnpm db:migrate   # migrações versionadas
pnpm dev          # http://localhost:3000
pnpm test         # testes (não tocam o banco)
pnpm check        # TypeScript
pnpm build && pnpm start
```

Variáveis (fora do Git): `DATABASE_URL` e `CONDO_ADMIN_PASSWORD`. Sem a senha configurada, o login fica desativado.

O login só funciona se já existir o registro do condomínio na tabela `condo_states`. Num banco novo, defina `CONDO_UNITS` (ex.: `101,102,201,202,301,302,401,402,501,502`) e, opcional, `CONDO_NAME`: na Vercel, a primeira requisição aplica as migrações e cria o condomínio com esses apartamentos. Banco que já tem condomínio não é alterado.

## Publicar na Vercel

O banco é um Postgres criado dentro da própria Vercel (Neon).

1. No projeto da Vercel, aba **Storage**, crie um banco **Neon** e conecte ao projeto. A Vercel preenche `DATABASE_URL` sozinha.
2. Em Settings > Environment Variables, cadastre `CONDO_ADMIN_PASSWORD` e `CONDO_UNITS`.
3. Faça o deploy (ou Redeploy) e abra o endereço. O quadro aparece vazio; entre em `/sindico` com `admin` e a senha.

### Ambiente de teste

1. Produção (`main`) usa o banco `condo-db`; Preview e Development usam o `condo-db-teste`.
2. A branch `teste` publica em `gestaocondominio-git-teste-rvcc.vercel.app`, que só abre para quem está logado na Vercel.
3. Para zerar o teste, apague as linhas de `condo_states` no `condo-db-teste` (ou o banco inteiro). O próximo acesso recria o condomínio com `CONDO_UNITS`.

O build (`pnpm build:vercel`, definido no `vercel.json`) gera `.vercel/output`: o site em `static/` e a API numa função Node em `functions/api.func`.

## Código

| Arquivo                                | O que faz                                       |
| -------------------------------------- | ----------------------------------------------- |
| `shared/condo.ts`                      | Modelo de dados e validação (Zod)               |
| `shared/calc.ts`                       | Todo o cálculo: cotas, saldos, caixa            |
| `shared/upgrade.ts`                    | Converte o formato antigo salvo no banco        |
| `server/condo.ts`                      | Ler e salvar o estado (com controle de revisão) |
| `server/publicDashboard.ts`            | O que o quadro público pode mostrar             |
| `server/syndic-auth.ts`                | Login, sessão e limite de tentativas do síndico |
| `server/bootstrap.ts`                  | Migrações e criação do condomínio em banco novo |
| `server/vercel.ts`                     | Função da Vercel (API)                          |
| `client/src/pages/PublicDashboard.tsx` | Quadro                                          |
| `client/src/pages/Home.tsx`            | Área do síndico                                 |

O estado inteiro do condomínio é um JSON numa linha de `condo_states`. Dinheiro em centavos inteiros, leituras em milésimos de m³.

As tabelas `users`, `condo_memberships` e `condo_invites` são de versões antigas e ficam no banco só como histórico.
