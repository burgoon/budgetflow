# BudgetFlow

Personal cashflow projection in the browser. Add your accounts and starting balances, define recurring income, expenses, and transfers, and see how each account's balance evolves on a chart and in a day-by-day table. All data lives in your browser's local storage — no backend required, nothing leaves the device unless you opt in to sync.

- Multiple profiles (you, partner, household)
- Checking, savings, and credit accounts with tag-based filtering
- Cadences: one-time, daily, weekly, 1st & 15th, monthly, quarterly, annually
- Transfers between accounts (e.g., checking → credit card payment)
- Per-occurrence overrides: mark paid, move to actual date, or cancel
- Balance replay from starting-balance date (projections stay accurate even if you skip a day)
- Projection chart with combined net-worth line and per-account toggles
- 365-day day-by-day table with per-account or aggregate (income/expense) columns
- Monthly budget targets per expense tag with progress bars
- CSV export, JSON export/import (with optional AES-256-GCM encryption), share via URL link
- Optional multi-device sync via encrypted relay (DynamoDB + Lambda)
- Light / dark / auto theme
- Per-profile date format (MM/DD/YYYY · DD/MM/YYYY · YYYY-MM-DD)
- iPhone-friendly: bottom tab bar, safe-area insets, PWA / Add-to-Home-Screen

## Tech

| Layer    | Stack                                              |
| -------- | -------------------------------------------------- |
| Frontend | React 19, Vite 6, TypeScript 5                     |
| Charts   | Recharts                                           |
| Styling  | Plain CSS with CSS variables                       |
| Storage  | Browser `localStorage` (versioned schema)          |
| Infra    | AWS CDK v2, S3, CloudFront, Route 53, ACM          |
| Sync     | DynamoDB + Lambda + API Gateway v2 (optional)      |

## Development

```bash
npm install
npm run dev
```

Web runs at `http://localhost:5173`.

## Deploy

Requires Node.js 20+, AWS credentials configured locally, and a one-time CDK bootstrap (replace the account ID and region with your own):

```bash
npm install
cd infra/cdk
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
cd ../..
npm run cdk:deploy
```

`npm run cdk:deploy` builds the web app and runs `cdk deploy` in one shot. The stack outputs `DistributionUrl` (the CloudFront URL) and `BucketName`.

### Custom domain

To serve the app from your own domain, pass `domainName` as CDK context. The parent hosted zone (e.g. `goonbits.com` when deploying to `budgetflow.goonbits.com`) must already exist in Route 53 in the same AWS account — it's looked up by name automatically.

```bash
cd infra/cdk
npx cdk deploy -c domainName=budgetflow.example.com
```

If a wildcard cert that covers the domain already exists in the account, pass its ARN to reuse it:

```bash
cd infra/cdk
npx cdk deploy \
  -c domainName=budgetflow.example.com \
  -c certificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID
```

### Sync backend (optional)

To enable multi-device sync, add `-c enableSync=true`. This creates a DynamoDB table, a Lambda function, and an HTTP API — all serverless, ~$0/month at personal scale.

```bash
cd infra/cdk
npx cdk deploy \
  -c domainName=budgetflow.example.com \
  -c certificateArn=... \
  -c enableSync=true
```

Without the flag, BudgetFlow is a purely static site with no backend and no server costs. The sync backend stores only encrypted blobs — all encryption happens client-side with the user's passphrase. The server never sees plaintext.

Data is protected by:
- **Client-side AES-256-GCM** (PBKDF2 200k iterations) — server blob is opaque
- **API key** — stops bots (key is in `config.json`, not a security boundary)
- **Write token** — SHA-256(passphrase + code), prevents overwriting without the passphrase
- **DynamoDB TTL** — inactive sync slots auto-delete after 30 days

In the app, open Settings → Sync devices → Create sync (generates a code + passphrase) or Join sync (enter code + passphrase from your other device). Changes push automatically and pull every 60 seconds + on app open.

### Tear down

The S3 bucket uses `RemovalPolicy.RETAIN` to protect against accidental deletion. To fully remove the stack, empty the bucket first, then:

```bash
cd infra/cdk
npx cdk destroy
```

## License

MIT
