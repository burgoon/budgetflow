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
   * Optional custom domain. When omitted the site is served from the
   * CloudFront distribution's default `*.cloudfront.net` URL.
   *
   * The parent hosted zone is derived from the domain name — e.g.
   * "budgetflow.goonbits.com" → "goonbits.com" — and looked up by name.
   */
  domain?: {
    domainName: string;
    /**
     * Optional ARN of an existing ACM certificate (must be in us-east-1
     * to attach to CloudFront). When provided, the cert is imported and
     * reused. When omitted, a new DNS-validated cert is issued for the
     * domain.
     *
     * Use this to reuse a wildcard cert from a sibling stack — e.g. the
     * Goonbits stack's `*.goonbits.com` cert already covers
     * `budgetflow.goonbits.com`, so minting another one is pointless.
     */
    certificateArn?: string;
  };
}

/**
 * Static hosting stack for the BudgetFlow web app:
 *   S3 bucket (private, OAC-accessed) → CloudFront → optional Route 53 records.
 *
 * CloudFront serves `index.html` for 403/404 so the SPA router (and any
 * future pushState-based navigation) never 404s on a deep link.
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
    let domainNames: string[] | undefined;

    if (props.domain) {
      const parentZoneName = parentZoneOf(props.domain.domainName);
      zone = route53.HostedZone.fromLookup(this, "Zone", {
        domainName: parentZoneName,
      });
      certificate = props.domain.certificateArn
        ? acm.Certificate.fromCertificateArn(
            this,
            "Certificate",
            props.domain.certificateArn,
          )
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
      // Resolved from infra/cdk/lib → ../../../apps/web/dist
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, "..", "..", "..", "apps", "web", "dist"),
        ),
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
      new route53.ARecord(this, "AliasRecord", {
        zone,
        recordName,
        target: aliasTarget,
      });
      new route53.AaaaRecord(this, "AliasRecordV6", {
        zone,
        recordName,
        target: aliasTarget,
      });
    }

    new CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    if (props.domain) {
      new CfnOutput(this, "SiteUrl", {
        value: `https://${props.domain.domainName}`,
      });
    }
    new CfnOutput(this, "BucketName", { value: siteBucket.bucketName });
  }
}

/**
 * Derive the parent hosted-zone name from a full domain.
 *   "budgetflow.goonbits.com" → "goonbits.com"
 *   "goonbits.com"            → "goonbits.com" (apex)
 */
function parentZoneOf(fullDomain: string): string {
  const parts = fullDomain.split(".");
  if (parts.length < 3) return fullDomain;
  return parts.slice(1).join(".");
}

/**
 * Derive the Route 53 record name relative to its zone.
 *   "budgetflow.goonbits.com" in zone "goonbits.com" → "budgetflow"
 *   "goonbits.com"            in zone "goonbits.com" → undefined (apex)
 */
function subdomainOf(fullDomain: string, zoneName: string): string | undefined {
  if (fullDomain === zoneName) return undefined;
  const suffix = "." + zoneName;
  if (fullDomain.endsWith(suffix)) return fullDomain.slice(0, -suffix.length);
  return fullDomain;
}
