param(
  [string]$BackendBaseUrl = "http://localhost:4100",
  [string]$FrontendUrl = "http://localhost:3100",
  [string]$BackendContainer = "cloudshield-frontend-backend-1",
  [string]$WorkerContainer = "cloudshield-frontend-worker-1",
  [string]$ExpectedConnectorMode = "sts-validation",
  [string]$ExpectedInventoryScannerMode = "disabled",
  [string]$ExpectedChangeExecutionMode = "disabled"
)

$ErrorActionPreference = "Stop"

$results = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail
  )

  $results.Add([pscustomobject]@{
    name = $Name
    status = $Status
    detail = $Detail
  })
}

function Get-JsonEndpoint {
  param([string]$Url)

  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
  return @{
    StatusCode = [int]$response.StatusCode
    Body = $response.Content | ConvertFrom-Json
  }
}

function Test-HttpEndpoint {
  param(
    [string]$Name,
    [string]$Url,
    [scriptblock]$ValidateBody
  )

  try {
    $result = Get-JsonEndpoint -Url $Url
    $bodyOk = & $ValidateBody $result.Body
    if ($result.StatusCode -eq 200 -and $bodyOk) {
      Add-Check $Name "PASS" "http=$($result.StatusCode)"
    } else {
      Add-Check $Name "FAIL" "http=$($result.StatusCode)"
    }
  } catch {
    Add-Check $Name "FAIL" "unreachable"
  }
}

function Test-Frontend {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
    if ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400) {
      Add-Check "frontend_http" "PASS" "http=$([int]$response.StatusCode)"
    } else {
      Add-Check "frontend_http" "FAIL" "http=$([int]$response.StatusCode)"
    }
  } catch {
    Add-Check "frontend_http" "FAIL" "unreachable"
  }
}

function Get-ContainerRuntimeProjection {
  param([string]$ContainerName)

  $nodeScript = @'
const env = process.env;
const csvCount = (value) => (value || "").split(",").map((item) => item.trim()).filter(Boolean).length;
const projection = {
  AWS_CONNECTOR_MODE: env.AWS_CONNECTOR_MODE || "",
  AWS_INVENTORY_SCANNER_MODE: env.AWS_INVENTORY_SCANNER_MODE || "",
  AWS_CHANGE_EXECUTION_MODE: env.AWS_CHANGE_EXECUTION_MODE || "",
  AWS_ROLE_ARN_CONFIGURED: Boolean((env.AWS_ROLE_ARN || "").trim()),
  AWS_EXTERNAL_ID_CONFIGURED: Boolean((env.AWS_EXTERNAL_ID || "").trim()),
  AWS_EXECUTOR_ROLE_ARN_CONFIGURED: Boolean((env.AWS_EXECUTOR_ROLE_ARN || "").trim()),
  AWS_EXECUTOR_EXTERNAL_ID_CONFIGURED: Boolean((env.AWS_EXECUTOR_EXTERNAL_ID || "").trim()),
  AWS_ALLOWED_ACCOUNT_IDS_CONFIGURED: csvCount(env.AWS_ALLOWED_ACCOUNT_IDS) > 0,
  AWS_ALLOWED_ACCOUNT_IDS_COUNT: csvCount(env.AWS_ALLOWED_ACCOUNT_IDS),
  AWS_ALLOWED_REGIONS_CONFIGURED: csvCount(env.AWS_ALLOWED_REGIONS) > 0,
  AWS_ALLOWED_REGIONS_COUNT: csvCount(env.AWS_ALLOWED_REGIONS),
  DATABASE_URL_CONFIGURED: Boolean((env.DATABASE_URL || "").trim()),
  REDIS_HOST_CONFIGURED: Boolean((env.REDIS_HOST || "").trim()),
  REDIS_PORT_CONFIGURED: Boolean((env.REDIS_PORT || "").trim()),
  SECRETS_RETURNED: false
};
console.log(JSON.stringify(projection));
'@

  $output = $nodeScript | docker exec -i $ContainerName node
  if ($LASTEXITCODE -ne 0) {
    throw "container runtime projection failed"
  }
  return $output | ConvertFrom-Json
}

