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
  /** When true, creates a DynamoDB table + Lambda + HTTP API for the
   *  encrypted-blob sync backend. See README for details. */
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
      zone = route53.HostedZone.fromLookup(this, "Zone", {
        domainName: parentZoneName,
      });
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

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, "..", "..", "..", "apps", "web", "dist")),
      ],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
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

    if (props.enableSync) {
      // Deterministic API key — same value on every synth as long as the
      // stack name doesn't change. Safe to expose in config.json (it's a
      // bot-filter, not a security boundary).
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
          // AWS SDK is available in the Lambda runtime — don't bundle it.
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

      const integration = new HttpLambdaIntegration("SyncIntegration", syncHandler);

      httpApi.addRoutes({
        path: "/sync/{code}",
        methods: [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE],
        integration,
      });

      // Deploy config.json so the frontend knows the sync API URL + key.
      // prune: false so it doesn't nuke the rest of the bucket.
      new s3deploy.BucketDeployment(this, "DeploySyncConfig", {
        destinationBucket: siteBucket,
        sources: [
          s3deploy.Source.jsonData("config.json", {
            syncApiUrl: httpApi.apiEndpoint,
            syncApiKey,
          }),
        ],
        distribution,
        distributionPaths: ["/config.json"],
        prune: false,
      });

      new CfnOutput(this, "SyncApiUrl", { value: httpApi.apiEndpoint! });
      new CfnOutput(this, "SyncTableName", { value: syncTable.tableName });
    }

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
