# Segurança

1. A única área privada é `/sindico`. Login `admin` + `CONDO_ADMIN_PASSWORD` (segredo do ambiente, nunca no Git). Sem a variável, o login fica desativado.
2. A senha é comparada com scrypt em tempo constante. A sessão é um token aleatório de 256 bits; o banco guarda só o hash; expira em 8 horas e é revogada no logout.
3. Após 5 tentativas erradas em 15 minutos, o login bloqueia por IP e também globalmente.
4. Toda leitura e gravação privada é validada no servidor pela sessão. Nada que venha do navegador define permissão.
5. O quadro público monta uma lista fechada de campos (`server/publicDashboard.ts`): sem moradores, sem pagamentos por apartamento, sem extrato.
6. Não versionar `.env`, senhas, tokens ou dados financeiros reais.

Encontrou um problema? Abra uma issue sem detalhes sensíveis ou fale direto com o mantenedor.
