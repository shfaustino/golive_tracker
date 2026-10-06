# GoLive Tracker

SAPUI5 freestyle app (XML views, UI5 1.120, Fiori tools) for the GoLive Tracker
API — the same stack as the Thank You app. It talks to the API's two OData V4
services, `/project` and `/admin`, and on SAP BTP it is served by a standalone
approuter that signs the user in through XSUAA and forwards the token.

- API guide for the frontend: [docs/backend-api-guide.md](docs/backend-api-guide.md)
- API reference (OpenAPI, every entity, field and operation):
  [docs/api/ProjectService.openapi.json](docs/api/ProjectService.openapi.json),
  [docs/api/AdminService.openapi.json](docs/api/AdminService.openapi.json)
- Mockups: [docs/mockups](docs/mockups)
- API code: [NelsonTeixeira09/golive-tracker-api](https://github.com/NelsonTeixeira09/golive-tracker-api)

## Run locally

### Without the API (mock data)

```sh
npm install
npm run start-mock
```

`ui5-mock.yaml` serves a mock of `/project` from `webapp/localService/project`:
24 projects with clients, people, team, modules and milestones, signed in as an
Administrator. Data lives in memory (a restart resets it);
`npm run mock:generate` rewrites the data files. The mock metadata is written
from the API guide, so the real `/project/$metadata` wins where they differ.

### With the API

1. Start the API (Node.js 22+), in a clone of `golive-tracker-api`:

   ```sh
   npm install
   npm run watch    # http://localhost:4004, in-memory SQLite with demo data
   ```

2. Start the app, here:

   ```sh
   npm install
   npm start
   ```

   `ui5.yaml` proxies `/project` and `/admin` to `http://localhost:4004`. The
   API asks for Basic Auth, so the browser prompts for a test user (password =
   name): `admin`, `architect`, `pm`, `user`, `newcomer`, `bootstrap`.

## Structure

| Path | What |
|---|---|
| `webapp/manifest.json` | OData V4 models (`""` → `/project/`, `admin` → `/admin/`) and routes |
| `webapp/Component.js` | Reads `GET /project/me()` into the `user` model |
| `webapp/model/profiles.js` | What each profile (Administrator, Architect, User) is offered in the UI |
| `webapp/view/App.view.xml` | Shell: navy sidebar, top bar, pages |
| `webapp/css/style.css` | The mockups' look: theme variables remapped, then the sidebar, cards, chips |
| `webapp/view/Projects.view.xml` | Projetos: paged list, sortable columns, search, filters |
| `webapp/view/Dashboard.view.xml` | Dashboard from `GET /project/dashboard()` |
| `webapp/view/ProjectDetail.view.xml` | Projeto: header, tabs, milestones (create, edit) |
| `webapp/model/*.js` | Logic without UI (paging, milestone rules, chart), tested with `npm test` |
| `webapp/localService/project` | Mock `/project` service for `npm run start-mock` |
| `webapp/view/Placeholder.view.xml` | Stand-in for the screens not built yet |
| `deploy/approuter` | Approuter: XSUAA login, `/project` and `/admin` to the API destination |
| `mta.yaml` | BTP deployment |

## Screens

- [x] Shell (side navigation, top bar, signed-in person)
- [x] 02 Dashboard — KPIs, projects by status, overdue milestones, to review, stale projects
- [x] 03 Projetos — paged list, sorting, search, filters
- [x] 04 Projeto — header with Mudar estado and Gravar baseline; Visão geral
  (progress, timeline, details, next milestone, team, latest updates); Marcos
  (KPIs, table, new and edit dialog); Módulos; Updates (feed and posting).
  Auditorias and Anexos tabs to do.
- [x] 05 Projeto — equipa (add, edit, end today, remove, PM hand-over)
- [x] 06 Novo projeto — general data, modules, initial team, preview of the
  milestones the type generates; one deep insert
- [x] 07 O meu trabalho — my items (KPIs, search, state filter, pages, late,
  upcoming), my milestones, projects where I am a member
- [x] 08 Auditorias — paged list with search, project and result filters;
  new, edit, follow-up and delete; also as the project's Auditorias tab
- [ ] 09 Administração — pessoas e clientes

"Evolução dos projetos" and "Últimas atualizações" on the dashboard mockup
have no source in the API yet; their places show overdue milestones and
projects with no recent update.

The login screen (01) is the XSUAA login page the approuter redirects to; the
app has no login form of its own.

## Deploy to BTP

Needs the [Cloud MTA Build Tool](https://sap.github.io/cloud-mta-build-tool/)
and the CF CLI with the MultiApps plugin, logged in to the API's space.

```sh
npm install
npm run build:mta
npm run deploy
```

The approuter binds to the API's existing XSUAA instance
(`golive-tracker-api-auth`) and creates a destination `golive-tracker-api` with
`forwardAuthToken: true` pointing at the sandbox API. Its route stays under
`*.cfapps.us10.hana.ondemand.com`, which the API's XSUAA already accepts as a
redirect URI.
