# Backup do banco de produção

Estado do condomínio no banco de **produção** (`condo-db`, `sangimignano.vercel.app`) em **12/11/2026 00:33 UTC**, na revisão **8**. Aplicação publicada no commit `a5de368`.

Este script é o backup que será rodado no dia da virada de produção. Ele coloca o banco exatamente como estava neste momento.

## O que o backup tem

| Item | Valor |
| --- | --- |
| Condomínio | Condomínio San Gimignano |
| Apartamentos | 10 (101 isento) |
| Saldo inicial | R$ 3.130,85 em 31/10/2026 |
| Tarifas | salário mínimo R$ 1.621,00, taxa 22% do mínimo, manutenção 15%, reserva 20%, administração R$ 26,75, gás R$ 23,63/m³ |
| Mês | 2026-10 (em aberto) |
| Leituras | 10 apartamentos |
| Despesas | 15, sendo 13 a pagar |
| Cobranças avulsas | 1 |
| Pagamentos de cota | 8 apartamentos |
| SHA256 do JSON do estado | `86b33614d2eeeec9f4ecce515da206f6408cae7605e8d6f610e57c89adca427c` |

**O que o backup não tem:** a senha do síndico (fica na variável `CONDO_ADMIN_PASSWORD` da Vercel), as sessões de login e o contador de tentativas de login. Isso se refaz sozinho. As tabelas também não estão no script: o app as cria no primeiro acesso.

## Como rodar no dia da virada

1. **Atenção:** o script **substitui todo o estado do condomínio** pelo deste arquivo. Tudo o que foi lançado na produção depois de 12/11/2026 00:33 UTC se perde. Se quiser guardar o que foi lançado, antes tire um backup novo (veja o fim deste arquivo).
2. Abra o banco: Vercel, projeto `gestaocondominio`, aba **Storage**, banco `condo-db` (produção), **Open in Neon**, **SQL Editor**. Confirme o nome do banco: não rode no `condo-db-teste`.
3. Cole o script da próxima seção inteiro e rode. Se o editor reclamar do texto entre `$estado$`, use o `psql` com a `DATABASE_URL_UNPOOLED` do projeto.
4. Rode a conferência da seção **Conferência** e compare com os valores esperados.
5. Abra `https://sangimignano.vercel.app`: o quadro deve mostrar outubro como está neste arquivo.
6. Quem estiver com `/sindico` aberto precisa recarregar a página: a revisão sobe e o app recusa gravar por cima.
7. Troque a senha do síndico (`CONDO_ADMIN_PASSWORD`, em Production e Preview) e faça um Redeploy, se ainda não trocou.

O script pode ser rodado mais de uma vez. Se o banco estiver vazio (só com as tabelas), ele cria o síndico e o condomínio. Se já houver condomínio, ele substitui o estado e sobe a revisão em 1.

## Script

