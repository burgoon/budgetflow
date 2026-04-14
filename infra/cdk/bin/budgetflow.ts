#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

// Optional custom domain:
//   cdk deploy -c domainName=budgetflow.goonbits.com \
//              -c certificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID
//
// When `certificateArn` is omitted the stack mints a new DNS-validated cert
// for the domain. Reuse an existing wildcard cert when you have one (e.g.
// the `*.goonbits.com` cert produced by the Goonbits stack).
const domainName = app.node.tryGetContext("domainName") as string | undefined;
const certificateArn = app.node.tryGetContext("certificateArn") as
  | string
  | undefined;

new WebStack(app, "BudgetFlowWeb", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  domain: domainName ? { domainName, certificateArn } : undefined,
});
