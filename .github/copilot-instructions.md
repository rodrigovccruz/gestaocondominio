# Instruções para assistentes de código

App de gestão de condomínio pequeno. Interface e textos em português do Brasil. Leia o README antes de mudar regra.

1. Todo cálculo fica em `shared/calc.ts` e precisa de teste em `shared/calc.test.ts`.
2. Dinheiro em centavos inteiros; leituras em milésimos de m³. A soma das partes de uma divisão é sempre igual ao total.
3. O estado é um JSON único (`condo_states`). Mudou o formato? Atualize `shared/upgrade.ts` para ler o formato anterior.
4. Mês fechado não muda; o servidor valida isso em `server/condo.ts`.
5. O quadro público só mostra o que `server/publicDashboard.ts` monta. Nunca exponha moradores ou dívida por apartamento.
6. Não mexa no login (`server/syndic-auth.ts`) sem pedido explícito.
7. Testes usam mocks; o banco de desenvolvimento é o mesmo de produção.
8. Mantenha simples: 10 apartamentos, um síndico.
