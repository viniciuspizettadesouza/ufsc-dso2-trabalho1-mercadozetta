# Deployment spike templates

These files prepare the Step 16 Render and DigitalOcean staging spikes without
creating accounts or resources. They are candidate-specific adapters around the
provider-neutral production images and commands.

They are deliberately not production infrastructure:

- image URLs contain `sha256:IMAGE_DIGEST` markers that must be replaced with
  published immutable digests;
- secret values are omitted and must be supplied through the provider secret
  store;
- DNS, TLS, centralized logs, alerts, portable backup storage, least-privilege
  database roles, and billing controls still require provider evidence; and
- neither file has passed a provider control-plane validation or staging run.

Run the free structural check with:

```bash
npm run check:deployment
```

Do not deploy either template until temporary spend and accounts are explicitly
authorized. Passing this check does not select a provider.
