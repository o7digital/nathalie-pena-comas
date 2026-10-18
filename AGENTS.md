# Branch and deployment restrictions

- Work on `dev` only. Keep all site changes on `dev` and its preview deployments.
- Do not modify, merge into, or push `main` unless the user explicitly orders it.
- Do not deploy or promote to production, change production aliases, or roll production forward without an explicit user order. General delivery instructions do not grant production authorization for this repository.
- Use `vercel --yes` for preview deployments; never use `--prod` during ordinary development.
- Preserve `main2` as the existing backup of `main`; do not advance or overwrite it without an explicit request.
- After changes, run the relevant checks, commit only task files, push `dev`, deploy the preview, and verify the changed preview routes. Keep production untouched.
