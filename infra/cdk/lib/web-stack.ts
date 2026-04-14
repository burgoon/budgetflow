import * as path from "node:path";
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
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface WebStackProps extends StackProps {
  /**
   * Custom domain configuration. When omitted, the site is served from the
   * CloudFront distribution's default `*.cloudfront.net` URL — handy for
   * staging and fine for a shareable link.
   */
  domain?: {
    domainName: string;
    hostedZoneId: string;
    hostedZoneName: string;
  };
}

/**
 * Static hosting stack for the BudgetFlow web app:
 *   S3 bucket (private, OAC-accessed) -> CloudFront distribution -> optional Route53 record.
 *
 * The bucket receives the built `apps/web/dist/` assets on every deploy.
 * CloudFront is configured to serve `index.html` for missing keys so client-side
 * app state (localStorage) and a potential future SPA router don't 404.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
    });

    let certificate: acm.ICertificate | undefined;
    let zone: route53.IHostedZone | undefined;
    if (props.domain) {
      zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
        hostedZoneId: props.domain.hostedZoneId,
        zoneName: props.domain.hostedZoneName,
      });
      // CloudFront requires the ACM cert in us-east-1 regardless of stack region.
      certificate = new acm.DnsValidatedCertificate(this, "SiteCertificate", {
        domainName: props.domain.domainName,
        hostedZone: zone,
        region: "us-east-1",
      });
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
      domainNames: props.domain ? [props.domain.domainName] : undefined,
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new s3deploy.BucketDeployment(this, "DeploySite", {
      // Resolved from infra/cdk → ../../apps/web/dist
      sources: [s3deploy.Source.asset(path.join(__dirname, "..", "..", "..", "apps", "web", "dist"))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });

    if (props.domain && zone) {
      new route53.ARecord(this, "AliasRecord", {
        zone,
        recordName: props.domain.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    new CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    if (props.domain) {
      new CfnOutput(this, "CustomDomainUrl", {
        value: `https://${props.domain.domainName}`,
      });
    }
    new CfnOutput(this, "BucketName", {
      value: siteBucket.bucketName,
    });
  }
}
