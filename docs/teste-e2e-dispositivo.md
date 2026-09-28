# E2E em dispositivo físico: nutrição simulada e treinos

Este roteiro percorre o app Expo no celular, a API Express, PostgreSQL e a persistência JWT. A análise nutricional pode usar uma fixture determinística, sem chamar o Gemini.

> **Segurança:** use somente uma base de teste descartável e uma conta fictícia. O modo `NUTRITION_AI_MODE=mock` só é aceito com `NODE_ENV=test`; o servidor encerra a inicialização se a combinação for diferente. A fixture registra `[E2E MOCK]` na descrição e retorna `analysisMode: "mock"` com macros fixos. Não use esses dados como estimativa alimentar real.

Baixe/extraia o ZIP do projeto no **computador que está na mesma rede do celular** e rode os comandos abaixo nessa máquina. Um sandbox remoto não compartilha automaticamente o Wi-Fi doméstico: se executar a API num ambiente remoto, o celular precisa de uma URL de teste acessível por HTTPS e deve-se evitar expor dados pessoais.

## 1. Preparar a rede e o ambiente

- Instale PostgreSQL, Node.js 20+ e Expo Go no celular, ou use um development build.
- Conecte computador e celular à mesma rede Wi-Fi. Descubra o IPv4 local do computador (`ip addr` no Linux, `ipconfig` no Windows ou `ifconfig` no macOS); nos exemplos abaixo, substitua `192.168.1.25` pelo endereço real.
- Não publique a porta do backend na internet. O processo escuta em `0.0.0.0:3333` para aceitar conexões na rede local; permita essa porta apenas na rede de teste/firewall.
- Crie um banco de dados dedicado, vazio e descartável, por exemplo `hipertrofia_app_e2e`. Evite apontar `DATABASE_URL` para desenvolvimento compartilhado ou produção.

## 2. Configurar o backend em modo E2E

No terminal do computador:

```bash
cd hipertrofia-app/backend
cp .env.example .env  # só se ainda não existir; não sobrescreva seu arquivo local
```

Edite `backend/.env` para usar o banco descartável e configure:

```dotenv
NODE_ENV=test
PORT=3333
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/hipertrofia_app_e2e?schema=public
GEMINI_API_KEY=mock-not-used-in-e2e
NUTRITION_AI_MODE=mock
JWT_SECRET=SEGREDO_ALEATORIO_COM_NO_MINIMO_32_CARACTERES
JWT_ACCESS_TOKEN_TTL=2h
CORS_ORIGIN=*
```

A chave Gemini é validada como não vazia na inicialização, mas **não é utilizada no modo mock**. Gere o JWT secret com `openssl rand -base64 48`; mantenha o resultado apenas no `.env` local e não o cole em issue, chat ou frontend. `CORS_ORIGIN=*` serve apenas para desenvolvimento local; não é uma configuração de produção.

Aplique a migration e inicie o servidor:

```bash
npx prisma migrate dev
npm run dev
```

Em outro terminal, verifique a API:

```bash
curl http://localhost:3333/health
```

A resposta esperada contém `"status":"ok"`. O modo mock não cria refeições automaticamente: ele só responde às requisições autenticadas do fluxo do app.

## 3. Apontar o Expo para o computador

No terminal do frontend:

```bash
cd hipertrofia-app/frontend
```

Crie `frontend/.env` se ele ainda não existir, sem sobrescrever configurações locais; configure o IP LAN, por exemplo:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.25:3333
```

Essa URL precisa usar o IPv4 do computador, não `localhost` nem `10.0.2.2` (este último é para emulador Android). Antes de abrir o app, teste no navegador do próprio celular `http://192.168.1.25:3333/health`. Se não abrir, confira Wi-Fi, firewall, VPN/isolamento entre clientes e o IP.

Inicie o Metro:

```bash
npx expo start --clear
```

Leia o QR code com Expo Go ou abra o development build. O celular e o computador precisam permanecer na mesma rede; não habilite túnel para uma API com dados pessoais. Depois de alterar `EXPO_PUBLIC_API_URL`, reinicie o Metro com `--clear`.

## 4. Percorrer o rastreamento alimentar

1. No app, crie uma conta fictícia com email de teste.
2. Entre no Dashboard e toque em **Registrar uma refeição**.
3. Digite, por exemplo, `200 g de peito de frango e 150 g de arroz branco`, depois **Analisar refeição**.
4. Confirme que o resultado mostra o selo **MODO SIMULADO — E2E**, `520 kcal`, `45 g` de proteína, `65 g` de carboidratos e `12 g` de gordura.
5. Confira em **Seu dia** que a refeição aparece no histórico. O backend salva o registro com origem `TEXT` e descrição iniciada por `[E2E MOCK]`.
6. Repita pelo fluxo de **Escolher foto** ou **Tirar foto**; uma imagem pequena/sem dados pessoais basta. O mock não envia a imagem ao Gemini. Confirme o selo e que o histórico indica `FOTO`/origem `IMAGE`.

A fixture devolve os mesmos macros para todos os textos e fotos: este teste valida câmera/galeria, multipart, JWT, API e persistência, **não** a qualidade de visão computacional ou NLP.

## 5. Percorrer gestão de treinos e séries

1. Volte ao Dashboard e toque em **Gestão de treinos e séries**.
2. Toque **Novo treino**, informe `Treino E2E A — Peito` e divisão `ABCDE`, e crie a ficha.
3. Abra a ficha; toque para abrir o catálogo e crie/adicionar, por exemplo, `Supino reto E2E`, grupo muscular `Peito`.
4. Toque **Iniciar sessão de treino**.
5. Na seção do exercício, preencha carga `40`, repetições `10` e descanso `90`; toque **Registrar série**. Marque o checkbox da série como concluída.
6. Toque **Finalizar treino**. Reabra/atualize a ficha e confira que o treino consta como concluído e a série continua registrada.
7. Para testar comparação de progressão, crie um segundo treino com o mesmo exercício de catálogo, complete uma série em `42,5 kg` × `8`, finalize e toque **Ver progressão de carga**. O histórico deve exibir as duas sessões e a variação entre cargas máximas. A progressão considera séries concluídas em sessões finalizadas.

## 6. Conferir diretamente o banco (opcional)

Em outro terminal, ainda na pasta `backend`:

```bash
npx prisma studio
```

Confira `meals`, `workouts`, `workout_exercises` e `workout_sets`, filtrando pelo usuário criado para E2E. Feche o app/servidor e descarte ou limpe o banco quando terminar. Não rode limpeza em banco compartilhado.

## 7. Testar a integração real com Gemini

Depois de concluir o fluxo mockado, para validar a conexão real, altere somente o ambiente do backend para `NODE_ENV=development`, `NUTRITION_AI_MODE=gemini` e uma chave válida de Google AI Studio. Reinicie o backend e use uma refeição de teste. A chamada real pode consumir quota/cobrança da API e seus dados de refeição serão enviados ao Gemini para análise; não use fotos de pessoas ou informações sensíveis. O mock E2E deve voltar a ser desativado (modo `gemini`) antes de qualquer ambiente que não seja teste.

## Resultado esperado

- Login/cadastro pelo dispositivo e chamadas autenticadas sem erros de rede.
- Refeição `TEXT` e `IMAGE` gravadas no histórico diário no banco de teste.
- Fichas, exercícios, séries e conclusão de sessão persistidos sob o usuário autenticado.
- Progressão calculada a partir das sessões finalizadas.
- Badge mock visível somente na resposta simulada; nenhuma chamada Gemini durante o modo E2E.
