# Condomínio San Gimignano — escopo aprovado

## Projeto e GitHub
- [x] Usar o nome Condomínio San Gimignano nas telas e documentação.
- [ ] Criar um novo repositório privado na conta GitHub autorizada e conectar o projeto; preservar histórico e não versionar segredos.
- [x] Documentar a base de desenvolvimento e orientar o uso do GitHub Copilot no repositório, sem afirmar que a assinatura ou agente Copilot foi conectado.

## Unidades e leituras
- [x] Cadastro e organização das unidades/apartamentos do condomínio.
- [x] Lançamento mensal das leituras anteriores e atuais de água/Copasa e gás por unidade.
- [x] Cálculo automático do consumo de água e gás pela diferença entre as leituras.
- [x] Configuração mensal das tarifas e do preço por m³, com cálculo dos valores de consumo por apartamento.

## Cobranças e despesas
- [x] Registro das cobranças por unidade, incluindo condomínio, fundo de reserva, multas e outras taxas.
- [x] Registro e categorização das despesas gerais do condomínio em cada mês.
- [x] Fechamento mensal com consolidação de consumos, cobranças, despesas, saldo e valor final por apartamento.

## Acompanhamento e relatórios
- [x] Visão geral do mês com totais do condomínio e detalhamento claro por unidade.
- [x] Histórico de competências para consultar e comparar consumos e valores mensais.
- [x] Relatórios em formato tabular, semelhantes à planilha de referência, com filtros por mês e apartamento.

## Direção visual e segurança
- [x] Aplicar Administração Serena: verde escuro #365847, tons terrosos #C68B59, cartões suaves, tipografia Lato e interface responsiva.
- [x] Persistir dados no banco do projeto e proteger os registros pelo usuário autenticado; não importar números ilegíveis da fotografia como dados confirmados.

## Evidências e limites

As migrações aditivas `0001` e `0002` foram aplicadas. O servidor responde em `/api/health`; o manifesto declara `/` e `/convite/:token`; consultas de dados/acessos sem sessão retornam HTTP 401. TypeScript, compilação e 60 testes em 12 arquivos passaram. A revisão confirmou correções de snapshots, revisão, retorno MySQL, unidades ausentes, datas, CSV pessoal, denominador do rateio, opt-in de despesas, seleção de participantes, validação de frações e retorno de convites. Nenhum dado financeiro foi alterado nem convite/vínculo real criado na evolução. Não houve homologação manual com contas reais de moradores ou publicação. Evidências em `docs/validacao.md`.

O GitHub foi habilitado e a conta `rodrigovccruz` identificada. Foi solicitada a criação e conexão do repositório privado `controle-condominio-residencial`, mas não houve confirmação concluída de criação/transferência. O projeto permanece no repositório gerenciado pelo Manus; não declarar o GitHub conectado nem oferecer um endereço de repositório inexistente.

A fração ideal só participa do cálculo após configuração explícita; há rateio igual e proporcional pelas unidades selecionadas, sem inventar frações cadastrais. Mínimo Copasa, tarifas progressivas, percentuais legais automáticos, saldo anterior por apartamento, boleto/Pix e conciliação não estão implementados. Tarifas e cadastros precisam de conferência. Moradores convidados compartilham o condomínio com consulta apenas de suas cobranças e das despesas comuns; o síndico mantém as edições e o controle de acessos.

## Evolução autorizada — rateio e área do síndico/morador

