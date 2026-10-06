# Deploy an eli25 page

Run the block for the target, then print the URL on its own line. A deploy never repeats the render check and never fetches the URL to test it.

## Tailscale

Only devices on the tailnet can open the URL.

```bash
tailscale serve status | grep -q '/eli25' || tailscale serve --bg --set-path /eli25 ~/.agent/diagrams
host=$(tailscale status --json | jq -r '.Self.DNSName | rtrimstr(".")')
echo "https://$host/eli25/<slug>-eli25.html"
```

Tailscale serves the whole diagrams folder, so a page is live as soon as it is written. An updated page or a second page needs no new serve.

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
