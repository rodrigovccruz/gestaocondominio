# Limitações conhecidas

Estas limitações são intencionais ou ainda pendentes. Não devem ser escondidas por uma tela que pareça completa.

## Financeiro e regras de negócio

- Não há regra automática confirmada de mínimo Copasa.
- Não há tarifa progressiva implementada.
- Não há aplicação automática de percentuais da fotografia de referência.
- Fração ideal sem configuração de rateio é apenas informativa.
- Frações zero não são uma distribuição legal ou válida; não inventar percentuais para completar o cadastro.
- Não há apropriação automática de saldo anterior por unidade.
- Não há reconciliação bancária.
- Não há emissão integrada de boleto ou Pix.
- Fundo de reserva não é conciliado automaticamente como conta bancária separada.
- O cálculo não substitui conferência contábil, tarifária ou jurídica do condomínio.

## Quadro público e área privada

- A raiz não tem landing page nem login; é um quadro público mínimo.
- A competência pública é a maior `YYYY-MM` cadastrada, inclusive se aberta; não é necessariamente o mês anterior nem o último fechado.
- Sem competência cadastrada, o DTO deve ser honesto (`latest: null`), sem apresentar valores mensais literais do estado inicial como dados reais.
- A área privada depende da sessão própria do síndico em `/sindico`; cookie Manus e visibilidade da plataforma são independentes.
- `CONDO_ADMIN_PASSWORD` precisa existir no runtime. Não há senha padrão, bypass localStorage ou fallback OAuth.
- A validação integrada final de login, expiração, revogação, rate limit, DTO e isolamento pode ainda estar pendente; consultar [Verificação da entrega](validacao.md).

## Fluxos removidos e legado

- OAuth Manus não é método de login do aplicativo.
- Não há signup, autenticação de moradores, portal de moradores ou rotas montadas para moradores.
- Não há criação, aceite ou revogação de convites como fluxo atual.
- `condo_memberships` e `condo_invites` podem ser preservados historicamente, mas não concedem acesso e não devem ser reativados pela UI.
- Não há envio integrado de convite por e-mail.
- Não há integração de WhatsApp.
- Não há tratamento automático de anexos de WhatsApp.
- Relatórios podem ter impressão/CSV conforme a interface atual, mas não há geração automática de PDF anexado como parte deste escopo.
- Não transformar fotografia ilegível em seed, valor financeiro ou percentual confirmado.

## Rateio e operação

- Rateio, painéis financeiros e cálculo de competências preservam as regras documentadas, mas a prévia não é autorização: o servidor deve recalcular/validar estado, sessão, proprietário e competência fechada.
- O rateio só afeta despesas explicitamente `rateable === true` e competência configurada.
- A lista de unidades 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502 é referência a preservar, não seed de dados reais.
- Não declarar contagem final de testes, cobertura, integração, migração ou publicação sem saída capturada.
- O MySQL de desenvolvimento e publicação pode ser compartilhado. Testes destrutivos, seeds e limpeza contra esse banco são proibidos.
- A saúde HTTP em `/api/health` não prova que uma regra financeira, login ou autorização esteja funcionando ponta a ponta.
- Migrações de rateio/sessão devem ser aplicadas de modo aditivo e revisado; não apagar estado JSON, cobranças, pagamentos, membros ou convites históricos.
- A conexão/criação do repositório privado GitHub permanece sem URL confirmada pelo provedor; não inserir endereço futuro.

## Próximas decisões necessárias

Antes do uso oficial, o responsável deve confirmar tarifas, unidades, frações, saldo inicial, tratamento de água/gás comum, política de fechamento, retenção de dados e configuração do segredo no ambiente de deployment. Qualquer regra legal, boleto/Pix, banco, WhatsApp, PDF ou importação de planilha deve ser especificada, revisada e testada em uma entrega separada.
