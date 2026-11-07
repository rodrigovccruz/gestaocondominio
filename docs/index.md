# Documentação do Condomínio San Gimignano

A documentação descreve um quadro público de despesas comuns e uma área privada exclusiva do síndico. Não há landing page, login OAuth, convite, portal ou autenticação de moradores. Comece pelo [guia de uso](guia-de-uso.md) se for operar o condomínio; use a [arquitetura](arquitetura.md) e as [regras financeiras](regras-financeiras.md) para desenvolver ou revisar o código.

| Documento | Para quem | Conteúdo |
| --- | --- | --- |
| [Requisitos](requisitos.md) | Produto e desenvolvimento | Escopo, DTO público, autenticação do síndico e critérios de aceite. |
| [Arquitetura](arquitetura.md) | Desenvolvimento | Componentes, persistência, sessão própria e contratos de API. |
| [Regras financeiras](regras-financeiras.md) | Síndico e desenvolvimento | Leituras, centavos, rateio, snapshots e fechamento. |
| [Acesso e segurança](acesso-e-seguranca.md) | Desenvolvimento e operação | Permissões anônimas/síndico, sessão, segredo e limites de dados. |
| [Guia de uso](guia-de-uso.md) | Síndico e visitante público | Acesso público, entrada discreta em `/sindico` e fluxo financeiro. |
| [Desenvolvimento e deploy](desenvolvimento-e-deploy.md) | Desenvolvimento e operação | Ambiente, segredo, migrações, comandos e implantação. |
| [Limitações](limitacoes.md) | Todos | Recursos ausentes e pendências de verificação. |
| [Verificação da entrega](validacao.md) | Todos | Registro histórico e checklist da mudança atual sem contagens inventadas. |

## Contribuição

As orientações de [contribuição](../CONTRIBUTING.md), [segurança](../SECURITY.md), o [changelog](../CHANGELOG.md) e as [instruções do Copilot](../.github/copilot-instructions.md) fazem parte do repositório.

## Dados reais

Os apartamentos 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502 foram preservados quando já existiam. A fotografia é referência funcional, não fonte de valores financeiros ou percentuais confirmados. Não criar moradores, despesas, pagamentos ou convites reais como testes.

O quadro público deve mostrar a competência mensal mais recente cadastrada por ordem lexicográfica `YYYY-MM`, mesmo que esteja aberta. Sem estado configurado, deve permanecer honesto e não apresentar uma competência, mês ou valores mensais fictícios. Se houver mais de um estado de condomínio quando o contrato exige um único, a aplicação deve falhar fechada em vez de escolher a primeira linha.

A verificação automatizada e a saúde HTTP não substituem a homologação, a conferência de tarifas e as regras aprovadas pelo condomínio. A documentação identifica as limitações em vez de pressupor integrações ou publicação.
