# Autenticação JWT

A autenticação usa access tokens JWT assinados com HS256, duração padrão de 15 minutos e segredo configurado apenas no backend. As senhas são armazenadas como hash bcrypt (custo 12), nunca em texto puro. Cadastro e login têm limite de 10 tentativas por IP em 15 minutos.

## Configuração

Crie o segredo uma vez e mantenha-o apenas no arquivo `.env` do servidor:

```bash
openssl rand -base64 48
```

Configure:

```dotenv
JWT_SECRET=valor_aleatorio_com_pelo_menos_32_caracteres
JWT_ACCESS_TOKEN_TTL=15m
```

Em produção, prefira um secret manager/variável protegida de ambiente. Não versione `.env`, não inclua o segredo no app mobile e não registre tokens nos logs. A variável é obrigatória; o servidor não inicia com configuração ausente ou fraca.

## Rotas

Prefixo: `/api/v1/auth`.

| Método | Endpoint | Acesso | Resultado |
| --- | --- | --- | --- |
| `POST` | `/register` | Público, limitado por IP | Cria usuário e devolve token |
| `POST` | `/login` | Público, limitado por IP | Verifica credenciais e devolve token |
| `GET` | `/me` | JWT obrigatório | Devolve perfil do token atual |

Cadastro:

```json
{
  "name": "Ana Silva",
  "email": "ana@example.com",
  "password": "uma-senha-forte"
}
```

Login:

```json
{
  "email": "ana@example.com",
  "password": "uma-senha-forte"
}
```

Cadastro exige senha de pelo menos 8 caracteres e aceita no máximo 72 bytes UTF-8, limite do bcrypt. E-mails são normalizados para minúsculas. Campos extras são rejeitados.

Resposta de cadastro/login (`201` para cadastro, `200` para login):

```json
{
  "user": {
    "id": "UUID",
    "name": "Ana Silva",
    "email": "ana@example.com",
    "calorieGoal": null,
    "proteinGoalG": null,
    "carbohydrateGoalG": null,
    "fatGoalG": null,
    "createdAt": "2026-09-27T14:00:00.000Z"
  },
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

`passwordHash` não é incluído em nenhuma resposta. Se o e-mail já estiver cadastrado, o cadastro retorna `409`. Login responde com uma mensagem genérica para e-mail inexistente ou senha incorreta.

## Proteger chamadas

Inclua o token retornado no cabeçalho de toda chamada às APIs de nutrição, exercícios, treinos e progressão:

```http
Authorization: Bearer <accessToken>
```

Exemplo:

```bash
curl http://localhost:3333/api/v1/workouts \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN'
```

Exemplo de perfil atual:

```bash
curl http://localhost:3333/api/v1/auth/me \
  -H 'Authorization: Bearer SEU_ACCESS_TOKEN'
```

As rotas de treino foram migradas para não receber `userId` na URL. Os controladores usam `req.auth.userId`, preenchido exclusivamente após a verificação criptográfica do JWT, e filtram os dados no banco pelo dono autenticado.

## Erros de autenticação

- `400`: payload inválido ou campos extras.
- `401`: bearer ausente, assinatura inválida, token expirado, credenciais inválidas ou conta inexistente.
- `409`: e-mail já cadastrado.
- `429`: limite de tentativas excedido.

## Escopo e melhorias futuras

Esta primeira versão implementa access token stateless; não há refresh token nem blacklist de revogação. Logout no cliente significa descartar o token, que continua válido até sua expiração. Para sessões revogáveis/multidispositivo, adicione refresh tokens rotativos com armazenamento seguro e uma política explícita de revogação. A camada de rate limit usa armazenamento em memória; em múltiplas instâncias, configure um store compartilhado.
