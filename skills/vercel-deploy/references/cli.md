# Deploy with the Vercel CLI

Use the selected scope from [vercel-deploy](../SKILL.md) in each command. `vercel whoami` checks the current CLI login. Follow the host's sign-in flow if access is missing.

## Existing app or site

Deploy from the configured project root:

```bash
vercel deploy "$project_dir" --yes --scope "$scope"
```

Add `--prod` for the selected production environment. Reuse the existing project link when it matches the requested scope. To choose a named project explicitly, run `vercel link --yes --project "$project" --scope "$scope"` from its project root before deploying.

## Standalone static page

Set `html_path` to the finished HTML, `slug` to the lowercase project name and `scope` to the selected account. Stage a single self-contained HTML file with:

```bash
stage_root="$(mktemp -d)"
site_dir="$stage_root/$slug"
mkdir -p "$site_dir"
cp "$html_path" "$site_dir/index.html"
cd "$site_dir"
vercel link --yes --project "$slug" --scope "$scope"
vercel deploy --prod --yes --scope "$scope"
```

For a page with relative assets, stage those assets with the same relative paths before deploying. Link each staged directory to the same named project on later updates so its production alias stays the same.

## Completion

Use `vercel inspect "$deployment_url" --scope "$scope"` to read the deployment status. On a failed build, use `vercel inspect "$deployment_url" --logs --scope "$scope"`. Return the actual deployment URL and assigned production alias from Vercel's output.

CLI reference: [deploy](https://vercel.com/docs/cli/deploy), [link](https://vercel.com/docs/cli/link), [global options](https://vercel.com/docs/cli/global-options).
