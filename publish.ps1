[CmdletBinding()]
param(
    [string]$Release = "",
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$WidgetName = "csv-geocoder"
$RepoName   = "csv-geocoder-widget"
$EBClient   = "C:\arcgis-experience-builder-1.21\client"

$RepoRoot     = $PSScriptRoot
$WidgetSource = Join-Path $EBClient "your-extensions\widgets\$WidgetName"
$WidgetDest   = Join-Path $RepoRoot $WidgetName

if (-not (Test-Path $WidgetSource)) {
    throw "Widget source not found: $WidgetSource"
}

Push-Location $RepoRoot

try {
    Write-Host "==> Syncing $WidgetName from $WidgetSource"

    if (-not (Test-Path $WidgetDest)) {
        New-Item -ItemType Directory -Path $WidgetDest -Force | Out-Null
    }

    robocopy `
        "$WidgetSource" `
        "$WidgetDest" `
        /MIR `
        /XD node_modules .vs dist build .git `
        /XF *.user *.suo *.tmp `
        /R:2 `
        /W:1 `
        /NFL `
        /NDL `
        /NJH `
        /NJS `
        /NP | Out-Null

    $robocopyCode = $LASTEXITCODE

    if ($robocopyCode -ge 8) {
        throw "Robocopy failed with exit code $robocopyCode"
    }

    Write-Host "==> Widget files copied"

    if (-not (Test-Path ".git")) {
        git init
        git branch -M main
    }

    git remote get-url origin 2>$null | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Host "==> Creating GitHub repository"
        gh repo create $RepoName --public --source "." --remote origin --description "ArcGIS Experience Builder $WidgetName custom widget"
    }

    git add -A

    git diff --cached --quiet
    $hasNoChanges = $LASTEXITCODE -eq 0

    if ($hasNoChanges) {
        Write-Host "==> No changes to commit"
    }
    else {
        if ([string]::IsNullOrWhiteSpace($Message)) {
            $Message = "Sync $WidgetName from EB $(Get-Date -Format 'yyyy-MM-dd')"
        }

        Write-Host "==> Committing changes"
        git commit -m "$Message"
    }

    Write-Host "==> Pushing to GitHub"
    git push -u origin main

    if (-not [string]::IsNullOrWhiteSpace($Release)) {
        if ($Release -notmatch '^v\d+\.\d+\.\d+$') {
            throw "Release must look like v1.0.2"
        }

        $zipPath = Join-Path $RepoRoot "$WidgetName-$Release.zip"

        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }

        Compress-Archive -Path $WidgetDest -DestinationPath $zipPath -CompressionLevel Optimal

        git tag $Release
        git push origin $Release

        gh release create $Release $zipPath `
            --title "$WidgetName $Release" `
            --notes "$WidgetName $Release. See README for installation instructions."
    }

    Write-Host "==> Finished successfully"
}
finally {
    Pop-Location
}
