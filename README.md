# Condomínio San Gimignano

App web para a gestão financeira de um condomínio pequeno (10 apartamentos). O síndico lança as despesas e as leituras, o app calcula quanto cada apartamento paga e confere o saldo com o extrato do banco.

## Como funciona

**Quadro (`/`)**: página aberta, sem login. Mostra o mês mais recente (ou outro escolhido): quanto cada apartamento paga, as despesas e o caixa do condomínio. Não mostra nomes de moradores nem quem está devendo.

**Área do síndico (`/sindico`)**: usuário `admin` e a senha definida em `CONDO_ADMIN_PASSWORD`.

O mês do síndico:

1. **Novo mês**: as leituras anteriores e o fundo de reserva vêm do mês passado.
2. **Despesas**: lança cada conta (Copasa, gás, faxina, manutenção...).
3. **Leituras**: digita a leitura atual de água e gás de cada apartamento.
4. **Pagamentos**: registra quanto cada apartamento pagou (o que entrou no banco).
5. **Painel**: digita o saldo do extrato e vê se bateu. Fecha o mês.

## Regras de cálculo

| Item                       | Como divide                                             |
| -------------------------- | ------------------------------------------------------- |
| Despesas da categoria Água | Pelo consumo de cada hidrômetro (m³ do apto ÷ m³ total) |
| Despesas da categoria Gás  | Pelo consumo de cada medidor de gás                     |
| Demais despesas            | Igual entre os apartamentos do mês                      |
| Fundo de reserva           | Valor fixo por apartamento, definido no mês             |

Se ninguém consumiu no mês, a conta é dividida igualmente. A soma das cotas é sempre igual ao total das despesas (mais o fundo): os centavos que sobram da divisão vão para quem tem o maior resto, em ordem de apartamento.

**Saldo de cada apartamento:** a pagar no mês = saldo anterior + cota do mês. O que não for pago passa para o mês seguinte; pagamento a mais vira crédito. Pagamento atrasado é lançado no mês em que entrou no banco, sem reabrir o mês antigo.

**Caixa:** saldo do mês = saldo anterior + recebido − despesas. O primeiro saldo anterior é o "Saldo no banco antes do 1º mês" (aba Cadastro); depois, o fechamento de um mês é a abertura do seguinte. Ao informar o extrato, o painel mostra a diferença.

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