- [x] Implementar o rateio automático das despesas marcadas como rateáveis, com escolha entre divisão igual pelos apartamentos participantes e divisão por fração ideal. Conservar todos os centavos por despesa com distribuição determinística do resto. Não alterar nem redistribuir cobranças já salvas apenas por implantar a funcionalidade.
- [x] Na área do síndico, cadastrar despesas e sua inclusão/exclusão no rateio, consultar a prévia por unidade e ativar ou atualizar o rateio de uma competência aberta. Somar a parcela rateada separadamente aos consumos e valores manuais. Água/gás já cobrados por consumo individual não devem ser rateados de novo sem escolha explícita.
- [x] Manter leituras anteriores/atuais, tarifas, consumo e cálculo de água/gás por apartamento; mostrar a parcela do rateio nos totais, extratos e CSV. Preservar pagamentos e valores manuais existentes, bloquear edição financeira de competência fechada e exigir reabertura explícita.
- [x] Separar permissões no servidor: síndico responsável pode cadastrar e editar; morador vinculado pode consultar sua própria unidade/cobranças e as despesas comuns, mas não editar dados financeiros, consultar cobranças individuais de outros apartamentos ou administrar acessos.
- [x] Permitir ao síndico gerar convites de morador vinculados a um e-mail e apartamento, com validade e uso único; exigir login oficial e correspondência do e-mail na aceitação; permitir revogar acessos. Contas sem vínculo não ganham permissão de síndico automaticamente.
- [x] Preservar os dez apartamentos reais 101, 102, 201, 202, 301, 302, 401, 402, 501 e 502 e os registros existentes. Aplicar apenas migrações aditivas; não criar despesas, pagamentos, convites ou moradores reais como testes.
- [x] Documentar o repositório com README atualizado, requisitos, arquitetura, regras e exemplos de rateio, permissões/segurança, manual do síndico/morador, instruções de desenvolvimento, migrações, testes e implantação, limitações conhecidas e instruções para o Copilot. Salvar código e documentação no repositório ativo; concluir GitHub apenas se a conexão estiver confirmada.

## Alteração autorizada — quadro inicial e autenticação exclusiva do síndico

Esta seção substitui o fluxo anterior de login inicial Manus e portal autenticado de moradores. Não registrar a senha informada pelo usuário neste arquivo.

- [x] Remover a apresentação inicial e abrir `/` diretamente no quadro de despesas consolidadas da competência mais recente cadastrada. Informar a competência exibida e mostrar estado vazio honesto se nenhum mês existir; nunca criar despesas de demonstração no banco real.
- [x] Manter a entrada na visão pública de despesas mesmo se existir uma sessão administrativa. Expor somente despesas comuns, total/categorias, nome do condomínio e quantidade de apartamentos; não expor moradores, contatos, convites, leituras privadas, pagamentos, multas ou cobranças por apartamento.
- [x] Usar um acesso visualmente discreto à área `/sindico`, solicitando usuário e senha. O usuário de administração é `admin`; a senha fornecida deve ser configurada como segredo protegido, nunca em código, Git, documentação ou frontend.
- [x] Permitir login apenas do síndico nesta interface, sem cadastro/login ou convites de moradores. Preservar registros antigos, mas retirar suas rotas e ações de autenticação do app. Sessões antigas do Manus não concedem acesso administrativo.
- [x] Proteger leitura privada e todas as edições no servidor por uma sessão própria do síndico, com cookie HttpOnly, proteção contra tentativas repetidas, prazo de validade e logout. Não confiar em senha, papel ou flag armazenados no navegador.
- [x] Preservar cadastros, leituras, cobranças, pagamentos, rateio e fechamento. Manter o quadro público somente para consulta e o painel completo disponível após autenticação do síndico.
- [x] Atualizar README, manual, requisitos, segurança, arquitetura e Copilot para o fluxo vigente, incluindo ausência de dados mensais caso o banco continue sem competências. Salvar as mudanças no repositório ativo sem declarar publicação ou conexão GitHub não realizadas.

Evidência desta alteração: 78 testes em 17 arquivos, TypeScript/build concluídos, migração aditiva `0003` aplicada, login/leitura/logout reais por HTTPS confirmados, cabeçalhos anti-cache e reserva atômica de tentativas testados. Hash/revisão do estado financeiro preservados; nenhuma competência ou despesa fictícia criada. Consulte `docs/validacao.md`.
