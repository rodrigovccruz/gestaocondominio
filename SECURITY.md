# Segurança

## Escopo

O sistema processa dados de condomínio, unidades, leituras, cobranças, pagamentos e despesas. A raiz oferece um quadro público mínimo; a área privada é exclusiva do síndico autenticado. Esta política cobre o código, a configuração e o fluxo de sessão próprio do aplicativo.

Dados legados de `condo_memberships` e `condo_invites` podem continuar no banco para preservar histórico, mas não são credenciais, não concedem papel e não devem reativar portal, convite ou login de morador.

## Princípios obrigatórios

- Não usar Manus OAuth como autorização de negócio do condomínio.
- Aceitar login privado somente em `/sindico`, com usuário literal `admin` e `CONDO_ADMIN_PASSWORD` fornecida em runtime.
- Falhar fechado quando o segredo estiver ausente; não manter senha padrão, fallback ou bypass localStorage.
- Derivar a senha com `scrypt` e comparar em tempo constante; nunca armazenar ou retornar a senha.
- Emitir sessão opaca aleatória de 256 bits, persistindo somente o hash SHA-256 em tabela aditiva; expiração de oito horas e revogação no logout.
- Aplicar autorização server-side em cada leitura e mutação privada; `condo.get/save` exigem a sessão própria.
- Não confiar em `ownerId`, role, unidade, e-mail, cookie Manus ou qualquer credencial enviada pelo navegador.
- Não usar `user.role` da plataforma como papel de síndico.
- Manter o quadro público limitado ao DTO documentado, sem estado financeiro bruto ou dados individuais.
- Competência fechada é imutável no conteúdo financeiro; reabertura é explícita.
- Usar revisão/controle condicional para evitar sobrescrita concorrente.
- Preservar histórico; não apagar cobranças, pagamentos, snapshots, membros legados, convites legados ou unidade com histórico para corrigir dado.
- Não registrar ou versionar segredos, senhas, tokens crus, hashes, cookies, PII ou dumps financeiros.
- Usar mocks/fixtures fictícios e nunca rodar teste destrutivo no banco compartilhado.

## Quadro público e minimização

`publicDashboard.get` é público e deve ser independente da presença de cookie administrativo. Só pode retornar `name`, `apartmentCount` e `latest` com `competence`, `status`, `totalExpensesCents`, despesas com `id`, `description`, `category`, `date`, `amountCents`, e agregados `categories` com `category`/`amountCents`.

É proibido retornar `ownerId`, `revision`, unidades ou seus nomes, contatos, leituras, consumos individuais, cobranças privadas, pagamentos, multas individuais, memberships, convites, sessão, token ou hash. O servidor deve projetar e validar o DTO; o client não é filtro de segurança.

A competência pública é a maior `YYYY-MM` cadastrada, inclusive aberta. Sem mês, usar `latest: null` e não inventar dataset mensal. Configuração ambígua deve falhar fechada, sem escolher a primeira linha.

## Autenticação, rate limit e sessão

O segredo `CONDO_ADMIN_PASSWORD` deve ser fornecido pelo gerenciador de segredos do ambiente e não deve aparecer no `.env.example` além do placeholder vazio. Credenciais erradas recebem mensagem genérica, sem enumeração de usuário. O padrão de proteção é limitar cinco falhas em quinze minutos por IP e global; a implementação deve manter o mesmo comportamento na validação final.

O token de sessão é criado com aleatoriedade criptográfica de 32 bytes, enviado apenas como cookie protegido e convertido em hash para persistência/lookup/revogação. A tabela de sessão é aditiva; não substituir nem apagar o estado financeiro existente. Após expiração ou logout, `auth.me` deve ser nulo e `condo.get/save` devem ser negados. `auth.logout` deve ser seguro mesmo sem uma sessão válida.

## Contrato de autorização

- Visitantes podem consultar apenas o DTO público.
- Síndico autenticado pode operar o próprio estado, inclusive unidades, leituras, despesas, rateio, quotas, pagamentos, CSV e fechamento, segundo as regras financeiras.
- Cookie Manus sem sessão própria, usuário de plataforma, registro legado de membership ou convite, e qualquer outro condomínio não podem editar ou ler o estado privado.
- Não montar rotas de OAuth, signup, convite, aceite, revogação de morador ou portal.

## Como reportar vulnerabilidade

Não abra issue pública com exploit, senha, token, hash, cookie, e-mail, URL de banco ou dados reais. Envie uma descrição privada pelo canal de segurança configurado para o repositório/projeto Manus, ou solicite ao mantenedor um canal privado. Inclua somente:

- resumo e impacto;
- passos mínimos reproduzíveis com dados fictícios;
- rota/procedimento e ambiente afetado;
- horário aproximado e evidência sanitizada;
- sugestão de correção, se houver.

Remova cabeçalhos de autenticação, cookies, tokens e identificadores pessoais antes de compartilhar logs. Não tente acessar dados de terceiros além do mínimo necessário para confirmar o problema.

## Resposta a incidente

1. preservar evidência sanitizada;
2. revogar sessões próprias comprometidas e rotacionar `CONDO_ADMIN_PASSWORD` pelo gerenciador de segredos, sem publicar o valor;
3. bloquear a rota ou acesso afetado sem apagar evidência;
4. avaliar exposição do DTO público e o escopo do estado configurado;
5. corrigir com teste de regressão;
6. aplicar migração/revisão somente depois de preservar o histórico;
7. documentar impacto e encerramento sem divulgar PII.

## Limites de segurança conhecidos

O sistema não integra boleto/Pix, conciliação bancária, WhatsApp ou PDF automático anexado neste escopo. `/api/health` comprova apenas disponibilidade HTTP, não autorização ponta a ponta. A validação final integrada de sessão, DTO, rateio e preservação do banco deve ser executada sem banco compartilhado destrutivo e sem dados reais.
