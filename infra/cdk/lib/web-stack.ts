import * as path from "node:path";
import { createHash } from "node:crypto";
import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  CfnOutput,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_certificatemanager as acm,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";

export interface WebStackProps extends StackProps {
  domain?: {
    domainName: string;
    certificateArn?: string;
  };
  enableSync?: boolean;
}

export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // ---- Static site (S3 + CloudFront) ----

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
    });

    let certificate: acm.ICertificate | undefined;
    let zone: route53.IHostedZone | undefined;
    let domainNames: string[] | undefined;

    if (props.domain) {
      const parentZoneName = parentZoneOf(props.domain.domainName);
      zone = route53.HostedZone.fromLookup(this, "Zone", { domainName: parentZoneName });
      certificate = props.domain.certificateArn
        ? acm.Certificate.fromCertificateArn(this, "Certificate", props.domain.certificateArn)
        : new acm.Certificate(this, "Certificate", {
            domainName: props.domain.domainName,
            validation: acm.CertificateValidation.fromDns(zone),
          });
      domainNames = [props.domain.domainName];
    }

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
      domainNames,
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    if (props.domain && zone) {
      const recordName = subdomainOf(props.domain.domainName, zone.zoneName);
      const aliasTarget = route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      );
      new route53.ARecord(this, "AliasRecord", { zone, recordName, target: aliasTarget });
      new route53.AaaaRecord(this, "AliasRecordV6", { zone, recordName, target: aliasTarget });
    }

    // ---- Sync backend (optional) ----
    // Created BEFORE the bucket deployment so the API URL can be baked
    // into config.json as part of the same deployment — avoiding a race
    // condition where prune: true on the main deployment deletes config.json.

    const deploymentSources: s3deploy.ISource[] = [
      s3deploy.Source.asset(path.join(__dirname, "..", "..", "..", "apps", "web", "dist")),
    ];

    if (props.enableSync) {
      const syncApiKey = createHash("sha256")
        .update(`${this.stackName}:sync-api-key`)
        .digest("base64url")
        .substring(0, 32);

      const syncTable = new dynamodb.Table(this, "SyncTable", {
        partitionKey: { name: "code", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
        timeToLiveAttribute: "expiresAt",
      });

      const syncHandler = new NodejsFunction(this, "SyncHandler", {
        entry: path.join(__dirname, "..", "..", "..", "services", "api", "src", "handler.ts"),
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        environment: {
          TABLE_NAME: syncTable.tableName,
          API_KEY: syncApiKey,
        },
        memorySize: 128,
        timeout: Duration.seconds(10),
        bundling: {
          externalModules: ["@aws-sdk/*"],
        },
      });

      syncTable.grantReadWriteData(syncHandler);

      const httpApi = new HttpApi(this, "SyncApi", {
        corsPreflight: {
          allowOrigins: ["*"],
          allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.PUT, CorsHttpMethod.DELETE],
          allowHeaders: ["content-type", "x-api-key", "x-write-token"],
        },
      });

      httpApi.addRoutes({
        path: "/sync/{code}",
        methods: [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE],
        integration: new HttpLambdaIntegration("SyncIntegration", syncHandler),
      });

      // Include config.json in the SAME deployment as the site so
      // prune: true doesn't delete it.
      deploymentSources.push(
        s3deploy.Source.jsonData("config.json", {
          syncApiUrl: httpApi.apiEndpoint,
          syncApiKey,
        }),
      );

      new CfnOutput(this, "SyncApiUrl", { value: httpApi.apiEndpoint! });
      new CfnOutput(this, "SyncTableName", { value: syncTable.tableName });
    }

    // ---- Single bucket deployment (site + optional config.json) ----

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: deploymentSources,
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    // ---- Outputs ----

    new CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    if (props.domain) {
      new CfnOutput(this, "SiteUrl", { value: `https://${props.domain.domainName}` });
    }
    new CfnOutput(this, "BucketName", { value: siteBucket.bucketName });
  }
}

function parentZoneOf(fullDomain: string): string {
  const parts = fullDomain.split(".");
  if (parts.length < 3) return fullDomain;
  return parts.slice(1).join(".");
}

function subdomainOf(fullDomain: string, zoneName: string): string | undefined {
  if (fullDomain === zoneName) return undefined;
  const suffix = "." + zoneName;
  if (fullDomain.endsWith(suffix)) return fullDomain.slice(0, -suffix.length);
  return fullDomain;
}
