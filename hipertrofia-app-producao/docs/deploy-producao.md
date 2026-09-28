# Implantação de produção — Hipertrofia

Guia para publicar o backend Express/Prisma no Render, usar PostgreSQL gerenciado e gerar um APK Android instalável ou um AAB para a Play Store. O projeto usa `backend/` e `frontend/` como diretórios independentes.

> **Fluxo recomendado:** Neon (PostgreSQL) → Render (API HTTPS) → Expo EAS Build (APK/AAB). Para uso real, escolha um plano de banco/API que atenda disponibilidade, limites, backups e tráfego esperados. Os planos gratuitos são para testes e têm suspensões/limites.

## 0. O que está pronto no repositório

- `render.yaml`: serviço Render de produção, Docker, health check e migrações no pre-deploy. O Blueprint seleciona o plano `starter` (pago) porque o Render exige serviço pago para `preDeployCommand`.
- `render-free.yaml`: alternativa de demonstração; aplica as migrações durante o build porque o Render Free não oferece pre-deploy.
- `backend/Dockerfile`: imagem Node 22 enxuta, cliente Prisma gerado no build e processo de runtime sem root.
- `backend/prisma/schema.prisma`: Prisma 6 usa `DATABASE_URL` para a conexão da aplicação e `DIRECT_URL` para CLI/migrações.
- `frontend/eas.json`: `development` e `preview` geram APK interno; `production` gera AAB e incrementa o version code remotamente.
- App ID Android: `com.gabriel.hipertrofiaapp`. Não altere depois de publicar a primeira versão sem planejar uma nova aplicação na Play Store.

## A. Criar o PostgreSQL gratuito no Neon

