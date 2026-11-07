# Verificação da entrega

## Fluxo atual — quadro público e acesso exclusivo do síndico

Verificação realizada em **7 de novembro de 2026**, após a alteração de entrada e autenticação solicitada pelo responsável. Os resultados abaixo foram efetivamente observados.

| Verificação | Resultado |
| --- | --- |
| `pnpm check` | TypeScript sem erros. |
| `pnpm test` | **17 arquivos e 78 testes passaram**. |
| `pnpm build` | Frontend Vite e servidor esbuild compilados. |
| `git diff --check` | Sem erros de whitespace/patch. |
| `/api/health` | HTTP 200 com `{"status":"ok"}`. |
| `/manus-routes.json` | HTTP 200; somente `/` e `/sindico`. |
| Entrada `/` | Página de despesas montada diretamente; nenhuma apresentação, login inicial ou redirecionamento por sessão administrativa. Contrato de rotas e estado vazio cobertos por teste e inspeção do código. |
| `publicDashboard.get` | Leitura real por HTTPS sem sessão e com sessão do síndico; respostas públicas iguais e limitadas aos campos permitidos. |
| Ausência de meses | `latest: null`; dez apartamentos existentes e nenhuma competência/despesa fictícia criada. |
| Última competência | Seleção da maior `YYYY-MM`, incluindo uma aberta mais recente, coberta por testes com dados em memória. |
| `condo.get` sem login | HTTP 401. |
| `access.list` legado | HTTP 404; nenhum roteador de convites/moradores montado. |
| Login real do síndico | Credencial protegida configurada; login `admin` aceito por HTTPS. A identidade validada permitiu ler o painel privado do próprio condomínio. |
| Cookie | HttpOnly, Secure e SameSite=None confirmados na resposta HTTPS. Token não registrado nesta documentação. |
| Logout real | Mutação POST revogou a sessão testada; `auth.me` voltou a `null` e o cookie anterior não pôde ser reutilizado em `condo.get`. |
| Cache HTTP | `Cache-Control: private, no-store` confirmado por HTTPS nas respostas RPC; `Vary: Cookie` coberto por teste. |
| Cache no navegador | Teste confirma remoção das chaves aninhadas privadas do tRPC e do cache de mutações, preservando o quadro público. |
| Falha de banco ao sair | Testes confirmam limpeza incondicional de cookies e resposta de indisponibilidade, sem anunciar revogação confirmada quando a exclusão falha. |
| Tentativas paralelas | Reserva transacional anterior ao cálculo da senha; teste com vinte chamadas concorrentes autoriza no máximo a cota de cinco. Nova janela somente após o prazo. |
| Migração `0003` | Sessões e rate limit criados por migração aditiva revisada. Sem DROP, DELETE ou mudanças no estado financeiro. |
| Integridade financeira | Hash do estado e revisão iguais antes/depois; dez apartamentos preservados, nenhum lançamento financeiro de teste. |

## Proteções verificadas por testes e revisão

Segredo ausente falha fechado; usuário diferente e senha incorreta não autenticam; cookies/tokens Manus e o papel antigo `User.role` não autorizam o síndico. Tokens são opacos de 256 bits, persistidos somente como SHA-256 e recusados após a expiração de oito horas ou remoção. A API privada continua preservando validação financeira, revisão otimista, rateio e fechamento.

O quadro público não contém estado bruto, proprietário/revisão, nomes de moradores, contatos, leituras, cobranças/pagamentos/multas individuais, convites ou sessão. O contrato público contém somente condomínio, quantidade de apartamentos, competência, despesas comuns e categorias. Registros legados não foram usados para autorização nem apagados.

## Limites da verificação

O fluxo real de login/leitura/logout foi exercitado por HTTPS, sem editar finanças. Não foi efetuada homologação visual completa em todos os navegadores ou políticas de cookies de terceiros. Falhas de banco, expiração, concorrência e dados de competências são testadas em memória/mocks; não foi provocado um incidente no banco compartilhado para validá-las.

O build mantém os avisos conhecidos de script `config.js` fornecido em runtime e bundle acima de 500 kB. Na verificação original ainda não havia publicação do código no GitHub. Sessões de verificação são acessos reais do síndico, não contas ou dados financeiros fictícios.

## Registro anterior

A evolução anterior de rateio e permissões passou por 12 arquivos/60 testes. Esse resultado é histórico: o login OAuth, os convites e o portal de moradores foram substituídos pelo fluxo atual. As tabelas legadas permanecem preservadas, sem rotas de autorização ativa.

## Validação e publicação do código no GitHub

Em **7 de novembro de 2026**, a exportação integral da cópia fonte, limpa no commit `0817c5bb46832c46f69fa4a0452663247c5ab51d`, foi conferida contra o manifesto: **188 arquivos** com hashes correspondentes. O código foi publicado no repositório público [rodrigovccruz/gestaocondominio](https://github.com/rodrigovccruz/gestaocondominio), branch `main`, commit `fc747cb4bff47f8283f52febfb62cf98e253c1df`. O commit de integração preserva o commit inicial do GitHub.

Na cópia verificada antes do envio, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` (**17 arquivos e 78 testes**) e `pnpm build` concluíram com sucesso. A varredura não encontrou credenciais operacionais, arquivos `.env` com valores reais ou dados do banco; somente `.env.example` com placeholders e fixtures artificiais de teste. O build emite os avisos de runtime/bundle já descritos acima. No primeiro import, `git diff --cached --check` reportou dois espaços finais preexistentes em `patches/wouter@3.7.1.patch`; o arquivo foi preservado sem alterações.

Esta operação publicou somente o repositório de código. **Não houve deploy do site, execução de migrações nem alteração do banco de dados do condomínio.**
