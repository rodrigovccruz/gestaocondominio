# Requisitos

## Escopo e status

O aplicativo tem duas superfícies deliberadas:

1. um quadro público consolidado na raiz, sem landing page e sem login;
2. uma área privada de operação em `/sindico`, acessível somente ao síndico autenticado.

O login de moradores, OAuth, signup, convites, memberships como autorização, portal de moradores e rotas montadas para esses fluxos estão fora do escopo atual. Tabelas e registros legados de `condo_memberships` e `condo_invites` podem ser preservados para histórico, mas não concedem acesso. “Requerido” descreve o contrato que a implementação deve cumprir; “pendente” não é evidência de que a integração já foi validada.

## Requisitos funcionais financeiros

1. Identificar o condomínio e manter unidades/apartamentos com número, morador, fração informativa e estado ativo.
2. Registrar competências mensais no formato `YYYY-MM`, com tarifa de água, tarifa de gás, saldo inicial, cobranças e despesas.
3. Registrar leituras anterior/atual de água e gás por unidade, recusando leitura atual menor que a anterior.
4. Calcular consumo pela diferença das leituras e o valor em centavos pela tarifa da competência.
5. Manter cobranças de condomínio, fundo de reserva, multa, outros valores, pagamentos e observações.
6. Registrar despesas categorizadas e permitir relatórios tabulares, filtros, impressão e exportação quando suportados pela interface atual.
7. Separar valores cobrados, recebidos, em aberto, créditos, despesas, saldo de caixa e saldo projetado.
8. Persistir o estado do condomínio e evitar perda por concorrência por meio de revisão esperada.
9. Impedir alteração do conteúdo de competência fechada no servidor; exigir reabertura explícita antes de mudar conteúdo financeiro.
10. Preservar os painéis administrativos existentes de unidades, leituras, despesas, rateio, quotas, pagamentos, CSV e fechamento.

## Quadro público

O procedimento público `publicDashboard.get` deve sempre resolver o único estado configurado do condomínio e projetar apenas o DTO compartilhado em `shared/public-dashboard.ts`.

- Não exige sessão nem cookie.
- Não muda quando o cookie do administrador está presente ou ausente.
- Usa a competência cujo `competence` é o maior valor lexicográfico no formato `YYYY-MM`; a competência pode estar aberta ou fechada.
- Não escolhe a competência anterior do calendário e não filtra apenas competências fechadas.
- Sem meses cadastrados, retorna `latest: null`; não fabrica mês, total mensal, competência ou dataset literal de seed.
- Se o estado do condomínio estiver vazio, a resposta deve ser honesta e não transformar o estado inicial literal em dados mensais apresentados como reais.
- Se a configuração estiver ambígua, deve falhar fechada em vez de escolher silenciosamente uma linha.

O DTO público permitido é:

```ts
type PublicDashboard = {
  name: string;
  apartmentCount: number;
  latest: {
    competence: string;
    status: "open" | "closed";
    totalExpensesCents: number;
    expenses: Array<{
      id: string;
      description: string;
      category: "Água" | "Gás" | "Manutenção" | "Limpeza" | "Administração" | "Outros";
      date: string;
      amountCents: number;
    }>;
    categories: Array<{
      category: "Água" | "Gás" | "Manutenção" | "Limpeza" | "Administração" | "Outros";
      amountCents: number;
    }>;
  } | null;
};
```

O quadro público não pode retornar `ownerId`, `revision`, lista ou nome de unidade, contato, morador, leitura, cobrança individual, pagamento privado, multa individual, convite, membership, token, hash, sessão ou qualquer outro campo financeiro privado. `totalExpensesCents` soma somente as despesas da competência pública; não é total de cobranças das unidades.

## Autenticação e autorização do síndico

1. O acesso privado começa somente pelo link discreto **Área do síndico** e pela rota `/sindico`.
2. `auth.login` é público para receber `{ username, password }`, mas só aceita o usuário literal `admin` e a senha presente em `CONDO_ADMIN_PASSWORD` no ambiente do servidor.
3. A senha não é documentada, exibida, versionada ou repetida em mensagens. O placeholder de `.env.example` permanece vazio; a configuração deve ser feita no gerenciador de segredos do ambiente.
4. O servidor deve falhar fechado quando o segredo estiver ausente. Credenciais erradas devem ter resposta genérica e não revelar qual campo falhou.
5. A senha deve ser comparada por derivação `scrypt` e comparação em tempo constante. O token de sessão deve ser opaco, aleatório e de 256 bits; somente seu hash deve ser persistido no MySQL.
6. A sessão própria expira em oito horas, é revogável no logout e é a única credencial que autoriza edição privada.
7. Deve haver limitação de tentativas por IP e global, com padrão de cinco falhas em janela de quinze minutos. A validação final deve confirmar a política no servidor.
8. `auth.me` retorna `null` ou a `SyndicIdentity` compartilhada; não retorna usuário Manus, OAuth, moradores ou dados privados.
9. `auth.logout` revoga a sessão própria e leva o navegador de volta ao quadro público. Limpar cache/query privado do navegador é uma medida operacional adicional, não uma autorização.
10. Cookie Manus, `ownerId`, `role`, unidade ou credencial guardados no navegador não concedem acesso privado.

## Contratos protegidos

- `condo.get` exige a sessão opaca própria do síndico e retorna o estado financeiro completo permitido aos painéis administrativos.
- `condo.save` exige a sessão opaca própria do síndico, resolve o próprio estado configurado no servidor, valida `revision` e aplica as regras de competência fechada.
- Nenhum procedimento privado deve aceitar `ownerId` enviado pelo client como fonte de autorização.
- Não há procedimentos de convite, aceite de convite, listagem de membros ou portal de morador no contrato atual.

## Requisitos não funcionais

- **Integridade:** valores monetários, pesos e revisões devem usar inteiros seguros; entradas devem ser validadas no servidor.
- **Privacidade:** o quadro público deve ser mínimo; nunca expor dados privados ou segredos; não registrar token cru, senha, hash, cookie ou PII.
- **Concorrência:** usar revisão/atualização condicional e responder conflito sem sobrescrever outra sessão.
- **Histórico:** preservar snapshots de unidade e rateio; desativar unidade com histórico em vez de apagar.
- **Migrações:** sessão e rate limit novos devem ser aditivos, revisados e aplicáveis uma vez ao MySQL compartilhado; não apagar tabelas legadas históricas.
- **Operação:** não executar testes destrutivos, seeds ou limpeza contra Preview/produção compartilhados.
- **Separação de plataforma:** visibilidade/publicação da plataforma é independente do login da aplicação; salvar código, Preview ou cookie Manus não publica nem autoriza o quadro privado.

## Critérios de aceite

A mudança só deve ser declarada validada depois de check, testes, build, inspeção das rotas montadas, teste do DTO sem vazamento, teste do maior `YYYY-MM` aberto, teste de estado vazio, teste de segredo ausente/credencial genérica, revogação, expiração, rate limit, isolamento de `condo.get/save`, preservação do estado financeiro e revisão da migração aditiva. Os resultados reais, inclusive contagens, devem ser registrados em [Verificação da entrega](validacao.md); não inventar números antes da execução.
