# Changelog

## 2026-11-08 a 2026-11-15: Vercel, cálculo da planilha e produção

O app saiu do ambiente local, passou a calcular como a planilha do condomínio e foi para produção.

**Novo**

1. **Publicação na Vercel** (`vercel.json`, `pnpm build:vercel`): o site estático e a API numa função Node. Num banco novo, a primeira requisição aplica as migrações e cria o condomínio com os apartamentos de `CONDO_UNITS`.
2. **Ambientes separados:** produção (`main`, banco `condo-db`) e teste (branch `teste`, banco `condo-db-teste`, só com login da Vercel).
3. **Cobrança igual à planilha:** água e gás por consumo × preço do m³, taxa de condomínio fixa, fundo de manutenção e de reserva em % da taxa, taxa de administração, isento (síndico) e cobranças avulsas. Outubro/2026 da planilha é reproduzido nos 10 apartamentos (`shared/planilha-outubro.test.ts`).
4. **Tarifas vigentes no Cadastro:** salário mínimo, taxa em % do mínimo, fundos, administração e preços do m³. O mês novo copia as tarifas e guarda a cópia.
5. **Caixa:** conta corrente (dinheiro agora), a receber, a pagar e previsão do fim do mês, com a conta corrente dividida em fundo de reserva e condomínio.
6. **Despesa paga ou a pagar**, com a data do pagamento, e **data do saldo inicial**: despesa paga até esse dia já está no saldo e não é descontada de novo.
7. **Quadro dos moradores:** prédio desenhado com a cota de cada apartamento, linha do condomínio (água das áreas comuns) na composição da cota e situação de cada despesa (paga em tal data ou a pagar). Novo visual com as cores da fachada.
8. **Backup do banco** (`BACKUP_BANCO_*.md`): script SQL de restauração, testado em três cenários.

**Mudou**

1. O banco passou de MySQL para **Postgres (Neon, criado pela Vercel)**. O schema ficou com quatro tabelas (`users`, `condo_states`, `syndic_sessions`, `syndic_login_rate_limits`) e uma migração nova. As tabelas de convites e vínculos de moradores saíram.
2. A divisão da conta de água e gás pelo consumo foi substituída pelo cálculo da planilha. As despesas deixaram de entrar na cota: saem do caixa.
3. O saldo no banco passou a ter data, e a lista de despesas mostra a situação de cada uma.
4. Correção na lista de despesas: o botão "Paguei" aparecia nas despesas a pagar e parecia um rótulo. A situação agora é uma etiqueta, e a ação é um visto.
5. Correção nas tabelas: a classe `.grid` colidia com o utilitário do Tailwind e desalinhava as colunas (agora `.data-table`).

**Igual**

1. Login do síndico, sessão e limite de tentativas.
2. O quadro público não mostra moradores, extrato nem quem está devendo.

## 2026-11-07: simplificação

O modelo ficou do tamanho do problema: lançar despesas, ver quanto cada apartamento paga e bater com o banco.

**Mudou**

1. Água e gás: a conta do prédio é dividida pelo consumo de cada medidor (antes: tarifa por m³ digitada à mão, que não fechava com a conta).
2. Demais despesas: divididas igualmente, sem configuração de rateio, frações ou marcação "rateável".
3. Saldo do caixa encadeado entre meses e conferência com o saldo do extrato.
4. Saldo de cada apartamento encadeado: quem não paga carrega o débito; atraso é lançado no mês em que entrou.
5. Quadro público mostra quanto cada apartamento paga, as despesas e o caixa, e permite ver meses anteriores.
6. Área do síndico com 5 abas: Painel, Despesas, Leituras, Pagamentos, Cadastro.

**Saiu**

1. Cota manual, multa e "outros" por apartamento; tarifa por m³; rateio configurável e fração ideal.
2. Código legado de convites e portal de moradores.
3. Módulos do template sem uso (LLM, mapa, voz, imagem, vitrine de componentes e cerca de 50 componentes de UI).
4. Documentação em `docs/`, `plan.md` e `TODO.md`, substituídas pelo README.

**Igual**

1. Login do síndico, sessão e limite de tentativas.
2. Banco: nenhuma migração nova. O JSON antigo é convertido na leitura (`shared/upgrade.ts`).
