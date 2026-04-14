# BudgetFlow

Personal cashflow projection in the browser. Add your accounts and starting balances, define recurring (or one-time) income and expenses, and see how each account's balance evolves on a chart and in a day-by-day table for the next 365 days. All data lives in your browser's local storage — no backend, no account, nothing leaves the device.

- Multiple profiles (you, partner, household)
- Checking, savings, and credit accounts
- Cadences: one-time, daily, weekly, 1st & 15th, monthly, annually
- Projection chart with combined net-worth line and per-account toggles
- 365-day day-by-day table with per-day income/expense tags
- CSV export
- Light / dark / auto theme
- Per-profile date format (MM/DD/YYYY · DD/MM/YYYY · YYYY-MM-DD)
- iPhone-friendly: bottom tab bar, safe-area insets, PWA / Add-to-Home-Screen support

## Tech

| Layer    | Stack                                              |
| -------- | -------------------------------------------------- |
| Frontend | React 19, Vite 6, TypeScript 5                     |
| Charts   | Recharts                                           |
| Styling  | Plain CSS with CSS variables                       |
| Storage  | Browser `localStorage` (versioned schema)          |
| Infra    | AWS CDK v2, S3, CloudFront, Route 53, ACM          |

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

By default a new DNS-validated ACM certificate is minted for the domain. If a wildcard cert that covers the domain already exists in the account (e.g. a sibling stack's `*.example.com`), pass its ARN to reuse it instead of minting another:

```bash
cd infra/cdk
npx cdk deploy \
  -c domainName=budgetflow.example.com \
  -c certificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID
```

The certificate must be in `us-east-1` to attach to CloudFront. The stack creates both A and AAAA (IPv6) alias records pointing at the distribution.

### Tear down

The S3 bucket uses `RemovalPolicy.RETAIN` to protect against accidental deletion of the deployed app. To fully remove the stack, empty the bucket first, then:

```bash
cd infra/cdk
npx cdk destroy
```

## License

MIT
