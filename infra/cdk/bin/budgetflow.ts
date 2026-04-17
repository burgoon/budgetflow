#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

// Optional custom domain:
//   cdk deploy -c domainName=budgetflow.goonbits.com \
//              -c certificateArn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID
//
// Optional sync backend:
//   cdk deploy -c enableSync=true
//
// Creates a DynamoDB table + Lambda + HTTP API for encrypted-blob sync.
// Without this flag, the app is static-only (no backend, no server cost).
const domainName = app.node.tryGetContext("domainName") as string | undefined;
const certificateArn = app.node.tryGetContext("certificateArn") as string | undefined;
const enableSync = app.node.tryGetContext("enableSync") === "true" ||
  app.node.tryGetContext("enableSync") === true;

new WebStack(app, "BudgetFlowWeb", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  domain: domainName ? { domainName, certificateArn } : undefined,
  enableSync,
});
