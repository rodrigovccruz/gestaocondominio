# Contribuindo

Obrigado por contribuir com o Condomínio San Gimignano. O produto lida com dados financeiros e pessoais; uma mudança pequena de cálculo ou autorização pode alterar cobranças. Prefira mudanças verificáveis e pequenas.

## Antes de começar

1. Leia [`README.md`](README.md) e o índice em [`docs/index.md`](docs/index.md).
2. Confirme se a mudança está no escopo e se não altera dados reais.
3. Para regra financeira, leia [`docs/regras-financeiras.md`](docs/regras-financeiras.md).
4. Para login do síndico, sessão ou consulta pública, leia [`docs/acesso-e-seguranca.md`](docs/acesso-e-seguranca.md) e [`SECURITY.md`](SECURITY.md).

## Regras de implementação

- Use português do Brasil na interface e na documentação de negócio.
- Preserve a autenticação própria do síndico e o quadro público mínimo. Não restabeleça login OAuth, convites ou portal de moradores sem nova autorização; não crie conta falsa, papel pelo primeiro login ou bypass no Preview.
- Nunca confie em `ownerId`, papel, e-mail ou `unitId` enviados pelo navegador sem derivar e validar no servidor.
- Mantenha moeda/tarifa em centavos inteiros e leituras em milésimos de m³.
- Preserve `sharedCents` separado de consumos, valores manuais e pagamentos.
- Para rateio, mantenha pesos positivos, snapshots, maiores restos, desempate estável por `unitId` e soma exata por despesa.
- Não inclua despesa legada no rateio sem `rateable === true`.
- Não altere conteúdo financeiro de competência fechada; reabertura deve ser explícita.
- Preserve snapshots históricos, cobranças e pagamentos. Unidades com histórico devem ser desativadas, não excluídas.
- Faça migrações somente aditivas, versionadas e revisadas.
- Não versionar `.env`, tokens, JWTs, dados pessoais ou documentos financeiros reais.

## Testes

Use fixtures fictícias, memória e mocks. Não execute seeds, truncates ou testes destrutivos no banco compartilhado de desenvolvimento/Preview/produção. Cubra cálculo, arredondamento, duplicidade água/gás, fechamento, concorrência, escopo privado, expiração/revogação de sessão, limite de tentativas, cache e campos do DTO público.

Antes de abrir uma contribuição:

```sh
pnpm check
pnpm test
pnpm build
```

Se a mudança afetar execução compilada, verifique também `pnpm start` e `GET /api/health`. Descreva no pull request os comandos executados e resultados observados. Não invente contagem de testes ou cobertura.

## Mudanças de schema

Inclua migração aditiva revisada quando necessário. Explique compatibilidade com dados existentes, estratégia de rollback operacional e como a migração evita apagar o estado JSON atual. Não rode `pnpm db:push` contra o banco compartilhado sem revisar o SQL produzido.

## Pull requests

Descreva:

- problema e comportamento esperado;
- arquivos e contratos afetados;
- distinção entre implementação pronta e desenho pendente;
- impacto financeiro/privacidade;
- migração necessária;
- testes e comandos executados;
- limitações conhecidas.

Para o acesso, inclua casos positivos e negativos: credencial incorreta, segredo ausente, token expirado/revogado, JWT Manus sem autorização, tentativas paralelas e leitura/edição sem sessão. Para a consulta pública, verifique a última competência e a ausência de dados privados. Para o rateio, inclua exemplo fictício e prova de conservação dos centavos.

## Git e licença

Preserve o histórico existente. Não use `git push --force`, não reescreva commits compartilhados e não remova migrações aplicadas. Use commits pequenos e descritivos. O projeto mantém a licença MIT já existente; não substitua ou relicencie sem decisão explícita.