1. Acesse [Neon Console](https://console.neon.tech/) e crie uma conta/projeto PostgreSQL. Escolha uma região próxima do Render que pretende usar; latência entre regiões aumenta o tempo de cada consulta.
2. Abra o projeto e clique em **Connect**. Selecione branch, database e role. Ative o seletor de connection pooling e copie a URL apresentada. Esta é a conexão **pooled**, cujo hostname inclui `-pooler`.
3. Desative o pooling no mesmo diálogo e copie também a conexão **direct**, cujo hostname não inclui `-pooler`.
4. Guarde as duas URLs em um gerenciador seguro. Não as coloque no código, no frontend ou em commits.

No Render, configure:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL Neon pooled, hostname contendo `-pooler` |
| `DIRECT_URL` | URL Neon direct, hostname sem `-pooler` |

O Neon usa connection pooling em modo transacional; use a URL direct para migrations/CLI. O guia atual do Neon chama a variável de migrations `DATABASE_URL_UNPOOLED`; neste projeto o nome equivalente foi padronizado como `DIRECT_URL` e o datasource Prisma aponta para esse nome. Não adicione aspas externas ou substitua caracteres percent-encoded da URL.

**Limites gratuitos atuais:** 100 CU-hours/projeto/mês, 0,5 GB de armazenamento/projeto e 5 GB de tráfego de saída/projeto/mês. O compute gratuito suspende depois de 5 minutos sem atividade e não permite desativar scale-to-zero. Ao esgotar CU-hours ou tráfego, o compute é suspenso até o reset/upgrade; ao alcançar o teto de armazenamento, operações que aumentam dados falham. Confira [limites e preços do Neon](https://neon.com/docs/introduction/plans) antes de lançar para usuários.

## B. Subir a API no Render

### B1. Preparar o repositório Git

O Render Blueprint precisa acessar um repositório Git. Na sua cópia local do projeto, crie um repositório privado no GitHub/GitLab e faça o primeiro push. `.gitignore` exclui `.env` e dependências locais; revise `git status` e nunca force a inclusão de arquivos `.env`.

```bash
cd hipertrofia-app
git init
git add .
git status --short   # confira que NÃO há backend/.env nem credenciais
git commit -m "Prepare Hipertrofia for production"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/hipertrofia-app.git
git push -u origin main
```

Se o repositório já existir, em vez de `git init`/`git remote add`, use o fluxo normal de commit e push.

### B2. Criar o Blueprint

1. Entre no [Render Dashboard](https://dashboard.render.com/) e escolha **New → Blueprint**.
2. Conecte o repositório e a branch `main`. O arquivo de produção é `render.yaml` na raiz.
3. Revise os recursos que o Render propõe e confirme a implantação. Para a versão de demonstração Free, selecione o caminho `render-free.yaml` como arquivo Blueprint, se a interface oferecer a escolha, ou use o procedimento manual descrito mais abaixo.
4. Nos prompts do Blueprint, informe os valores abaixo. O Render gera `JWT_SECRET` automaticamente em `render.yaml` — não substitua por um valor fraco.

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL pooled do Neon (`-pooler`) |
| `DIRECT_URL` | URL direct do Neon (sem `-pooler`) |
| `GEMINI_API_KEY` | Chave server-side do Google AI Studio; nunca use prefixo `EXPO_PUBLIC_` |
| `JWT_SECRET` | Gerada por `generateValue: true`; mínimo 32 caracteres aleatórios |
| `NODE_ENV` | `production` (definida pelo Blueprint) |
| `PORT` | Não configurar: o Render fornece a porta e o servidor escuta em `0.0.0.0` |
| `CORS_ORIGIN` | Em branco para app iOS/Android nativo. Se publicar cliente web, informe as origens HTTPS separadas por vírgula. |

O build pode levar alguns minutos. Abra os logs do serviço e aguarde o health check. A URL pública terá formato `https://NOME-DO-SERVICO.onrender.com`; valide no navegador:

```text
https://NOME-DO-SERVICO.onrender.com/health
```

A resposta esperada é JSON com `"status":"ok"`. Copie a URL **sem** `/health` para a variável Expo.

### B3. Banco e migrações

O serviço pago usa `preDeployCommand: npm run prisma:deploy`; o Render executa as migrations versionadas depois do build e antes de encaminhar tráfego para a nova versão. Não use `prisma db push` em produção. Faça backup antes de migrations potencialmente destrutivas.

### B4. Opção gratuita apenas para demonstração

`render-free.yaml` usa runtime Node e executa `npm ci`, geração do Prisma e `prisma migrate deploy` durante o build. Isso evita depender de `preDeployCommand`, indisponível no plano Free. Não use Free para tráfego real/dados importantes:

- serviços Free adormecem após 15 minutos sem tráfego e podem levar cerca de um minuto para acordar;
- o disco local é efêmero e o Render recomenda não usar o plano Free para produção;
- chamadas externas frequentes a banco/IA podem acionar restrições de tráfego de saída;
- migrations ocorrem durante o build, em vez de uma etapa de pre-deploy;
- os serviços podem reiniciar e quotas podem pausar a aplicação.

Acompanhe as limitações atuais em [Render Free](https://render.com/docs/free). Para migrar a serviço pago, aplique o `render.yaml` de produção e confirme no painel o plano/custo vigente antes de aprovar os recursos.

## C. Configurar o EAS e gerar APK/AAB

### C1. Expo/EAS e URL da API

É necessário ter uma conta Expo. A sessão atual não está autenticada no EAS, então os builds ainda precisam ser iniciados por uma conta autorizada. EAS Build oferece acesso também no plano Free, com quotas/filas próprias.

```bash
cd hipertrofia-app/frontend
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` cria ou vincula o projeto Expo e grava o `projectId` em `app.json`/config. Mantenha esse ID no repositório depois de criado.

Cadastre a URL pública da API nos ambientes do projeto. `EXPO_PUBLIC_API_URL` é incluída no aplicativo e, portanto, deve conter somente a URL pública — nunca uma chave, senha, `JWT_SECRET` ou `GEMINI_API_KEY`.

```bash
npx eas-cli@latest env:set --environment preview --name EXPO_PUBLIC_API_URL --value 'https://NOME-DO-SERVICO.onrender.com' --visibility plaintext --non-interactive
npx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_API_URL --value 'https://NOME-DO-SERVICO.onrender.com' --visibility plaintext --non-interactive
```

Para criar também um development build, configure `development` com um host de API acessível pelo dispositivo de desenvolvimento (ex.: IP LAN do computador; `10.0.2.2` para emulador Android) e execute:

```bash
npx eas-cli@latest env:set --environment development --name EXPO_PUBLIC_API_URL --value 'http://10.0.2.2:3333' --visibility plaintext --non-interactive
npx eas-cli@latest build --platform android --profile development
```

Não use IP local no preview/production. A URL default local só vale com `__DEV__`; um build standalone sem URL configurada mostra erro explícito.

### C2. APK instalável no telefone (preview)

No diretório `frontend/`:

```bash
npx eas-cli@latest build --platform android --profile preview
```

A primeira build pode pedir para criar o certificado Android; aceite a geração/gestão automática do keystore EAS. Ao terminar, o CLI e o painel Expo mostram a página da build e o link de instalação/download do `.apk`. Abra o link no Android e autorize a instalação da aplicação de origem desconhecida se o sistema pedir.

### C3. Preparar AAB para Google Play (futuro)

```bash
npx eas-cli@latest build --platform android --profile production
```

O perfil `production` gera `.aab`, formato para envio à Play Store, e incrementa o `versionCode` remoto. AAB não é o arquivo para instalação direta por sideload. Para publicar, será preciso criar conta Google Play Console, aceitar seus termos/pagar a taxa de cadastro vigente, preencher a ficha de conteúdo/privacidade e passar pelo processo de revisão. Fazer o build não publica automaticamente na loja.

### Instalar APK via computador (alternativa)

Com Android Debug Bridge instalado e depuração USB habilitada, depois de baixar o arquivo:

```bash
adb install ./hipertrofia-preview.apk
```

## D. Testes finais antes de entregar a testadores

1. `GET /health` retorna 200 pela URL HTTPS Render.
2. No telefone, abra o APK Preview e crie uma conta de teste.
3. Confira Login/Registro e restauração de sessão.
4. Registre uma refeição por texto e por imagem; confirme retorno do Gemini e persistência no histórico diário.
5. Crie treino, registre séries e valide a evolução de carga.
6. Registre peso e confirme atualização do dashboard.
7. Configure lembretes locais e confirme solicitação/permissão do Android.
8. Revise o painel de logs do Render após os testes; não registre tokens/chaves em logs.

O endpoint `/health` é um liveness simples da API, não executa teste de escrita no banco ou chamada ao Gemini. Diagnostique falhas de dependências pelo log da aplicação sem expor segredos.

## Documentação oficial consultada

- [Neon — Prisma](https://neon.com/docs/guides/prisma) e [connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Render — Blueprint spec](https://render.com/docs/blueprint-spec), [monorepos](https://render.com/docs/monorepo-support), [pre-deploy](https://render.com/docs/deploys), [free](https://render.com/docs/free)
- [Expo — APK](https://docs.expo.dev/build-reference/apk/), [eas.json](https://docs.expo.dev/build/eas-json/), [variáveis EAS](https://docs.expo.dev/eas/environment-variables/), [primeiro build](https://docs.expo.dev/build/setup/)
