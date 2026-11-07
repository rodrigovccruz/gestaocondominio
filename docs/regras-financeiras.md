# Regras financeiras

## Unidades e identificação histórica

O conjunto de referência possui dez unidades: 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502. Unidades com histórico devem ser desativadas, não apagadas. Cobranças guardam `unitId` e podem guardar `unitSnapshot` com número e morador para que uma mudança cadastral futura não reescreva o relatório histórico.

A fração ideal é informação cadastral até que o método por fração seja explicitamente configurado. Fração zero não é uma participação válida no método por fração. Não atribuir percentuais presumidos só porque a fração não foi preenchida.

## Unidades monetárias e leituras

- Valores monetários e tarifas são inteiros em centavos (`R$ 1,00 = 100`).
- Leituras são inteiros em milésimos de m³ (`1 m³ = 1000`).
- `consumo = leituraAtual - leituraAnterior`.
- A leitura atual menor que a anterior é inválida.
- `valorCents = (consumoMilli × tarifaCents + 500) / 1000`, com divisão inteira segura por unidade.
- Água e gás individuais entram separadamente na cobrança.
- `condoCents`, `reserveCents`, `fineCents`, `otherCents` e `paidCents` permanecem lançamentos separados.

O cálculo central usa BigInt para a multiplicação e o arredondamento inteiro; não converte a operação financeira para ponto flutuante em reais. A parcela de rateio usa centavos inteiros.

## Composição e saldos

Para uma cobrança:

```text
totalCents = waterCents + gasCents + sharedCents
           + condoCents + reserveCents + fineCents + otherCents
outstandingCents = totalCents - paidCents
```

No mês:

```text
saldoCaixaCents      = saldoInicialCents + pagamentosRecebidosCents - despesasCents
saldoProjetadoCents  = saldoInicialCents + cobrancasCents - despesasCents
```

Saldo projetado não é caixa disponível. Pagamento acima da cobrança é crédito, não inadimplência negativa. Fundo de reserva é componente da cobrança; o sistema não o trata automaticamente como conta bancária separada nem reconcilia um saldo de reserva.

Ao criar nova competência, a cópia opcional pode levar condomínio e fundo de reserva. Não repetir automaticamente pagamentos, multas e outros adicionais.

## Rateio opcional por competência

A configuração `allocation` é opcional. Se não existir, não há alocação. A competência sem configuração conserva o comportamento anterior. A despesa participa apenas quando `rateable === true`; `false` e ausência da marcação significam fora do rateio. Isso preserva despesas históricas não marcadas.

### Método igual

No método `equal`, cada participante recebe peso 1, independentemente da fração cadastral. O padrão da tela seleciona todas as unidades ativas, mas o síndico pode marcar ou desmarcar participantes antes de confirmar. Com as dez unidades selecionadas, a divisão é de aproximadamente 10% para cada uma; centavos residuais seguem o desempate estável, sem criar uma nova fração cadastral.

### Método por fração ideal

O cadastro das unidades ativas deve ter frações positivas somando 100%, com tolerância de 0,01 ponto percentual. A fração decimal é convertida para peso inteiro por `Math.round(fraction × 1000)`. Quando apenas parte das unidades é selecionada, a divisão é proporcional às frações desse conjunto: os pesos são normalizados para uma soma de 100.000 usando maiores restos. Isso não muda a fração ideal cadastral nem atribui percentuais legais presumidos. Frações ausentes ou zero bloqueiam o método.

O contrato Zod rejeita soma inválida. Ao receber uma configuração nova ou alterada, `condo.save` deriva os pesos a partir das unidades ativas e das frações atuais e rejeita pesos arbitrários, mesmo em chamada direta à API. Configurações idênticas ao snapshot já salvo não são recalculadas a partir do cadastro posterior.

Depois de criada a competência, os participantes e os pesos são snapshot. Alterar a fração no cadastro não muda o mês histórico. Uma nova configuração ou atualização de snapshot precisa ser ação manual, validada e limitada a competência aberta.

### Maiores restos e conservação de centavos

Para uma despesa de `A` centavos e pesos `wᵢ`:

```text
pesoTotal = soma(wᵢ)
parteBaseᵢ = floor(A × wᵢ / pesoTotal)
restoᵢ     = (A × wᵢ) mod pesoTotal
centavosRestantes = A - soma(parteBaseᵢ)
```

Os centavos restantes são entregues, um a um, aos maiores restos. Empates são ordenados de modo estável pelo `unitId`. Portanto:

```text
soma(parcelas da despesa) === despesa.amountCents
```

A função rejeita valor negativo, peso não inteiro/não positivo, participante duplicado e cálculo fora do limite seguro. O resultado por unidade é acumulado em `sharedCents`, sem sobrescrever campos manuais.

### Exemplo fictício de dez unidades

Para uma despesa fictícia de **R$ 100,01** (`10.001` centavos) entre dez unidades, com pesos iguais, cada base é `1.000` centavos e sobra um centavo. Se os IDs do exemplo forem iguais aos números 101 a 502, o menor `unitId` será 101: essa unidade receberá R$ 10,01 e as outras nove R$ 10,00. No cadastro real, o ID é independente do número; a unidade com o centavo extra será aquela com o menor identificador no desempate. A soma permanece R$ 100,01. O exemplo não é lançamento real.

## Água/gás e duplicidade

Uma despesa geral de água ou gás pode representar uma conta comum. Entretanto, água/gás já lançados por consumo individual também compõem a cobrança. Para evitar cobrança dupla, a despesa com essa natureza deve ficar fora do rateio por padrão. Incluí-la exige escolha explícita, justificativa e conferência da prévia. O sistema não deve inferir que toda despesa da categoria é rateável.

No formulário, toda despesa nova começa fora do rateio. Editar uma despesa legada sem marcação também a mantém fora. Trocar a categoria para Água/Gás desativa a marcação; o síndico pode marcá-la novamente somente por decisão explícita. O quadro público não calcula nem expõe parcela individual; os snapshots completos de pesos permanecem restritos aos painéis autenticados do síndico e ao histórico financeiro.

## Abertura, confirmação e fechamento

Fluxo permitido para competência aberta:

1. configurar competência, tarifas e saldo inicial;
2. conferir leituras e cobranças manuais;
3. cadastrar despesas;
4. escolher método e participantes;
5. marcar explicitamente despesas rateáveis;
6. conferir a prévia por despesa e unidade, soma e riscos de duplicidade;
7. confirmar o rateio por `condo.save` no servidor;
8. conferir cobrança, extrato, relatório e CSV;
9. fechar a competência somente depois da conferência.

Uma nova despesa marcada como rateável entra automaticamente no cálculo de uma competência aberta que já tenha configuração. Competência fechada é imutável no conteúdo financeiro. Reabrir é ação explícita e isolada do conteúdo; não alterar status e valores financeiros em uma única operação silenciosa.

## O que não deve ser inferido

A fotografia de referência não confirma números financeiros. Não existem, por este contrato, percentuais legais automáticos, mínimo Copasa, tarifa progressiva, apropriação automática de saldo anterior por unidade, boleto/Pix ou conciliação bancária. Esses valores devem ser conferidos e lançados manualmente até implementação aprovada e testada.
