# Frontend — Expo React Native

App móvel em Expo + TypeScript, com Login/Registro e rastreamento alimentar por foto ou texto usando a API Gemini do backend.

## Executar

```bash
cd frontend
cp .env.example .env
npm install
npx expo start
```

Para rodar o preview web, use `npx expo start --web`.

Defina `EXPO_PUBLIC_API_URL` conforme o ambiente: simulador iOS usa `http://localhost:3333`, emulador Android usa `http://10.0.2.2:3333`; em dispositivo físico, configure o IP local do computador. O backend deve estar ativo e acessível pela rede.

## Fluxo atual

A tela alterna entre Login e Registro, valida os campos, mostra mensagens de erro/carregamento e chama `POST /api/v1/auth/login` ou `/register`. O access token é salvo com `expo-secure-store` em iOS e Android. No browser, fica somente em memória, sem ser gravado no `localStorage`. Na inicialização, o app tenta restaurar a sessão via `GET /api/v1/auth/me`; no logout, apaga o token.

Após autenticar, o Dashboard é a tela inicial. O resumo calórico e os macros usam `GET /api/v1/nutrition/history` para o dia e fuso local e comparam com as metas existentes no perfil. O gráfico usa somente medições persistidas em `GET /api/v1/progress/body-weight`; registre uma pesagem em quilogramas no próprio painel. Quando não há registros, o gráfico fica em estado vazio (sem valores de exemplo).

Depois de autenticar, toque em **Registrar uma refeição** para abrir a tela alimentar. Ela recebe texto livre ou uma imagem da câmera/galeria; quando há imagem, envia `multipart/form-data` com o campo `image`, opcionalmente `description`, e o Bearer JWT a `POST /api/v1/nutrition/analyze`. Sem imagem, envia JSON `{ "description": "..." }`. Depois da resposta validada da IA, o backend persiste a refeição e devolve o registro criado. A tela atualiza `GET /api/v1/nutrition/history` com a data e o fuso do dispositivo e mostra totais de calorias/macros e refeições do dia. O app não envia credenciais Gemini; a chave fica no backend.

Para testes físicos sem chamada ao Gemini, o backend suporta uma fixture determinística habilitada apenas com `NODE_ENV=test`, `NUTRITION_AI_MODE=mock` e banco cujo nome contenha `test` ou `e2e`. O resultado é identificado como simulado no app e na descrição salva. Veja [../docs/teste-e2e-dispositivo.md](../docs/teste-e2e-dispositivo.md); a estimativa fixa não deve ser usada como informação nutricional real.

O atalho **Gestão de treinos e séries** permite criar fichas/divisões, adicionar exercícios do catálogo (ou cadastrar um exercício novo), iniciar/finalizar uma sessão, registrar séries com carga, repetições e descanso, marcar séries concluídas e consultar a progressão de carga por exercício. Todas as chamadas usam a sessão Bearer JWT e os endpoints descritos em `docs/treinos-api.md`.

No cabeçalho do Dashboard, **Lembretes** permite habilitar horários diários para café da manhã, almoço e jantar, além de escolher dias e horário semanal de treino. O app agenda notificações locais no sistema iOS/Android; as preferências ficam apenas no dispositivo, sem backend, token push ou conexão após configurar. O sistema pode ajustar o momento exato de entrega conforme seus modos de foco/economia de bateria. O preview Web apenas informa que o recurso exige o app nativo; teste em um dispositivo/simulador pelo Expo Go, ou recompile seu development/production build próprio após a inclusão do plugin.

Para executar em um banco vazio, crie o banco PostgreSQL e aplique a migração inicial versionada com `cd backend && npx prisma migrate dev`. Se já havia tabelas criadas manualmente ou banco usado anteriormente, faça baseline da migration em vez de tentar recriar a estrutura.

Arquivos principais: `App.tsx`, `src/screens/DashboardScreen.tsx`, `src/screens/RemindersScreen.tsx`, `src/screens/NutritionScreen.tsx`, `src/screens/WorkoutsScreen.tsx`, `src/services/reminders.ts`, `src/services/progress.ts`, `src/services/nutrition.ts`, `src/services/workouts.ts`, `src/services/api.ts`, `src/services/auth.ts` e `src/services/token-storage.ts`.
