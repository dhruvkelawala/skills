# Deploy an eli25 page

Run the block for the target, then print the URL on its own line. A deploy never fetches the URL to test it.

## Vercel

The CLI is already logged in with access to both scopes, so run the deploy without a login step.

- Work: `scope=${VERCEL_WORK_SCOPE:-argentlabs}`
- Personal: `scope=${VERCEL_PERSONAL_SCOPE:-dhruv-kelawalas-projects}`

```bash
site="$(mktemp -d)/<slug>-eli25"
mkdir -p "$site" && cp ~/.agent/diagrams/<slug>-eli25.html "$site/index.html"
cd "$site" && vercel deploy --prod --yes --scope "$scope"
```

The folder name becomes the Vercel project name, which must be lowercase. A redeploy of the same slug updates the same project, so the URL stays the same. Print the `Aliased:` URL from the output, for example `https://mario-shared-thread-eli25.vercel.app`. Anyone with that URL can open it.
