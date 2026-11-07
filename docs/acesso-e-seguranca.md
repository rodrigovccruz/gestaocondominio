# Acesso e segurança

## Modelo atual

A aplicação tem somente dois contextos de negócio:

- **Anônimo:** pode ler o quadro público mínimo de despesas comuns.
- **Síndico autenticado:** pode operar o condomínio próprio pela sessão opaca emitida pelo login em `/sindico`.

Não existe papel de morador, login OAuth, signup, convite, portal de moradores ou autorização por membership. `condo_memberships` e `condo_invites` são dados legados preservados historicamente; não concedem sessão, leitura ou edição.

A regra central é **autorização no servidor**. Esconder botões ou guardar credenciais no navegador não é barreira de segurança. O quadro público permanece igual com ou sem cookie de administrador.

## Matriz de autorização

| Ação/dado | Visitante anônimo | Síndico autenticado | Cookie Manus sem sessão própria | Registro legado de membro/convite |
| --- | :---: | :---: | :---: | :---: |
| Ver quadro público consolidado | Sim | Sim | Sim | Sim, como qualquer visitante |
| Ver nome e quantidade agregada | Sim | Sim | Sim | Sim, como qualquer visitante |
| Ver despesas/categorias da competência mais recente | Sim, somente DTO permitido | Sim | Sim, somente DTO permitido | Sim, somente DTO permitido |
| Ver unidades, nomes, contatos ou leituras | Não | Sim, nos painéis privados permitidos | Não | Não |
| Ver cobranças individuais, pagamentos privados ou multas individuais | Não | Sim, nos painéis privados permitidos | Não | Não |
| Fazer `auth.login` | Pode enviar formulário; só credencial configurada autentica | Pode renovar após logout | Não por ser cookie Manus | Não por existir registro legado |
| Fazer `auth.me` | `null` | `SyndicIdentity` própria | `null` | `null` |
| Fazer `auth.logout` | Sim, efeito idempotente | Sim; revoga sessão própria | Sem efeito de autorização Manus | Sem efeito |
| Ler `condo.get` | Não | Sim, com sessão própria | Não | Não |
| Gravar `condo.save` | Não | Sim, com sessão própria e competência aberta | Não | Não |
| Gerenciar convites/membros | Não | Não há fluxo atual | Não | Não |
| Administrar outro condomínio | Não | Não | Não | Não |

A publicação/visibilidade da plataforma é independente da autenticação do aplicativo. Uma raiz pública não transforma o estado financeiro em público além do DTO; Preview, código salvo e cookie Manus também não concedem edição.

## Contratos de autenticação

| Método | Tipo de acesso | Entrada | Resultado |
| --- | --- | --- | --- |
| `auth.login` | público | `{ username, password }` | `{ success: true }` após validar `admin` e `CONDO_ADMIN_PASSWORD`; sessão própria criada. |
| `auth.me` | público | nenhuma | `null` ou `SyndicIdentity` compartilhada. |
| `auth.logout` | público | nenhuma | revoga a sessão própria presente e retorna `{ success: true }`. |
| `publicDashboard.get` | público | nenhuma | DTO mínimo, sem dependência da sessão. |
| `condo.get` | sessão própria | nenhuma | estado completo para o síndico autorizado. |
| `condo.save` | sessão própria | `{ revision, state }` | valida e persiste somente o próprio estado. |

`auth.me` nunca deve devolver `users`/identidade Manus como se fossem identidade do síndico. `user.role` da plataforma, se ainda existir para compatibilidade, não é autorização de negócio.

## DTO público e minimização

O único payload financeiro anônimo é `PublicDashboard` de `shared/public-dashboard.ts`, com `name`, `apartmentCount` e `latest`. Dentro de `latest`, os únicos campos são `competence`, `status`, `totalExpensesCents`, `expenses` com `id`, `description`, `category`, `date`, `amountCents`, e agregados `categories` com `category`/`amountCents`.

É proibido incluir `ownerId`, `revision`, unidades ou seus nomes, contatos, leituras, consumo individual, cobranças privadas, pagamentos, multas individuais, convites, memberships, token, hash, cookie ou sessão. O servidor deve projetar o DTO, não serializar o estado bruto e esperar que o client filtre depois.

A competência é a maior `YYYY-MM` cadastrada, mesmo aberta. Sem competência, o retorno deve ser `latest: null`; não inventar um mês ou valores do estado inicial. Configuração ambígua deve ser indisponível, nunca “primeira linha vence”.

## Sessão própria

- O login usa usuário literal `admin` e `CONDO_ADMIN_PASSWORD` carregado em runtime.
- A senha é derivada em memória com `scrypt` e comparada em tempo constante. O valor fica no serviço protegido de ambiente, nunca no código, frontend, banco de sessões ou resposta da API.
- O token é opaco, aleatório, de 256 bits; somente SHA-256 do token fica em `syndic_sessions`.
- A sessão deixa de ser aceita após oito horas. O logout remove seu hash do banco; cookies são limpos mesmo em falha de banco. Se a exclusão não for confirmada, a API retorna indisponibilidade, não sucesso de revogação.
- O cookie deve ser `httpOnly`, `secure` em HTTPS e compatível com o proxy adotado.
- O segredo ausente causa falha fechada: não existe senha padrão ou fallback para OAuth/Manus.
- Credencial errada responde genericamente. Cada tentativa reserva atomicamente a cota antes do cálculo da senha, com máximo de cinco por quinze minutos sem sucesso, por IP e global. Um login válido reinicia os contadores. Isso evita rajadas paralelas passando pela mesma contagem anterior.
- Nunca registrar senha, token cru, hash, cookie, segredo, `DATABASE_URL`, PII ou estado financeiro bruto.

`condo.get` e `condo.save` devem exigir a sessão própria e conferir o estado configurado no servidor. Não aceitar `ownerId`, role, unidade ou e-mail equivalente enviado pelo navegador. Uma sessão Manus existente pode continuar sendo útil a componentes da plataforma, mas nunca autoriza estes procedimentos.

Todas as respostas `/api/trpc` usam `Cache-Control: private, no-store`, `Pragma: no-cache` e `Vary: Cookie`. Ao sair, o cliente remove os caches privados com as chaves aninhadas reais do tRPC e o cache de mutações, que pode conter variáveis de login. Isso não substitui a revogação da sessão no servidor.

## Dados legados

Registros de `condo_memberships` e `condo_invites` devem ser preservados quando necessários ao histórico e não devem ser apagados por uma migração de autenticação. Eles não podem ser consultados como autorização atual, reativar portal, montar rota de convite ou conceder papel. Não criar novos membros, convites ou dados de teste.

## Limite de evidência

A presença dos módulos `server/syndic-auth.ts` e `server/publicDashboard.ts` não substitui check, testes, build, inspeção de rotas e fluxo autenticado. Antes de publicar, validar login correto/incorreto, segredo ausente, genericidade de erros, rate limit IP/global, expiração/revogação, DTO sem campos proibidos, competência aberta mais recente, estado vazio, isolamento de `condo.get/save`, preservação financeira e migração aditiva. Registrar somente resultados reais em [Verificação da entrega](validacao.md).

## Incidente ou suspeita

Não publique senha, tokens, hashes, cookies, dados pessoais ou dumps financeiros em issue, pull request ou chat. Preserve horário, rota, usuário afetado e mensagem sanitizada; siga [`SECURITY.md`](../SECURITY.md) para o canal privado.
