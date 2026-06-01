import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_SLUG = "cloudshield-demo-organization";
const blockedReason = "Automatic remediation is disabled in CloudShield v1.";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: {
      name: "CloudShield Demo Organization"
    },
    create: {
      name: "CloudShield Demo Organization",
      slug: DEMO_ORG_SLUG
    }
  });

  const [platformTeam, securityTeam, finopsTeam] = await Promise.all([
    prisma.team.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: "Platform Engineering"
        }
      },
      update: { businessUnit: "Sample demo data" },
      create: {
        organizationId: organization.id,
        name: "Platform Engineering",
        email: "platform-demo@cloudshield.local",
        businessUnit: "Sample demo data"
      }
    }),
    prisma.team.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: "Cloud Security"
        }
      },
      update: { businessUnit: "Sample demo data" },
      create: {
        organizationId: organization.id,
        name: "Cloud Security",
        email: "security-demo@cloudshield.local",
        businessUnit: "Sample demo data"
      }
    }),
    prisma.team.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: "FinOps"
        }
      },
      update: { businessUnit: "Sample demo data" },
      create: {
        organizationId: organization.id,
        name: "FinOps",
        email: "finops-demo@cloudshield.local",
        businessUnit: "Sample demo data"
      }
    })
  ]);

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: "demo@cloudshield.local"
      }
    },
    update: {
      name: "CloudShield Demo User",
      role: "admin"
    },
    create: {
      organizationId: organization.id,
      email: "demo@cloudshield.local",
      name: "CloudShield Demo User",
      role: "admin"
    }
  });

  const [productionAccount, developmentAccount] = await Promise.all([
    prisma.awsAccount.upsert({
      where: {
        organizationId_accountId: {
          organizationId: organization.id,
          accountId: "111111111111"
        }
      },
      update: {
        name: "Production Sample Account",
        status: "CONNECTED",
        ownerTeamId: platformTeam.id
      },
      create: {
        organizationId: organization.id,
        name: "Production Sample Account",
        accountId: "111111111111",
        environment: "prod",
        ownerTeamId: platformTeam.id,
        status: "CONNECTED",
        regions: ["us-east-1", "us-west-2"],
        lastScanAt: new Date(),
        securityScore: 72,
        costScore: 81,
        complianceScore: 68
      }
    }),
    prisma.awsAccount.upsert({
      where: {
        organizationId_accountId: {
          organizationId: organization.id,
          accountId: "222222222222"
        }
      },
      update: {
        name: "Development Sample Account",
        status: "CONNECTED",
        ownerTeamId: platformTeam.id
      },
      create: {
        organizationId: organization.id,
        name: "Development Sample Account",
        accountId: "222222222222",
        environment: "dev",
        ownerTeamId: platformTeam.id,
        status: "CONNECTED",
        regions: ["us-east-1"],
        lastScanAt: new Date(),
        securityScore: 84,
        costScore: 76,
        complianceScore: 74
      }
    })
  ]);

  const demoTags = {
    dataClassification: "Sample demo data",
    source: "CloudShield seed script",
    realAwsResource: false
  };

  const resources = await Promise.all([
    prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId: organization.id,
          awsAccountId: productionAccount.id,
          resourceType: "ec2-instance",
          resourceId: "i-sample001"
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceType: "ec2-instance",
        resourceId: "i-sample001",
        arn: "arn:aws:ec2:us-east-1:111111111111:instance/i-sample001",
        name: "sample-prod-web-01",
        region: "us-east-1",
        status: "running",
        environment: "prod",
        ownerTeamId: platformTeam.id,
        tags: { ...demoTags, environment: "prod", owner: "Platform Engineering" },
        metadata: { instanceType: "t3.large", publicIpAddress: "203.0.113.10", sampleData: true },
        riskCount: 2,
        costSignal: "moderate",
        lastSeenAt: new Date()
      }
    }),
    prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId: organization.id,
          awsAccountId: productionAccount.id,
          resourceType: "s3-bucket",
          resourceId: "sample-prod-logs-bucket"
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceType: "s3-bucket",
        resourceId: "sample-prod-logs-bucket",
        arn: "arn:aws:s3:::sample-prod-logs-bucket",
        name: "sample-prod-logs-bucket",
        region: "us-east-1",
        status: "active",
        environment: "prod",
        ownerTeamId: securityTeam.id,
        tags: { ...demoTags, environment: "prod", owner: "Cloud Security" },
        metadata: { encryptionEnabled: false, versioningEnabled: true, sampleData: true },
        riskCount: 1,
        costSignal: "low",
        lastSeenAt: new Date()
      }
    }),
    prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId: organization.id,
          awsAccountId: productionAccount.id,
          resourceType: "iam-role",
          resourceId: "sample-admin-role"
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceType: "iam-role",
        resourceId: "sample-admin-role",
        arn: "arn:aws:iam::111111111111:role/sample-admin-role",
        name: "sample-admin-role",
        status: "active",
        environment: "prod",
        ownerTeamId: securityTeam.id,
        tags: { ...demoTags, owner: "Cloud Security" },
        metadata: { highPrivilegePolicyIndicator: true, sampleData: true },
        riskCount: 1,
        lastSeenAt: new Date()
      }
    }),
    prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId: organization.id,
          awsAccountId: productionAccount.id,
          resourceType: "security-group",
          resourceId: "sg-sample001"
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceType: "security-group",
        resourceId: "sg-sample001",
        arn: "arn:aws:ec2:us-east-1:111111111111:security-group/sg-sample001",
        name: "sample-open-ssh-sg",
        region: "us-east-1",
        status: "active",
        environment: "prod",
        ownerTeamId: platformTeam.id,
        tags: { ...demoTags, owner: "Platform Engineering" },
        metadata: { inboundRules: [{ port: 22, cidr: "0.0.0.0/0" }], sampleData: true },
        riskCount: 1,
        lastSeenAt: new Date()
      }
    }),
    prisma.cloudResource.upsert({
      where: {
        organizationId_awsAccountId_resourceType_resourceId: {
          organizationId: organization.id,
          awsAccountId: developmentAccount.id,
          resourceType: "ebs-volume",
          resourceId: "vol-sample001"
        }
      },
      update: {},
      create: {
        organizationId: organization.id,
        awsAccountId: developmentAccount.id,
        resourceType: "ebs-volume",
        resourceId: "vol-sample001",
        arn: "arn:aws:ec2:us-east-1:222222222222:volume/vol-sample001",
        name: "sample-unattached-dev-volume",
        region: "us-east-1",
        status: "available",
        environment: "dev",
        ownerTeamId: finopsTeam.id,
        tags: { ...demoTags, environment: "dev" },
        metadata: { encrypted: true, attached: false, sampleData: true },
        riskCount: 1,
        costSignal: "estimated waste",
        lastSeenAt: new Date()
      }
    })
  ]);

  const [ec2, s3Bucket, iamRole, securityGroup, ebsVolume] = resources;

  await Promise.all([
    createRelationship(organization.id, securityGroup.id, ec2.id, "protects"),
    createRelationship(organization.id, ec2.id, iamRole.id, "assumes-role"),
    createRelationship(organization.id, ec2.id, ebsVolume.id, "attached-volume-sample")
  ]);

  const securityFindings = await Promise.all([
    prisma.securityFinding.upsert({
      where: { id: "sample-security-open-ssh" },
      update: {},
      create: {
        id: "sample-security-open-ssh",
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceId: securityGroup.id,
        ruleId: "SG_OPEN_SSH_TO_WORLD",
        title: "Sample demo data - Security group allows SSH from 0.0.0.0/0",
        description: "Sample demo finding showing an internet-exposed SSH rule. Real AWS scanning is not enabled yet.",
        severity: "HIGH",
        status: "OPEN",
        evidence: { sampleData: true, cidr: "0.0.0.0/0", port: 22 },
        businessImpact: "Public SSH exposure can increase unauthorized access risk.",
        recommendation: "Restrict SSH access to approved administrative networks.",
        complianceRefs: ["CIS-inspired network exposure control"],
        ownerTeamId: securityTeam.id,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      }
    }),
    prisma.securityFinding.upsert({
      where: { id: "sample-security-s3-encryption" },
      update: {},
      create: {
        id: "sample-security-s3-encryption",
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceId: s3Bucket.id,
        ruleId: "S3_MISSING_ENCRYPTION",
        title: "Sample demo data - S3 bucket missing encryption",
        description: "Sample demo finding showing encryption at rest posture. Real AWS scanning is not enabled yet.",
        severity: "MEDIUM",
        status: "OPEN",
        evidence: { sampleData: true, encryptionEnabled: false },
        businessImpact: "Unencrypted storage may violate internal cloud governance expectations.",
        recommendation: "Enable default bucket encryption after engineering review.",
        complianceRefs: ["CIS-inspired encryption at rest control"],
        ownerTeamId: securityTeam.id
      }
    }),
    prisma.securityFinding.upsert({
      where: { id: "sample-security-iam-high-privilege" },
      update: {},
      create: {
        id: "sample-security-iam-high-privilege",
        organizationId: organization.id,
        awsAccountId: productionAccount.id,
        resourceId: iamRole.id,
        ruleId: "IAM_ADMIN_POLICY_ATTACHED",
        title: "Sample demo data - IAM role has high privilege policy indicator",
        description: "Sample demo finding showing privileged IAM posture. Real AWS scanning is not enabled yet.",
        severity: "HIGH",
        status: "ACKNOWLEDGED",
        evidence: { sampleData: true, highPrivilegePolicyIndicator: true },
        businessImpact: "Broad permissions can increase blast radius if credentials are misused.",
        recommendation: "Review attached policies and move toward least privilege.",
        complianceRefs: ["SOC2-inspired access governance evidence"],
        ownerTeamId: securityTeam.id
      }
    })
  ]);

  const costFindings = await Promise.all([
    prisma.costFinding.upsert({
      where: { id: "sample-cost-unattached-ebs" },
      update: {},
      create: {
        id: "sample-cost-unattached-ebs",
        organizationId: organization.id,
        awsAccountId: developmentAccount.id,
        resourceId: ebsVolume.id,
        ruleId: "EBS_UNATTACHED",
        title: "Sample demo data - Unattached EBS volume",
        description: "Sample demo cost finding for an unattached EBS volume. Real AWS scanning is not enabled yet.",
        severity: "LOW",
        estimatedMonthlyWaste: 18,
        estimatedAnnualWaste: 216,
        currency: "USD",
        confidence: "medium",
        evidence: { sampleData: true, attached: false },
        recommendation: "Review whether the volume is still required before deleting it manually.",
        status: "OPEN",
        ownerTeamId: finopsTeam.id
      }
    }),
    prisma.costFinding.upsert({
      where: { id: "sample-cost-missing-tags" },
      update: {},
      create: {
        id: "sample-cost-missing-tags",
        organizationId: organization.id,
        awsAccountId: developmentAccount.id,
        resourceId: ebsVolume.id,
        ruleId: "MISSING_OWNER_COST_CENTER_TAGS",
        title: "Sample demo data - Missing owner/cost-center tags",
        description: "Sample demo cost governance finding for missing allocation tags.",
        severity: "INFO",
        estimatedMonthlyWaste: 0,
        estimatedAnnualWaste: 0,
        currency: "USD",
        confidence: "high",
        evidence: { sampleData: true, missingTags: ["owner", "cost-center"] },
        recommendation: "Add required owner and cost-center tags through normal change control.",
        status: "OPEN",
        ownerTeamId: finopsTeam.id
      }
    })
  ]);

  const controls = await Promise.all([
    createControl(organization.id, securityTeam.id, "CS-CIS-NET-001", "Network Exposure Control", "CIS-inspired network exposure control", "FAIL", 1, 1),
    createControl(organization.id, securityTeam.id, "CS-CIS-ENC-001", "Encryption at Rest", "CIS-inspired encryption at rest control", "FAIL", 1, 1),
    createControl(organization.id, securityTeam.id, "CS-SOC2-IAM-001", "IAM Access Governance", "SOC2-inspired access governance evidence", "WARNING", 1, 1),
    createControl(organization.id, finopsTeam.id, "CS-INT-COST-001", "Cost Tagging Hygiene", "Internal cost tagging hygiene control", "WARNING", 1, 1)
  ]);

  await Promise.all(
    controls.map((control) =>
      prisma.complianceEvidence.upsert({
        where: { id: `sample-evidence-${control.controlId.toLowerCase()}` },
        update: {},
        create: {
          id: `sample-evidence-${control.controlId.toLowerCase()}`,
          organizationId: organization.id,
          controlId: control.id,
          status: control.status,
          evidence: { sampleData: true, note: "Sample demo data - real AWS scanning is not enabled yet." },
          evidenceType: control.group,
          source: control.group.includes("SOC2")
            ? "SOC2-inspired evidence"
            : "internal cloud governance evidence"
        }
      })
    )
  );

  await prisma.recommendation.deleteMany({
    where: {
      organizationId: organization.id,
      title: {
        startsWith: "Sample demo data - "
      }
    }
  });

  await Promise.all([
    createRecommendation(organization.id, securityFindings[0].id, null, "Restrict sample SSH ingress", "Limit SSH ingress to approved administrative CIDRs.", "aws ec2 revoke-security-group-ingress --group-id sg-sample001 --protocol tcp --port 22 --cidr 0.0.0.0/0", "resource \"aws_security_group_rule\" \"restricted_ssh_sample\" {\n  type = \"ingress\"\n  from_port = 22\n  to_port = 22\n  protocol = \"tcp\"\n  cidr_blocks = [\"203.0.113.0/24\"]\n}"),
    createRecommendation(organization.id, securityFindings[1].id, null, "Enable sample S3 encryption", "Enable default encryption after review.", "aws s3api put-bucket-encryption --bucket sample-prod-logs-bucket --server-side-encryption-configuration file://encryption.json", "resource \"aws_s3_bucket_server_side_encryption_configuration\" \"sample\" {\n  bucket = \"sample-prod-logs-bucket\"\n}"),
    createRecommendation(organization.id, securityFindings[2].id, null, "Review high privilege sample role", "Review policies and replace broad access with least-privilege permissions.", "aws iam list-attached-role-policies --role-name sample-admin-role", "data \"aws_iam_policy_document\" \"least_privilege_sample\" {\n  statement {\n    actions = [\"s3:GetObject\"]\n    resources = [\"*\"]\n  }\n}"),
    createRecommendation(organization.id, null, costFindings[0].id, "Review unattached sample EBS volume", "Confirm ownership and snapshot requirements before manual cleanup.", "aws ec2 describe-volumes --volume-ids vol-sample001", "# Manual review required before any Terraform removal.\n# CloudShield v1 does not execute Terraform apply."),
    createRecommendation(organization.id, null, costFindings[1].id, "Add sample cost allocation tags", "Add owner and cost-center tags through normal change control.", "aws ec2 create-tags --resources vol-sample001 --tags Key=owner,Value=FinOps Key=cost-center,Value=sample", "resource \"aws_ec2_tag\" \"sample_owner\" {\n  resource_id = \"vol-sample001\"\n  key = \"owner\"\n  value = \"FinOps\"\n}")
  ]);

  await prisma.scanRun.upsert({
    where: { id: "sample-scan-run-foundation" },
    update: {
      status: "COMPLETED",
      completedAt: new Date()
    },
    create: {
      id: "sample-scan-run-foundation",
      organizationId: organization.id,
      awsAccountId: productionAccount.id,
      jobType: "SAMPLE_DEMO_DATA_LOAD",
      status: "COMPLETED",
      phase: "sample demo seed",
      completedAt: new Date(),
      metadata: {
        sampleData: true,
        realAwsScanningEnabled: false
      }
    }
  });

  console.log("Seeded CloudShield sample demo data. Real AWS scanning is not enabled yet.");
}

