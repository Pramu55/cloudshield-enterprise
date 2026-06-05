-- Correct relationship source classification after adding relationship provenance.
-- Existing relationships that touch sample resources must not be labeled as real AWS inventory.

UPDATE "ResourceRelationship" AS rr
SET "sourceClassification" = 'SAMPLE'
FROM "CloudResource" AS source_resource,
     "CloudResource" AS target_resource
WHERE source_resource."id" = rr."sourceResourceId"
  AND target_resource."id" = rr."targetResourceId"
  AND (
    source_resource."source" = 'SAMPLE'
    OR target_resource."source" = 'SAMPLE'
  );

ALTER TABLE "ResourceRelationship"
  ALTER COLUMN "sourceClassification" SET DEFAULT 'SYSTEM';
