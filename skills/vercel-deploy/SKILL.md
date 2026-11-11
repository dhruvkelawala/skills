---
name: vercel-deploy
description: Deploy or redeploy an app, site or static page to Vercel, including requests for Work Vercel, company Vercel or personal Vercel. Use existing source or rendered output; creating or explaining the content is a separate task.
---

# Vercel deploy

Deploy the artifact or project the user names. An existing HTML page can be published directly. Its layout, word count and rendering tool belong to its authoring workflow.

## 1. Select the destination

The user's explicit account choice wins. Otherwise preserve an existing project's Vercel link. For a new project, use these conventions:

| The user says | Scope |
| --- | --- |
| "argentlabs vercel", "work vercel", "company vercel" | `${VERCEL_WORK_SCOPE:-argentlabs}` |
| "personal vercel", "my vercel" | `${VERCEL_PERSONAL_SCOPE:-dhruv-kelawalas-projects}` |
| "vercel" alone | Work for an `argentlabs` repository, personal otherwise |

Check the repository's deployment instructions, `.vercel/project.json` and any `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` overrides. If the requested account differs from the configured account, select the project in the requested account explicitly. Ask only when the artifact, project or account cannot be determined from the request and existing configuration.

Keep the requested preview or production environment. For an existing app, default to preview unless the user or its deployment instructions specify production. Publishing a standalone static page uses production for its stable URL.

**Done when** the source, scope, project and environment are known.

## 2. Deploy the existing content

Use the available Vercel integration or the authenticated CLI. Check authentication in that environment rather than assuming another machine's session is available. Read [references/cli.md](references/cli.md) when using the CLI.

- For an app or site, deploy its project directory with its existing build and asset configuration.
- For a rendered page, stage the finished HTML as `index.html` with any relative assets it needs. Reuse an already published page's project name and production alias, including any suffix, from the conversation or project metadata. For a first publication, use the rendered HTML filename without `.html` as the lowercase project slug.

**Done when** Vercel has accepted the intended source in the selected scope.

## 3. Check completion and return the URL

Wait for the deployment to reach `READY`, using the integration or `vercel inspect`. If it fails, inspect the build logs and fix the deployment within the requested scope before retrying. Report a blocker when the user must resolve access or configuration.

Return the deployment URL, and the production alias when one was assigned. State whether the deployment is preview or production. A deployment URL alone does not prove public access; retain the project's access settings and report any access check left undone.

**Done when** the deployment is ready and the user has its URL and verification status.
