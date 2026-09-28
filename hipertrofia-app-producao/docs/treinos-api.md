# API de treinos e progressão de carga

Prefixo: `/api/v1`. Os corpos e respostas são JSON, exceto quando o status for `204 No Content`.

## Autorização

Todas as rotas deste documento exigem `Authorization: Bearer <accessToken>`. O usuário dono dos dados é derivado do subject validado pelo middleware JWT; não há `userId` nas URLs. Para cadastro/login e demais detalhes, veja [autenticacao.md](autenticacao.md).

## Catálogo de exercícios

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/exercises?search=agachamento&muscleGroup=quadríceps&limit=30&offset=0` | Lista e filtra exercícios |
| `POST` | `/exercises` | Cria exercício |
| `PATCH` | `/exercises/:exerciseId` | Atualiza campos do exercício |
| `DELETE` | `/exercises/:exerciseId` | Exclui; retorna `409` se estiver associado a algum treino |

Exemplo de criação:

```json
{
  "name": "Agachamento livre",
  "muscleGroup": "Quadríceps",
  "instructions": "Manter a coluna neutra durante a execução."
}
```

## Treinos

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/workouts?status=scheduled&from=2026-09-01T00:00:00Z&to=2026-09-30T23:59:59Z&limit=20&offset=0` | Lista treinos do usuário com exercícios e séries |
| `POST` | `/workouts` | Cria treino |
| `GET` | `/workouts/:workoutId` | Busca detalhe de um treino do usuário |
| `PATCH` | `/workouts/:workoutId` | Atualiza nome, divisão, agendamento ou notas |
| `DELETE` | `/workouts/:workoutId` | Exclui treino e seus itens/séries associados |
| `POST` | `/workouts/:workoutId/start` | Marca início do treino |
| `POST` | `/workouts/:workoutId/finish` | Finaliza um treino iniciado |

`status` aceita `scheduled`, `in_progress` ou `completed`. Para criar:

```json
{
  "name": "Treino A — Peito e tríceps",
  "split": "ABCDE",
  "scheduledAt": "2026-09-28T18:00:00-03:00",
  "notes": "Foco em progressão no supino."
}
```

O treino é associado automaticamente ao usuário autenticado. Agendamento e divisão são opcionais.

## Exercícios dentro de um treino

| Método | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/workouts/:workoutId/exercises` | Adiciona um exercício do catálogo ao treino |
| `PATCH` | `/workouts/:workoutId/exercises/:workoutExerciseId` | Altera posição ou notas |
| `DELETE` | `/workouts/:workoutId/exercises/:workoutExerciseId` | Remove exercício e séries desse treino |

Exemplo:

```json
{
  "exerciseId": "UUID-do-exercicio-do-catalogo",
  "order": 1,
  "notes": "Aumentar a carga se completar todas as repetições."
}
```

Se `order` não for informado, a API usa a quantidade de exercícios atual no treino. Cada posição é única dentro do treino.

## Séries e carga

| Método | Endpoint | Uso |
| --- | --- | --- |
| `POST` | `/workouts/:workoutId/exercises/:workoutExerciseId/sets` | Registra uma série |
| `PATCH` | `/workouts/:workoutId/exercises/:workoutExerciseId/sets/:setId` | Atualiza carga, repetições, descanso ou conclusão |
| `DELETE` | `/workouts/:workoutId/exercises/:workoutExerciseId/sets/:setId` | Exclui a série |

Exemplo de série planejada ou realizada:

```json
{
  "setNumber": 1,
  "repetitions": 8,
  "weightKg": 60,
  "restSeconds": 120,
  "completed": true
}
```

`weightKg`, `repetitions` e `restSeconds` aceitam `null` para registrar uma série sem dado medido. `completed` começa como `false` por padrão. O par `(workoutExerciseId, setNumber)` é único.

## Progressão de carga

`GET /progression/exercises/:exerciseId?limit=20`

Retorna sessões concluídas do usuário para aquele exercício. Cada sessão informa carga máxima, número de repetições, quantidade de séries e volume total (`Σ carga em kg × repetições`) das séries marcadas como concluídas. O resumo compara a carga máxima das duas sessões mais recentes e inclui diferença em kg e percentual, quando calculável.

Exemplo resumido:

```json
{
  "exercise": {
    "id": "UUID",
    "name": "Supino reto",
    "muscleGroup": "Peito"
  },
  "sessions": [
    {
      "workoutId": "UUID",
      "workoutName": "Treino A",
      "setCount": 3,
      "totalRepetitions": 24,
      "maxWeightKg": 60,
      "totalVolumeKg": 1440
    }
  ],
  "progression": {
    "comparedSessions": 1,
    "previousMaxWeightKg": null,
    "latestMaxWeightKg": 60,
    "deltaKg": null,
    "percentChange": null
  }
}
```

As sessões são retornadas em ordem cronológica crescente. A sessão mais recente é usada como `latestMaxWeightKg`.

## Validação e erros

- `401`: Bearer ausente/inválido/expirado; obtenha um token em `/api/v1/auth/login`.
- `400`: UUID, query ou payload inválido; campos desconhecidos também são rejeitados.
- `404`: usuário, treino, exercício ou série inexistente no escopo indicado.
- `409`: estado inválido do ciclo (por exemplo finalizar antes de iniciar), posição/número de série duplicado ou conflito de integridade.
- `429`: limite de tentativas das rotas de autenticação excedido.
- `204`: remoção bem-sucedida sem corpo.
- `500`: erro não previsto; detalhes internos não são enviados ao cliente.

Paginação aceita `limit` de 1 a 100 e `offset` até 100.000.