async function createRelationship(
  organizationId: string,
  sourceResourceId: string,
  targetResourceId: string,
  relationshipType: string
) {
  const existing = await prisma.resourceRelationship.findFirst({
    where: {
      organizationId,
      sourceResourceId,
      targetResourceId,
      relationshipType
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.resourceRelationship.create({
    data: {
      organizationId,
      sourceResourceId,
      targetResourceId,
      relationshipType,
      evidence: { sampleData: true }
    }
  });
}

async function createControl(
  organizationId: string,
  ownerTeamId: string,
  controlId: string,
  group: string,
  title: string,
  status: "PASS" | "FAIL" | "WARNING",
  evidenceCount: number,
  failedResources: number
) {
  return prisma.complianceControl.upsert({
    where: {
      organizationId_controlId: {
        organizationId,
        controlId
      }
    },
    update: {
      group,
      title,
      status,
      evidenceCount,
      failedResources,
      lastScanAt: new Date()
    },
    create: {
      organizationId,
      controlId,
      group,
      title,
      description: `${title}. Sample demo data - real AWS scanning is not enabled yet.`,
      status,
      evidenceCount,
      failedResources,
      lastScanAt: new Date(),
      ownerTeamId
    }
  });
}

async function createRecommendation(
  organizationId: string,
  securityFindingId: string | null,
  costFindingId: string | null,
  title: string,
  description: string,
  cliSuggestion: string,
  terraformSnippet: string
) {
  const existing = await prisma.recommendation.findFirst({
    where: {
      organizationId,
      title
    }
  });

  const data = {
    organizationId,
    securityFindingId,
    costFindingId,
    provider: "aws",
    actionType: "manual_review",
    title: `Sample demo data - ${title}`,
    description: `${description} Real AWS scanning and remediation execution are not enabled yet.`,
    riskReduction: "Reduces sample governance risk after human review.",
    terraformSnippet,
    cliSuggestion,
    manualSteps: [
      "Review the sample finding evidence.",
      "Confirm owner and business impact.",
      "Prepare a reviewed change outside CloudShield.",
      "CloudShield v1 does not execute remediation."
    ],
    blastRadius: "Requires human review. Sample demo data only.",
    rollbackNote: "Rollback must be planned by an engineer before any external change.",
    canExecute: false,
    blockedReason
  };

  if (existing) {
    return prisma.recommendation.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.recommendation.create({ data });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
