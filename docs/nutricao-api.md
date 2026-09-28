# Nutrição: persistência e histórico diário

Todos os endpoints exigem `Authorization: Bearer <accessToken>`; o usuário é obtido exclusivamente de `req.auth.userId`.

## Analisar e salvar uma refeição

`POST /api/v1/nutrition/analyze`

- Texto: `application/json` com `{ "description": "200 g de frango e 150 g de arroz" }`.
- Foto: `multipart/form-data`, campo `image` e campo `description` opcional.
- A imagem é mantida em memória para a chamada Gemini e nunca é gravada na coluna `image_uri`.
- Só após a resposta Gemini ser validada contra o schema de macros, o backend cria uma linha em `meals` com `user_id`, origem (`TEXT` ou `IMAGE`), descrição, macros e timestamps.

Resposta `201 Created` — objeto da refeição persistida:

```json
{
  "id": "uuid",
  "source": "TEXT",
  "description": "200 g de frango e 150 g de arroz",
  "calories": 560,
  "proteinGrams": 54.2,
  "carbohydratesGrams": 48,
  "fatGrams": 13.1,
  "consumedAt": "2026-09-27T15:30:00.000Z",
  "createdAt": "2026-09-27T15:30:00.000Z"
}
```

Erros da Gemini ou validação acontecem antes da escrita; falha no banco retorna erro e não afirma que a refeição foi salva.

## Histórico de um dia

`GET /api/v1/nutrition/history?date=YYYY-MM-DD&timeZone=America/Sao_Paulo`

Os dois parâmetros são opcionais. Sem `date`, usa o dia atual no fuso informado. Sem `timeZone`, usa UTC. `timeZone` deve ser um identificador IANA válido. O backend converte os limites da meia-noite local para UTC (início inclusivo/fim exclusivo), então dias com mudança de horário são delimitados corretamente.

```json
{
  "date": "2026-09-27",
  "timeZone": "America/Sao_Paulo",
  "summary": {
    "mealCount": 1,
    "calories": 560,
    "proteinGrams": 54.2,
    "carbohydratesGrams": 48,
    "fatGrams": 13.1
  },
  "meals": []
}
```

O resultado contém somente refeições do usuário autenticado e do dia solicitado, em ordem decrescente de consumo. Macros Decimal são serializados como números JSON.

## Frontend

A tela salva e exibe a refeição retornada pelo POST, atualiza o resumo diário e lista registros por horário. Navegar entre datas chama novamente o endpoint de histórico. O app envia o fuso do dispositivo; ele não inventa metas nutricionais ou dados de refeições.

O modelo `Meal` já consta no `schema.prisma`. A migração inicial versionada `20260927123000_init` cria `meals` e as demais tabelas do starter. Em banco novo, aplique-a conforme o README raiz (`npx prisma migrate dev`). Em banco existente com tabelas já criadas fora das migrations, não reaplique a migração inicial sem antes fazer baseline/verificar o estado, para evitar tentativa de recriar tabelas.
