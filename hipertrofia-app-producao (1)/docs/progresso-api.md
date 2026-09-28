# Progresso corporal

Todas as rotas exigem `Authorization: Bearer <accessToken>`. O backend usa o subject autenticado como owner; não recebe `userId` do app.

## Histórico de peso

`GET /api/v1/progress/body-weight?limit=30`

- `limit` opcional: 1 a 90, padrão 30.
- Responde com até N registros do usuário, em ordem cronológica crescente para desenhar a tendência.

```json
{
  "entries": [
    {
      "id": "uuid",
      "weightKg": 78.4,
      "measuredAt": "2026-09-27T15:00:00.000Z",
      "notes": null,
      "createdAt": "2026-09-27T15:00:01.000Z"
    }
  ],
  "limit": 30
}
```

## Registrar pesagem

`POST /api/v1/progress/body-weight`

```json
{ "weightKg": 78.4, "measuredAt": "2026-09-27T15:00:00.000Z", "notes": "Ao acordar" }
```

`weightKg` é obrigatório e aceita 20–500 kg. `measuredAt` e `notes` são opcionais; se a data for omitida, o servidor usa o horário corrente. Responde `201` com `{ "entry": { ... } }`.

A migration `20260927125500_body_weight_entries` adiciona `body_weight_entries`, com chave estrangeira para usuários e índice composto por usuário/data. Para banco vazio, use `npx prisma migrate dev`; em banco já existente/fechado por baseline, faça o procedimento de baseline antes de aplicar esta migration.