```sql
BEGIN;

-- 1) O síndico (dono do condomínio). Se já existe, não mexe.
INSERT INTO users ("openId", "name", "role")
VALUES ('sindico', 'Síndico', 'admin')
ON CONFLICT ("openId") DO NOTHING;

-- 2) O estado do condomínio. Se já existe, substitui e sobe a revisão em 1,
--    para uma aba aberta do síndico não gravar por cima sem recarregar.
INSERT INTO condo_states ("ownerId", "revision", "state")
SELECT u."id", 8, $estado${
  "name": "Condomínio San Gimignano",
  "openingBalanceCents": 313085,
  "openingDate": "2026-10-31",
  "openingReserveCents": 0,
  "tariffs": {
    "minimumWageCents": 162100,
    "feeBp": 2200,
    "maintenanceBp": 1500,
    "reserveBp": 2000,
    "adminCents": 2675,
    "waterPriceCents": 0,
    "gasPriceCents": 2363
  },
  "units": [
    {
      "id": "apto-101",
      "number": "101",
      "resident": "",
      "active": true,
      "exempt": true
    },
    {
      "id": "apto-102",
      "number": "102",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-201",
      "number": "201",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-202",
      "number": "202",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-301",
      "number": "301",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-302",
      "number": "302",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-401",
      "number": "401",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-402",
      "number": "402",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-501",
      "number": "501",
      "resident": "",
      "active": true,
      "exempt": false
    },
    {
      "id": "apto-502",
      "number": "502",
      "resident": "",
      "active": true,
      "exempt": false
    }
  ],
  "months": [
    {
      "id": "mes-1daf06cc-8c38-485f-8878-3c50cc88b1a8",
      "competence": "2026-10",
      "status": "open",
      "feeCents": 35662,
      "maintenanceBp": 1500,
      "reserveBp": 2000,
      "adminCents": 2675,
      "waterPriceCents": 467,
      "gasPriceCents": 2363,
      "readings": [
        {
          "unitId": "apto-101",
          "waterPrevious": 1448958,
          "waterCurrent": 1464165,
          "gasPrevious": 249548,
          "gasCurrent": 252600
        },
        {
          "unitId": "apto-102",
          "waterPrevious": 1231922,
          "waterCurrent": 1248368,
          "gasPrevious": 373332,
          "gasCurrent": 377559
        },
        {
          "unitId": "apto-201",
          "waterPrevious": 101224,
          "waterCurrent": 101224,
          "gasPrevious": 7307,
          "gasCurrent": 7307
        },
        {
          "unitId": "apto-202",
          "waterPrevious": 766050,
          "waterCurrent": 774353,
          "gasPrevious": 91444,
          "gasCurrent": 91891
        },
        {
          "unitId": "apto-301",
          "waterPrevious": 853519,
          "waterCurrent": 866352,
          "gasPrevious": 75104,
          "gasCurrent": 75747
        },
        {
          "unitId": "apto-302",
          "waterPrevious": 589268,
          "waterCurrent": 594955,
          "gasPrevious": 119413,
          "gasCurrent": 119741
        },
        {
          "unitId": "apto-401",
          "waterPrevious": 543634,
          "waterCurrent": 554281,
          "gasPrevious": 101025,
          "gasCurrent": 101567
        },
        {
          "unitId": "apto-402",
          "waterPrevious": 95894,
          "waterCurrent": 100506,
          "gasPrevious": 22436,
          "gasCurrent": 22931
        },
        {
          "unitId": "apto-501",
          "waterPrevious": 1099163,
          "waterCurrent": 1109434,
          "gasPrevious": 56043,
          "gasCurrent": 56106
        },
        {
          "unitId": "apto-502",
          "waterPrevious": 826113,
          "waterCurrent": 836097,
          "gasPrevious": 231180,
          "gasCurrent": 234667
        }
      ],
      "expenses": [
        {
          "id": "desp-33ac1456-bd25-49fa-a426-f949dc3a5f98",
          "description": "Copasa arrecadação aptos",
          "category": "Água",
          "amountCents": 43893,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-b4bedae1-1579-4ece-9059-d700a0b50d83",
          "description": "Copasa condomínio",
          "category": "Água",
          "amountCents": 5714,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-7f6ddf9a-8bb4-4da9-988e-17425407b563",
          "description": "Cemig",
          "category": "Outros",
          "amountCents": 36558,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-3b1a85bc-009c-4535-b6af-53fde859ae92",
          "description": "Serviço zeladoria",
          "category": "Limpeza",
          "amountCents": 162100,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-31db2287-e8e3-47b9-80c2-95b9f8b9411c",
          "description": "Volts elevadores",
          "category": "Manutenção",
          "amountCents": 26720,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-545ff7aa-ca19-4f83-91ce-4438945e8073",
          "description": "NetClaro",
          "category": "Outros",
          "amountCents": 13600,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-e6780f2a-2715-4382-8a29-7f9e90bdd1d5",
          "description": "Contabilidade",
          "category": "Administração",
          "amountCents": 14300,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-c4406dc1-48ca-451d-b586-f22827ba6b26",
          "description": "Taxa de adm do síndico",
          "category": "Administração",
          "amountCents": 24075,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-8c630f37-cb48-4ab1-b45f-da6e7c040a63",
          "description": "Leroy Merlin materiais e utensílios",
          "category": "Manutenção",
          "amountCents": 40135,
          "fromReserve": false,
          "paid": true,
          "paidOn": "2026-10-26"
        },
        {
          "id": "desp-80fa68aa-76a0-4873-b645-86c8ba82637f",
          "description": "Theodoro gás 2/2",
          "category": "Gás",
          "amountCents": 47500,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-046f397e-9d63-47e6-b443-6c4da46cc043",
          "description": "Villefort supermercado odorizador",
          "category": "Limpeza",
          "amountCents": 10580,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-f23b554e-0106-4c56-8c28-51b081e07953",
          "description": "Dular materiais cola",
          "category": "Manutenção",
          "amountCents": 1290,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-43b702f6-3f4a-4159-a3a5-0a29da030dad",
          "description": "Escada de 5 degraus",
          "category": "Manutenção",
          "amountCents": 26500,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        },
        {
          "id": "desp-fc914a8c-8098-4d08-b0a6-b44a549c072e",
          "description": "Nivaldo serralheiro conserto portão",
          "category": "Manutenção",
          "amountCents": 40000,
          "fromReserve": false,
          "paid": true,
          "paidOn": "2026-10-01"
        },
        {
          "id": "desp-3128d484-b08f-4639-9062-5c1b9c0b7301",
          "description": "AC Paisagismo e jardinagem",
          "category": "Manutenção",
          "amountCents": 21250,
          "fromReserve": false,
          "paid": false,
          "paidOn": null
        }
      ],
      "payments": [
        {
          "unitId": "apto-101",
          "amountCents": 62446
        },
        {
          "unitId": "apto-202",
          "amountCents": 55752
        },
        {
          "unitId": "apto-302",
          "amountCents": 54250
        },
        {
          "unitId": "apto-401",
          "amountCents": 57072
        },
        {
          "unitId": "apto-402",
          "amountCents": 54142
        },
        {
          "unitId": "apto-501",
          "amountCents": 55764
        },
        {
          "unitId": "apto-502",
          "amountCents": 63721
        },
        {
          "unitId": "apto-301",
          "amountCents": 58331
        }
      ],
      "extraCharges": [
        {
          "id": "avulso-59fb1f21-55d2-4d69-85e7-f59b84b67272",
          "unitId": "apto-101",
          "description": "Reembolso fundo reserva",
          "amountCents": 41000
        }
      ],
      "bankBalanceCents": null
    }
  ]
}$estado$::jsonb
FROM users u
WHERE u."openId" = 'sindico'
ON CONFLICT ("ownerId") DO UPDATE
SET "state" = EXCLUDED."state",
    "revision" = condo_states."revision" + 1,
    "updatedAt" = now();

COMMIT;
```

