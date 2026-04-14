#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { WebStack } from "../lib/web-stack";

const app = new cdk.App();

// Optional custom domain: pass via CDK context
//   cdk deploy -c domainName=budgetflow.example.com -c hostedZoneId=Z123 -c hostedZoneName=example.com
const domainName = app.node.tryGetContext("domainName") as string | undefined;
const hostedZoneId = app.node.tryGetContext("hostedZoneId") as string | undefined;
const hostedZoneName = app.node.tryGetContext("hostedZoneName") as string | undefined;

new WebStack(app, "BudgetFlowWeb", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  domain:
    domainName && hostedZoneId && hostedZoneName
      ? { domainName, hostedZoneId, hostedZoneName }
      : undefined,
});
