# GoLive Tracker

SAPUI5 freestyle app (XML views, UI5 1.120, Fiori tools) for the GoLive Tracker
API — the same stack as the Thank You app. It talks to the API's two OData V4
services, `/project` and `/admin`, and on SAP BTP it is served by a standalone
approuter that signs the user in through XSUAA and forwards the token.

- API guide for the frontend: [docs/backend-api-guide.md](docs/backend-api-guide.md)
- Mockups: [docs/mockups](docs/mockups)
- API code: [NelsonTeixeira09/golive-tracker-api](https://github.com/NelsonTeixeira09/golive-tracker-api)

## Run locally

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
| `webapp/view/App.view.xml` | Shell: side navigation, top bar, pages |
| `webapp/view/Projects.view.xml` | Projetos list (search, status/client/PM filters) |
| `webapp/view/Dashboard.view.xml` | Dashboard from `GET /project/dashboard()` |
| `webapp/view/Placeholder.view.xml` | Stand-in for the screens not built yet |
| `deploy/approuter` | Approuter: XSUAA login, `/project` and `/admin` to the API destination |
| `mta.yaml` | BTP deployment |

## Screens

- [x] Shell (side navigation, top bar, signed-in person)
- [x] 03 Projetos — list, search, filters
- [ ] 02 Dashboard — KPIs and lists done; charts to do
- [x] 04 Projeto — header, tabs, marcos (KPIs, table, edit dialog); "Novo marco" to do
- [ ] 05 Projeto — equipa
- [ ] 06 Novo projeto
- [ ] 07 O meu trabalho
- [ ] 08 Auditorias
- [ ] 09 Administração — pessoas e clientes

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