## Conferência

Depois de rodar, execute:

```sql
SELECT revision,
       state->>'name' AS nome,
       jsonb_array_length(state->'units') AS apartamentos,
       state->>'openingDate' AS data_do_saldo,
       jsonb_array_length(state->'months') AS meses,
       jsonb_array_length(state->'months'->0->'expenses') AS despesas,
       jsonb_array_length(state->'months'->0->'payments') AS pagamentos
FROM condo_states;
```

Valores esperados: nome `Condomínio San Gimignano`, 10 apartamentos, data do saldo `2026-10-31`, 1 mês, 15 despesas e 8 pagamentos. A revisão será 8 se o banco estava vazio, ou a revisão que ele tinha mais 1.

## Como tirar um backup novo

1. No SQL Editor, rode `SELECT revision, state FROM condo_states;`.
2. Copie o valor de `state` e a `revision`.
3. No script acima, troque o número depois de `SELECT u."id",` pela revisão e o JSON entre `$estado$` e `$estado$` pelo novo estado.

## Como este script foi testado

Foi rodado em três bancos Postgres 16 de teste: um banco já com o condomínio, o mesmo banco uma segunda vez, e um banco novo só com as tabelas. Nos três o estado ficou igual ao deste arquivo, sem duplicar o síndico, e o quadro público do banco restaurado ficou idêntico ao da produção.

## Privacidade

O estado inclui **quais apartamentos pagaram a cota**, que o quadro público de propósito não mostra. Guarde este arquivo em lugar privado.