function Test-RuntimeProjection {
  param(
    [string]$ContainerName,
    [bool]$RequireDatabaseUrl
  )

  try {
    $runtime = Get-ContainerRuntimeProjection -ContainerName $ContainerName
    $safe =
      $runtime.AWS_CONNECTOR_MODE -eq $ExpectedConnectorMode -and
      $runtime.AWS_INVENTORY_SCANNER_MODE -eq $ExpectedInventoryScannerMode -and
      $runtime.AWS_CHANGE_EXECUTION_MODE -eq $ExpectedChangeExecutionMode -and
      $runtime.AWS_ROLE_ARN_CONFIGURED -eq $true -and
      $runtime.AWS_EXTERNAL_ID_CONFIGURED -eq $true -and
      $runtime.AWS_EXECUTOR_ROLE_ARN_CONFIGURED -eq $false -and
      $runtime.AWS_EXECUTOR_EXTERNAL_ID_CONFIGURED -eq $false -and
      $runtime.AWS_ALLOWED_ACCOUNT_IDS_CONFIGURED -eq $true -and
      $runtime.AWS_ALLOWED_REGIONS_CONFIGURED -eq $true -and
      $runtime.SECRETS_RETURNED -eq $false

    if ($RequireDatabaseUrl) {
      $safe = $safe -and $runtime.DATABASE_URL_CONFIGURED -eq $true
    }

    if ($safe) {
      Add-Check "$ContainerName.runtime_guardrails" "PASS" (
        "connector={0}; scanner={1}; change={2}; roleArnConfigured={3}; externalIdConfigured={4}; executorRoleConfigured={5}; allowedAccountsConfigured={6}; allowedRegionsConfigured={7}; databaseUrlConfigured={8}; redisConfigured={9}; secretsReturned={10}" -f
        $runtime.AWS_CONNECTOR_MODE,
        $runtime.AWS_INVENTORY_SCANNER_MODE,
        $runtime.AWS_CHANGE_EXECUTION_MODE,
        $runtime.AWS_ROLE_ARN_CONFIGURED,
        $runtime.AWS_EXTERNAL_ID_CONFIGURED,
        $runtime.AWS_EXECUTOR_ROLE_ARN_CONFIGURED,
        $runtime.AWS_ALLOWED_ACCOUNT_IDS_CONFIGURED,
        $runtime.AWS_ALLOWED_REGIONS_CONFIGURED,
        $runtime.DATABASE_URL_CONFIGURED,
        ($runtime.REDIS_HOST_CONFIGURED -and $runtime.REDIS_PORT_CONFIGURED),
        $runtime.SECRETS_RETURNED
      )
    } else {
      Add-Check "$ContainerName.runtime_guardrails" "FAIL" (
        "connector={0}; scanner={1}; change={2}; roleArnConfigured={3}; externalIdConfigured={4}; executorRoleConfigured={5}; allowedAccountsConfigured={6}; allowedRegionsConfigured={7}; databaseUrlConfigured={8}; redisConfigured={9}; secretsReturned={10}" -f
        $runtime.AWS_CONNECTOR_MODE,
        $runtime.AWS_INVENTORY_SCANNER_MODE,
        $runtime.AWS_CHANGE_EXECUTION_MODE,
        $runtime.AWS_ROLE_ARN_CONFIGURED,
        $runtime.AWS_EXTERNAL_ID_CONFIGURED,
        $runtime.AWS_EXECUTOR_ROLE_ARN_CONFIGURED,
        $runtime.AWS_ALLOWED_ACCOUNT_IDS_CONFIGURED,
        $runtime.AWS_ALLOWED_REGIONS_CONFIGURED,
        $runtime.DATABASE_URL_CONFIGURED,
        ($runtime.REDIS_HOST_CONFIGURED -and $runtime.REDIS_PORT_CONFIGURED),
        $runtime.SECRETS_RETURNED
      )
    }
  } catch {
    Add-Check "$ContainerName.runtime_guardrails" "FAIL" "container unavailable or runtime projection failed"
  }
}

Write-Host "CloudShield production-readiness preflight"
Write-Host "NO AWS CALL: this script checks local HTTP readiness and sanitized container runtime metadata only."
Write-Host "NO AWS CALL: it does not trigger inventory sync, STS validation, remediation, mutation, Terraform, or raw secret output."
Write-Host ""

Test-HttpEndpoint "backend_health" "$BackendBaseUrl/health" { param($body) $body.status -eq "ok" }
Test-HttpEndpoint "backend_ready_postgres_migrations" "$BackendBaseUrl/ready" { param($body) $body.status -eq "ready" }
Test-Frontend -Url $FrontendUrl
Test-RuntimeProjection -ContainerName $BackendContainer -RequireDatabaseUrl $true
Test-RuntimeProjection -ContainerName $WorkerContainer -RequireDatabaseUrl $true

foreach ($result in $results) {
  Write-Host ("{0}: {1} - {2}" -f $result.status, $result.name, $result.detail)
}

$failed = @($results | Where-Object { $_.status -ne "PASS" })
if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Preflight status: FAILED"
  exit 1
}

Write-Host ""
Write-Host "Preflight status: GREEN"
