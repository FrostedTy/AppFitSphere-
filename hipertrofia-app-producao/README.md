# Hipertrofia App — starter kit

Starter kit do aplicativo mobile de saúde, academia e alimentação, com frontend e backend separados.

## Arquitetura de pastas

```text
hipertrofia-app/
├── backend/
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   └── src/
│       ├── config/env.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── body-weight.controller.js
│       │   ├── nutrition.controller.js
│       │   └── workouts.controller.js
│       ├── lib/                 # HTTP, JWT, senha e Prisma
│       ├── middleware/require-auth.js
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── nutrition.routes.js
│       │   ├── progress.routes.js
│       │   └── workouts.routes.js
│       ├── app.js
│       └── server.js
├── frontend/
│   ├── App.tsx                  # Login, Registro e navegação autenticada
│   └── src/
│       ├── screens/             # Dashboard, nutrição, treinos e lembretes
│       ├── services/            # API, autenticação, progresso, nutrição, treinos e lembretes
│       ├── types/               # Contratos de autenticação, progresso, nutrição, treinos e lembretes
│       └── utils/               # Preferências e validação de lembretes
└── docs/
    ├── arquitetura.md
    ├── autenticacao.md
    ├── entrega-inicial.md
    ├── treinos-api.md
    ├── nutricao-api.md
    └── progresso-api.md
```

## Pré-requisitos e instalação

- Node.js 20+
- PostgreSQL 14+
- Uma chave da API Gemini no Google AI Studio

```bash
cd backend
cp .env.example .env
# configure DATABASE_URL, GEMINI_API_KEY e JWT_SECRET
openssl rand -base64 48
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Copie a saída de `openssl rand -base64 48` para `JWT_SECRET` em `backend/.env`. Não reutilize o valor do exemplo, não o envie ao frontend e nunca versione o arquivo `.env`.

Health check público: `GET http://localhost:3333/health`.

## Autenticação e APIs protegidas

Cadastro e login ficam em `/api/v1/auth/register` e `/api/v1/auth/login`. Ambos retornam um access token JWT com expiração curta; use `Authorization: Bearer <accessToken>` nas demais rotas. O perfil autenticado está em `/api/v1/auth/me`. Senhas são protegidas com bcrypt e endpoints de autenticação têm rate limit. Ver [docs/autenticacao.md](docs/autenticacao.md) para payloads e exemplos.

A API de treinos inclui catálogo de exercícios, CRUD de treinos, início/finalização de sessão, registro de séries e consulta de progressão. Os endpoints usam o usuário autenticado, sem confiar em `userId` fornecido pelo cliente. Veja [docs/treinos-api.md](docs/treinos-api.md).

Análise nutricional por texto ou imagem em `POST /api/v1/nutrition/analyze` exige Bearer JWT. Após validar a resposta do Gemini, o backend salva macros, origem e descrição na tabela `meals`, vinculada ao usuário do JWT. `GET /api/v1/nutrition/history` retorna refeições e totais do dia no fuso solicitado. A imagem é processada em memória e não é persistida; a chave Gemini permanece exclusivamente no backend. Veja [docs/nutricao-api.md](docs/nutricao-api.md).

O frontend Expo inclui Login/Registro com sessão JWT, rastreamento alimentar por texto ou câmera/galeria e Gestão de Treinos. A tela de treinos cria fichas e exercícios, registra carga/repetições/descanso, marca séries concluídas e mostra a progressão de carga. Veja [frontend/README.md](frontend/README.md) para configuração e execução; para executar o fluxo completo num aparelho com IA simulada, siga [docs/teste-e2e-dispositivo.md](docs/teste-e2e-dispositivo.md).

O Dashboard resume o consumo do dia com calorias e macros versus as metas da conta, e exibe a evolução de peso a partir de medições reais registradas em `/api/v1/progress/body-weight`. O formulário de pesagem salva os dados no perfil autenticado; o app não inventa valores quando o histórico está vazio. Veja [docs/progresso-api.md](docs/progresso-api.md).

O atalho **Lembretes** configura notificações locais para horários de refeições e dias/horário de treino. O agendamento acontece no próprio iOS/Android e as preferências são mantidas no dispositivo; esta implementação não coleta tokens, não envia push remoto e não adiciona serviço ou worker ao backend. Horários podem sofrer ajustes do sistema, e o preview Web não dispara esses lembretes. Veja [frontend/README.md](frontend/README.md).

Para iniciar o app mobile, configure `frontend/.env` copiando `frontend/.env.example`, depois execute `cd frontend && npm install && npx expo start`.

## Publicação e builds Android

O backend inclui Docker e Blueprints Render de produção e demonstração; a configuração Expo contém perfis EAS para development, APK de preview e AAB de produção. Consulte o guia com os passos de PostgreSQL gerenciado, Render, variáveis EAS, instalação APK e preparação de AAB em [docs/deploy-producao.md](docs/deploy-producao.md). O build EAS requer conta Expo autenticada e a URL HTTPS pública da API; o AAB, por si só, não publica o app na Play Store.

Para testar no dispositivo físico o fluxo alimentar com fixture determinística e as séries de treino, consulte [docs/teste-e2e-dispositivo.md](docs/teste-e2e-dispositivo.md). O mock nutricional é limitado a `NODE_ENV=test` e a um banco cujo nome contenha `test` ou `e2e`.

## Limites desta iteração

O servidor usa access tokens stateless; logout descarta o token no cliente, que permanece válido até a expiração. Não há refresh token/blacklist. O rate limit padrão usa memória local, portanto deve receber um store compartilhado antes de executar várias instâncias. O acompanhamento de hidratação, medidas corporais adicionais e edição de metas fica para uma próxima etapa.
