# Evolução do San Gimignano — rateio, acessos e documentação

Esta evolução foi solicitada após a confirmação de que faltavam rateio automático e permissões formais de síndico/morador. Reutiliza a interface Administração Serena, o projeto React/Express/tRPC/MySQL e o fluxo de autenticação Manus OAuth existentes. Não há nova publicação autorizada nem integração bancária neste escopo.

## Implementação

O rateio será uma configuração opcional de cada competência. Uma competência sem configuração continuará calculando exatamente como antes. A despesa terá marcação opcional de rateável; registros antigos permanecerão fora do rateio. O síndico escolherá participantes e o método igual ou por fração ideal e poderá consultar a prévia. As frações/participantes serão registradas na competência, para mudanças cadastrais posteriores não reescreverem o histórico. Novas despesas marcadas como rateáveis serão distribuídas automaticamente na competência configurada. Uma atualização de participantes ou frações será uma ação explícita.

A parcela distribuída será apresentada separadamente da cota manual e dos consumos individuais. Nada será sobrescrito. O cálculo utilizará centavos inteiros, pesos inteiros e o método de maiores restos por despesa, com desempate pelo identificador da unidade. A soma das parcelas será exatamente o valor rateável, sem dízimas ou centavos perdidos. As contas de água/gás poderão ser excluídas para não duplicar cobranças por consumo. Competências fechadas continuarão imutáveis no servidor.

A conta já responsável pelo estado persistido do condomínio terá permissão de síndico. O servidor derivará a permissão desse vínculo, nunca de uma escolha enviada pelo navegador ou do primeiro usuário a entrar. Moradores serão vinculados por convite com e-mail e unidade, token criptograficamente aleatório armazenado somente como hash, validade e uso único. O servidor enviará ao morador apenas suas cobranças e o demonstrativo de despesas comuns. Sem vínculo, a conta ficará aguardando autorização. A autenticação oficial e o controle de revisão serão preservados.

## Estrutura do projeto

`shared/condo.ts` manterá o contrato de dados e a composição das cobranças. `shared/rateio.ts` concentrará a distribuição matemática e as validações de configuração. `shared/access.ts` definirá os resultados e os vínculos de acesso. `server/condo.ts` continuará responsável pela persistência e proteção financeira; `server/access.ts` concentrará convites, vínculos e autorização. `drizzle/` receberá somente tabelas/migrações aditivas. `client/src/components/condo/` receberá painéis de rateio e acessos, e `client/src/pages/` receberá o portal de morador e a aceitação de convite. `docs/` reunirá requisitos, arquitetura, regras financeiras, segurança, manual e instruções de desenvolvimento. Os testes existentes serão preservados e ampliados em memória/mocks.

O servidor Express continuará servindo a interface Vite no desenvolvimento e os arquivos compilados na execução de produção. O banco gerenciado é compartilhado, portanto testes não escreverão dados financeiros reais. As rotas de páginas novas serão declaradas em `client/public/manus-routes.json`. O repositório atual será preservado e a conexão GitHub só será declarada concluída se o fluxo oficial confirmar a transferência.

## Revisão autorizada — acesso do síndico e quadro de entrada

Esta revisão substitui o fluxo anterior de autenticação Manus/convites de moradores. A entrada passa a ser o quadro somente de leitura da última competência cadastrada, sem apresentação ou login inicial. `/sindico` concentra o painel de edição e um formulário compacto de usuário/senha. Os registros anteriores são preservados, mas não concedem acesso administrativo.

A API pública utiliza lista permitida: nome do condomínio, quantidade de unidades, competência, despesas comuns e consolidação por categoria. Não retorna estado financeiro completo, dados pessoais ou cobranças por apartamento. A autenticação usa a credencial do síndico como segredo protegido de ambiente, comparação segura no servidor e sessão opaca aleatória com hash no MySQL. Cookies de Preview/Manus não substituem esse login. Sem competência cadastrada, o quadro informa a ausência de dados.

`shared/public-dashboard.ts` define o DTO público; `shared/syndic.ts` define a identidade validada da sessão local. Servidor e frontend separam consulta pública e edição privada. Mantêm-se o estilo Administração Serena e os componentes financeiros existentes, com link discreto de gestão. A configuração da senha não publica a nova versão nem muda a visibilidade de plataforma.
