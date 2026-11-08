# Changelog

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
