# Guia de uso

A raiz do aplicativo é um quadro público, sem landing page e sem login. Ela mostra as despesas comuns consolidadas da competência cadastrada mais recentemente, mesmo que a competência esteja aberta. A única área privada é a do síndico em `/sindico`.

## Visitante: consultar o quadro público

1. Abra a raiz do aplicativo.
2. Consulte o nome do condomínio, a quantidade agregada de apartamentos e a competência mais recente.
3. Confira o status da competência e as despesas comuns por descrição, categoria, data e valor em centavos, além dos agregados por categoria.
4. Não espere encontrar unidades, nomes, contatos, leituras, consumos individuais, cobranças, pagamentos, multas individuais, convites ou dados de sessão.
5. O quadro é igual com ou sem cookie administrativo. Um navegador que tenha sido usado pelo síndico não altera o payload anônimo.
6. Se não houver competência cadastrada, a ausência deve ser exibida honestamente; não interpretar valores fictícios ou o mês literal do estado inicial como lançamento real.

## Síndico: entrar

1. Na raiz pública, clique no link discreto **Área do síndico** no rodapé, ou acesse `/sindico` diretamente.
2. Informe o usuário literal `admin`.
3. Informe a senha configurada pelo responsável no segredo de ambiente `CONDO_ADMIN_PASSWORD`. O valor não é mostrado nesta documentação, não é senha padrão e não deve ser repetido em chat, commit ou log.
4. Após o login, confirme que `auth.me` identifica o síndico e que os painéis privados carregam o estado correto.
5. O login OAuth/Manus, a presença de um cookie da plataforma ou um registro legado de membro não substituem essa sessão.

Se o segredo não estiver configurado, o login deve falhar fechado. Em credencial errada, a mensagem deve ser genérica. Após cinco falhas na janela padrão de quinze minutos, o limitador por IP e global pode bloquear novas tentativas; aguarde o período indicado sem tentar contornar o controle.

## Síndico: preparação inicial

1. Confirme o nome do condomínio e o cadastro das unidades. A referência conhecida tem as unidades 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502.
2. Confirme moradores, unidades ativas e frações ideais. Não preencha frações presumidas a partir de fotografia ilegível.
3. Confira saldos iniciais e demais dados financeiros antes de uso oficial. Não há seed financeiro autorizado.
4. Confirme que nenhum registro legado de `condo_memberships` ou `condo_invites` foi tratado como acesso atual.

## Síndico: abrir uma competência

1. Crie ou selecione a competência `AAAA-MM`.
2. Informe tarifas de água e gás em centavos por m³ e o saldo inicial.
3. Lance leitura anterior e atual por unidade. Corrija qualquer leitura regressiva antes de avançar.
4. Lance condomínio, fundo de reserva, multa, outros valores e pagamentos manualmente quando aplicável.
5. Cadastre despesas com descrição, categoria, data e valor. Data deve pertencer à competência.
6. Revise totais, créditos, valores em aberto, saldo de caixa e saldo projetado; não confunda saldo projetado com dinheiro disponível.

## Síndico: configurar e confirmar o rateio

1. Abra a aba/painel **Rateio da competência**. Se o mês não deve ter despesas comuns rateadas, deixe a configuração ausente.
2. Selecione `Divisão igual` para pesos 1 entre os participantes. Como referência, dez unidades participantes aproximam 10% cada, mas centavos residuais seguem maiores restos e não criam nova fração ideal.
3. Ou selecione `Fração ideal`. Preencha fração positiva em todas as unidades ativas e confira soma de 100% com tolerância de 0,01 ponto percentual.
4. Marque ou desmarque os apartamentos no campo **Unidades que participam deste rateio**. Se escolher apenas um subconjunto no método por fração, os pesos serão proporcionais às frações das unidades selecionadas. A configuração captura um snapshot; mudança cadastral futura não reescreve o histórico.
5. Marque `rateável` somente nas despesas que devem participar. Despesas antigas sem marcação permanecem fora.
6. Exclua, normalmente, contas comuns de água/gás que já foram cobradas por consumo individual. Se a inclusão for intencional, registre a justificativa e valide a prévia para não duplicar.
7. Confira a prévia por despesa e por unidade. O painel deve mostrar soma exata e o componente `sharedCents` separado de consumo e valores fixos.
8. Clique em **Configurar rateio** ou **Atualizar configuração** enquanto a competência estiver aberta. A confirmação passa por `condo.save` e a competência fechada fica somente para consulta.
9. Verifique rateio na cobrança, no extrato, no total mensal e no CSV. A parcela não deve substituir condomínio, consumo, pagamentos ou valores manuais.
10. Feche a competência somente após a conferência. Para corrigir conteúdo fechado, reabra explicitamente; não altere silenciosamente.

Novas despesas rateáveis entram no cálculo de uma competência aberta que já tenha configuração. A função de limpar configuração remove o snapshot e faz o total rateado voltar a zero; despesas continuam registradas e podem ser marcadas novamente.

## Síndico: sair

1. Acione **Sair** na área privada, que chama `auth.logout`.
2. A sessão própria deve ser revogada no servidor e o navegador deve retornar à raiz pública.
3. Se o navegador mantiver dados antigos de uma consulta privada, limpe o cache/query privado da aplicação; isso não substitui a revogação server-side.
4. Depois do logout, `auth.me` deve retornar `null`, `publicDashboard.get` deve continuar disponível e `condo.get/save` devem ser negados.

Não há operação de convite, aceite de morador, revogação de membership ou portal pessoal. Registros históricos desses fluxos não devem ser reativados pela interface.

## Conferência antes do fechamento

- Todas as dez unidades de referência estão presentes ou sua ausência foi deliberada?
- Leituras atuais não são menores que anteriores?
- Tarifas e frações foram conferidas com o síndico?
- Despesas antigas não foram incluídas por acidente?
- Água/gás comum não duplicam o consumo individual?
- A prévia fecha centavo a centavo por despesa?
- Cobrança, pagamento e crédito foram preservados?
- A competência ainda está aberta durante toda a edição?
- O relatório mostra `sharedCents` separadamente?
- Não há dados da fotografia ilegível tratados como verdade?
- O quadro público exibe somente a competência maior em `YYYY-MM`, sem dados privados?

## Correções e suporte operacional

Não apagar competência ou unidade para “corrigir” histórico. Desative unidades com histórico, reabra competência fechada por ação explícita e registre a razão da alteração. Em conflito de revisão, recarregue o estado mais recente, compare mudanças e salve novamente; não force sobrescrita.
