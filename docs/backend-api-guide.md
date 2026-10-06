# GoLive Tracker API — Guia para o frontend

> Cópia do guia do backend (Sep 28, 2026, @Salif Faustino). A versão técnica
> e o código estão em [NelsonTeixeira09/golive-tracker-api](https://github.com/NelsonTeixeira09/golive-tracker-api),
> em `Docs/frontend-guide.md`.

Tudo o que o frontend precisa para consumir a API do GoLive Tracker: onde está,
como se faz login, que endpoints usar em cada ecrã, que regras a API aplica e
que erros devolve. A API é OData V4 (JSON), feita em SAP CAP e publicada no SAP BTP.

## Visão geral

A API tem dois serviços OData V4. Cada um tem o seu documento `$metadata`
(por exemplo `/project/$metadata`).

| Serviço | Caminho | Quem pode usar | Para quê |
|---|---|---|---|
| ProjectService | `/project` | Qualquer utilizador com login | Projetos, equipa, marcos, itens, auditorias, anexos, updates, "o meu trabalho", dashboard |
| AdminService | `/admin` | Só Administradores | Clientes e pessoas, incluindo o perfil de acesso |

| Ambiente | URL base | Login |
|---|---|---|
| Local | `http://localhost:4004` | Basic Auth com utilizadores de teste |
| BTP sandbox | `https://amt---consulting--s-a--h2h-sandbox-lwsjexg2-sandbox-gol62961c38.cfapps.us10.hana.ondemand.com` | XSUAA (OAuth 2.0) |

O sandbox tem dados de teste fictícios: 88 projetos, com códigos `CO-T-0001` a
`CO-T-0088`, 47 clientes e 29 pessoas.

## Arquitetura e login

O frontend nunca chama a API diretamente: passa por um SAP Application Router,
que faz o login no XSUAA e envia o token em cada pedido.

O que o approuter precisa:

- Estar ligado (bound) à mesma instância XSUAA da API: `golive-tracker-api-auth`
  (xsappname `golive-tracker-api-Sandbox`).
- Ter uma destination para o URL da API com `forwardAuthToken: true`, e rotas
  `/project/` e `/admin/` para essa destination.
- Pode ser um approuter próprio no MTA ou o approuter gerido do SAP Build Work
  Zone / HTML5 repository.

Sem token a API responde 401. A API não tem CORS, por isso chamadas diretas de
outra origem no browser falham. Se o approuter ficar fora de
`*.cfapps.us10.hana.ondemand.com`, o URL dele tem de ser acrescentado aos
`redirect-uris` do XSUAA (alteração no backend).

### Quem é o utilizador e o que pode fazer

- A API identifica a pessoa pelo email do token. No primeiro login cria-a
  automaticamente com o perfil `User`, sem configuração prévia.
- A autorização vem do perfil guardado em `People.profile`, que os
  Administradores mudam em `/admin/People`. A única role collection é
  `GoLiveTracker_Administrator`, para os primeiros administradores; os restantes
  utilizadores não precisam de nenhuma.
- Uma pessoa desativada recebe 403 "Your account is deactivated."

| Perfil | Vê | Edita |
|---|---|---|
| Administrator | Todos os projetos e `/admin` | Tudo |
| Architect | Todos os projetos | Projetos onde é membro ativo; auditorias em qualquer projeto |
| User | Só projetos onde é membro ativo | Esses projetos |

Um projeto que o utilizador não pode ver responde 404, como se não existisse.
Alterar um projeto que pode ver mas não editar responde 403.

Logo a seguir ao login, o frontend pergunta quem é o utilizador e adapta a
interface ao perfil (por exemplo, mostrar o menu de administração):

```http
GET /project/me()
```

```json
{ "ID": "ac2e75c0-7fce-4569-956b-6c0555da878c", "name": "Nelson Teixeira", "email": "nelson.teixeira@amt-consulting.com", "profile": "Administrator" }
```

`ID` é o ID da pessoa usado em `members`, `owners` e `owner_ID`. `profile` é o
perfil efetivo: quem tem a role collection de administrador aparece como
`Administrator`. A API verifica sempre as permissões; esconder ações no ecrã é
só para conforto do utilizador.

## OData essencial

Todas as opções OData V4 funcionam em qualquer entity set: `$select`, `$expand`
(encadeado), `$filter`, `$orderby`, `$top`/`$skip`, `$count=true` e `$search`
(texto livre nos campos de texto).

```http
GET /project/Projects?$select=ID,code,name,status&$expand=client($select=name),pm($expand=person($select=name))&$filter=status eq 'InProgress'&$orderby=code&$top=50&$count=true
```

| Tema | Como funciona |
|---|---|
| Paginação | No máximo 1000 linhas por pedido; paginar com `$top`/`$skip` |
| Chaves | UUIDs sem aspas: `/Projects(1f1d1358-3df5-4971-9057-f710c950d853)` |
| Entidades filhas | Acedem-se pelo pai: `/project/Projects(<id>)/milestones(<id>)`. `/project/Milestones` responde 405 |
| Ações | POST na entidade, com o namespace: `POST /project/Projects(<id>)/ProjectService.changeStatus` |
| Funções (só leitura) | GET com parênteses: `GET /project/dashboard()` |
| Deep insert | Um projeto cria-se com `modules` e `members`; um marco com `owners` |
| Alterações | PATCH só com os campos alterados |
| Datas | `YYYY-MM-DD`; timestamps em ISO 8601, UTC |
| Enums | Enviados como texto (valores na secção Listas de valores) |

## Projetos

### Lista de projetos (US-05, US-09)

```http
GET /project/Projects?$expand=client($select=name),pm($expand=person($select=name)),modules
```

- `pm` é o PM ativo. Para filtrar por PM: `$filter=pm/person_ID eq <uuid>`.
- `needsReview` e `reviewReason` marcam projetos "a rever"; `lastUpdateAt` é a
  última atividade.
- Listas para escolher: `GET /project/Clients` (clientes ativos),
  `GET /project/People` (pessoas ativas), `GET /project/Currencies`.

### Criar e editar (US-01 a US-03)

```http
POST /project/Projects
```

```json
{ "code": "CO-N-04000", "name": "New project", "client_ID": "<uuid>", "projectType": "Implementation",
  "startDate": "2026-10-01", "endDate": "2027-03-31", "value": 25000, "currency_code": "EUR",
  "modules": [{ "module": "EC" }, { "module": "LMS" }],
  "members": [{ "person_ID": "<uuid>", "role": "PM", "startDate": "2026-10-01" }] }
```

- Os marcos são gerados a partir do tipo de projeto (tabela abaixo); o frontend
  não os cria.
- Quem cria o projeto entra na equipa: como PM se nenhum PM for indicado, caso
  contrário como PMO.
- `code` e `externalCode` são únicos (409). `endDate` tem de ser igual ou
  posterior a `startDate`.
- `status` não se escreve diretamente: usa-se `changeStatus` (secção seguinte).
  `lastUpdateAt` é do servidor.
- Num PATCH do projeto, `members` e `milestones` são recusados: gerem-se pelos
  seus próprios caminhos.

| Tipo de projeto | Marcos gerados (★ = exige auditoria) |
|---|---|
| Implementation | KO, PTO, GOP★, Training, Testing★, Go-live★, Closure |
| Rollout | KO, GOP, Testing★, Go-live★, Closure |
| Integration | KO, PTO, Testing, Go-live, Closure |
| Enhancements/CR | KO, Testing, Go-live, Closure |
| Assessment | KO, Report delivery, Closure |
| Change management | KO, Training, Closure |
| Hours bank, Ticket > 40h, T&M/Outsourcing | nenhum |

### Equipa (US-10, US-11, BR-03)

- `GET|POST /project/Projects(<id>)/members` e `PATCH|DELETE .../members(<id>)`.
  Uma pessoa pode ter vários papéis; `endDate` vazio = ativo.
- Há sempre um só PM ativo. Para trocar de PM usa-se a passagem de testemunho,
  que termina o PM atual e começa o novo:

```http
POST /project/Projects(<id>)/ProjectService.handOverPM
```

```json
{ "person_ID": "<uuid>", "startDate": "2026-10-01" }
```

### Estados do projeto

O estado muda só através da ação `changeStatus`, e apenas pelas transições
permitidas; qualquer outra responde 409.

```http
POST /project/Projects(<id>)/ProjectService.changeStatus
```

```json
{ "status": "OnHold", "reason": "Client budget freeze until October" }
```

- Sair de `NotStarted` exige exatamente um PM ativo.
- Passar a `Closing` exige todos os marcos `Completed`, `NotApplicable` ou
  `Cancelled`, e todos os follow-ups de auditoria `Done` ou `Cancelled` (BR-09).
  O erro lista o que ainda está aberto.
- Cada mudança de estado publica um update automático no projeto.

## Marcos, itens, auditorias, anexos e updates

### Marcos (US-14 a US-20)

```http
GET   /project/Projects(<id>)/milestones?$expand=owners($expand=person($select=name))&$orderby=sortOrder
PATCH /project/Projects(<id>)/milestones(<id>)
```

```json
{ "forecastStart": "2026-10-20", "forecastEnd": "2026-11-05", "changeReason": "Client asked to postpone the training" }
```

| Regra | Detalhe |
|---|---|
| Campos calculados (só leitura) | `isOverdue` (data prevista passou e o marco está aberto, BR-07), `itemsCompletion` (% de itens Done, US-23), `missingDocuments` (documentos obrigatórios em falta, US-30) |
| Mudar datas previstas | `forecastStart` ou `forecastEnd` exigem `changeReason`; fica registado em `.../milestones(<id>)/history` |
| Data por confirmar | `isEstimated: true`, por exemplo "julho 2026" |
| Estados | `Completed` exige `actualDate`; `NotApplicable` exige `justification` |
| Marcos obrigatórios | Os do modelo (`mandatory`) não se apagam: marcam-se Not applicable. Podem juntar-se marcos extra com POST, por exemplo um GOP por módulo |
| Responsáveis | `.../milestones(<id>)/owners` com `{ "person_ID": "<uuid>" }`; têm de ser membros ativos da equipa (BR-12) |
| Baseline | `baselineStart`/`baselineEnd` são só de leitura. Grava-se para todos os marcos com `POST /project/Projects(<id>)/ProjectService.setBaseline { "reason": "..." }` (BR-06) |

### Itens, auditorias e follow-ups (US-21 a US-26)

- Itens: `.../milestones(<id>)/items`, do tipo `Meeting`, `Document`, `Task` ou
  `FollowUp`. O responsável tem de ser membro ativo.
- Auditorias: `.../milestones(<id>)/audits` ou `/project/Audits`. Só nos marcos
  que exigem auditoria (★ na tabela de Projetos, BR-10). Com `code` vazio, a API
  sugere `<n.º projeto>_<marco>_<ddmmaaaa>` (ex.: `3251_GOP_15062026`); o código
  é único.
- Follow-up: `POST /project/Audits(<id>)/ProjectService.addFollowUp { "name": "...", "owner_ID": "<uuid>", "date": "2026-10-15" }`
  cria um item `FollowUp` no marco auditado.

### Anexos (US-29, US-30, BR-11)

- Na versão 1 são só links http(s), por exemplo SharePoint.
- Cada anexo pertence a um só dono: projeto, marco ou item. Cria-se no caminho
  desse dono: `.../Projects(<id>)/attachments`, `.../milestones(<id>)/attachments`
  ou `.../items(<id>)/attachments`.
- Não se move para outro dono. O `author` é preenchido pela API.

### Updates de estado (US-27)

- `GET|POST /project/Projects(<id>)/updates` com `{ "text": "...", "milestone_ID": "<uuid opcional>" }`.
- Só o autor edita, e só durante 24 horas. Os updates automáticos
  (`isAutomatic`) não se editam.

## O meu trabalho, dashboard e administração

| Ecrã | Pedido | O que devolve |
|---|---|---|
| O meu trabalho: itens (US-13) | `GET /project/MyItems` | Itens de que o utilizador é responsável, em qualquer projeto, por data |
| O meu trabalho: marcos (US-13) | `GET /project/MyMilestones` | Marcos de que é responsável, com `isOverdue` como alerta na app |
| Dashboard (US-31) | `GET /project/dashboard()` ou `dashboard(staleDays=15)` | `projectsByStatus`, `overdueMilestones`, `staleProjects` (sem update há mais de `staleDays` dias, 30 por omissão) e `projectsToReview` |
| Visão geral (US-34) | `GET /project/projectOverview()` | Uma linha por projeto com uma coluna de data por tipo de marco (KO, PTO, GOP, Training, Testing, GoLive, ReportDelivery, Closure), para a tabela e a exportação para Excel |

O dashboard e a visão geral só incluem os projetos que o utilizador pode ver.
Exemplo de resposta do dashboard no sandbox:

```json
{ "staleDays": 30,
  "projectsByStatus": [{ "status": "InProgress", "count": 88 }],
  "overdueMilestones": [{ "projectCode": "CO-T-0036", "projectName": "Cerejeira – Performance & Goals", "milestoneType": "Go-live", "dueDate": "2025-04-12", "status": "Planned", "...": "..." }],
  "staleProjects": [],
  "projectsToReview": [{ "projectCode": "CO-T-0003", "reviewReason": "GOP date was not clear in the source Excel; fill it in.", "...": "..." }] }
```

### Administração (só Administradores)

- `/admin/Clients`: `name` e NIF (`taxId`) únicos. Um cliente com projetos não se
  apaga (409); desativa-se com `active: false`.
- `/admin/People`: `name`, `email` (único, guardado em minúsculas), `profile`
  (`Administrator`, `Architect` ou `User`) e `active`. Pessoas com histórico em
  projetos não se apagam; desativam-se.

## Listas de valores

As listas são fixas (mudá-las exige uma nova versão da API). Alguns valores têm
espaços ou símbolos (`Go-live`, `P&G`, `Ticket > 40h`): em `$filter` têm de ir
codificados no URL.

| Campo | Valores |
|---|---|
| `status` do projeto | NotStarted, InProgress, OnHold, Replanning, Closing, Closed, Cancelled |
| `projectType` | Implementation, Rollout, Integration, Enhancements/CR, Assessment, Change management, Hours bank, Ticket > 40h, T&M/Outsourcing |
| `module` | EC, ECP, TT, P&G, REC, ONB, LMS, Compensation, Workzone, FI, SD, EWM |
| `role` do membro | PM, Functional lead, Technical lead, Testing owner, Requirements owner, Architect, PMO |
| `milestoneType` | KO, PTO, GOP, Training, Testing, Go-live, Report delivery, Closure |
| `status` do marco | Planned, InProgress, Completed, Postponed, NotApplicable, Cancelled |
| `type` do item | Meeting, Document, Task, FollowUp |
| `status` do item | ToDo, InProgress, Done, Cancelled |
| `result` da auditoria | Approved, ApprovedWithReservations, Rejected |
| `documentType` | Proposal, Contract, Project plan, Status report, KO minutes, GOP presentation, Test plan, Final report |
| `profile` | Administrator, Architect, User |
| `currency_code` | EUR, USD, GBP (em `GET /project/Currencies`) |

## Erros

Os erros seguem o formato JSON do OData. As mensagens estão em inglês e podem
ser mostradas ao utilizador tal como vêm. `target` indica o campo quando o erro é
sobre um campo, para mostrar a mensagem junto ao input:

```json
{ "error": { "code": "409", "message": "A client with taxId '500000001' already exists.", "target": "taxId" } }
```

Quando vários campos estão errados ao mesmo tempo, a resposta traz uma lista
`details` com um erro por campo.

| Código | Significado | Exemplos |
|---|---|---|
| 400 | Dados inválidos ou regra sobre os dados | falta `changeReason`, fim antes do início, `Completed` sem `actualDate`, link que não é http(s) |
| 401 | Sem token ou token inválido | — |
| 403 | Sem permissão | `/admin` sem perfil Administrator, conta desativada, alterar um projeto visível onde não é membro, editar o update de outra pessoa |
| 404 | Não existe ou não é visível | um projeto onde o utilizador não é membro |
| 405 | Caminho errado | entidade filha chamada no topo (usar o caminho do pai) |
| 409 | Conflito com o estado atual | código, email ou NIF repetido, transição de estado não permitida, fechar com marcos abertos, apagar cliente com projetos |

## Trabalhar localmente

Código em [github.com/NelsonTeixeira09/golive-tracker-api](https://github.com/NelsonTeixeira09/golive-tracker-api).
Com Node.js 22 ou mais recente:

```sh
npm install
npm run watch    # http://localhost:4004, SQLite em memória com dados de demonstração
```

- Referência da API (Scalar): `http://localhost:4004/api-docs`. Cada operação tem
  um exemplo pronto a correr, com IDs de demonstração e o utilizador de teste certo.
- OpenAPI (por exemplo para gerar um cliente): `/api-docs/ProjectService.json` e
  `/api-docs/AdminService.json`.
- Pedidos manuais para a extensão REST Client do VS Code em `test/http/`. O
  Scalar está desligado no BTP.

Utilizadores de teste (Basic Auth, password = nome):

| Utilizador | Perfil | Notas |
|---|---|---|
| admin | Administrator | |
| architect | Architect | Vê todos os projetos, não edita nenhum (não é membro) |
| pm | User | PM dos dois projetos de demonstração |
| user | User | Membro só do CO-N-03251 |
| newcomer | — | Não existe em People: é criado com perfil User no primeiro login |
| bootstrap | Administrator (role) | Não existe em People, mas tem a role de administrador, como os primeiros administradores no BTP |

## O que ainda falta

- Anotações UI (`@UI.LineItem`, `@UI.FieldGroup`, …): uma app Fiori elements
  precisa delas no modelo CDS; uma app SAPUI5 freestyle não.
- Alertas por email (US-32): ainda não existem; para já só há o alerta na app
  (`isOverdue`).
- Upload de ficheiros: os anexos são só links.
- Approuter: ainda não existe; faz parte do trabalho do frontend (secção
  Arquitetura e login).
