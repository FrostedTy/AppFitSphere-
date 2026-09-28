# Notas arquiteturais

- **API versionada:** rotas em `/api/v1`, facilitando evoluir os contratos sem quebrar o app mobile.
- **Autenticação:** access JWT HS256 com expiração curta, segredo obrigatório de no mínimo 32 caracteres, claim de subject e issuer validado pelo middleware. O ID do usuário dos controladores é obtido de `req.auth.userId`, não do payload da rota.
- **Senhas:** hashes bcrypt com custo 12; cadastro/login são limitados por IP para reduzir abuso.
- **Rotas públicas:** somente health check, cadastro e login. Perfil, nutrição, peso corporal, catálogo de exercícios, treinos e progressão exigem Bearer token.
- **IA multimodal:** análise nutricional recebe texto ou imagem; Gemini recebe JSON Schema e a resposta é validada com Zod.
- **Mock E2E da IA:** fixture nutricional determinística só inicia com `NODE_ENV=test` e nome de banco contendo `test` ou `e2e`; a resposta e a descrição são identificadas como simuladas. O padrão permanece Gemini.
- **Privacidade da imagem:** upload em memória e chamada ao Gemini com `store: false`; imagem não é gravada pelo backend.
- **Banco de dados:** `WorkoutExercise` resolve a relação N:N entre treinos e exercícios; `WorkoutSet` armazena peso, repetições, descanso e conclusão para análise de progressão.
- **Progressão:** histórico considera somente séries concluídas em treinos finalizados; volume é calculado como carga em kg multiplicada por repetições.
- **Dashboard:** macros do dia vêm do histórico de refeições e metas do usuário; evolução de peso vem de `BodyWeightEntry`, sempre filtrada pelo subject JWT. Sem medições, a UI informa estado vazio em vez de desenhar valores simulados.
- **Lembretes:** `expo-notifications` agenda no próprio dispositivo lembretes diários de refeições e semanais de treinos; preferências são locais em AsyncStorage. Não há token push, envio remoto ou worker backend. O app pede permissão apenas ao salvar pelo menos um lembrete habilitado.
- **Sessões JWT:** esta primeira versão não tem refresh token nem revogação server-side; tokens são descartados pelo cliente no logout e expiram pelo TTL.
- **Validação:** payloads desconhecidos são rejeitados, limites de paginação são aplicados e constraints Prisma são traduzidas para respostas HTTP previsíveis.
