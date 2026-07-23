<#
.SYNOPSIS
    Publish the csv-geocoder widget to GitHub from the local EB install.

.DESCRIPTION
    Copies the current widget from ArcGIS Experience Builder 1.21 into this
    repository, excluding dependency, cache, build, and editor folders.

    The destination widget folder is deleted first so old excluded folders
    such as node_modules, .vs, dist, and build cannot remain in the repo copy.

    The script then stages, commits, and pushes changes to GitHub.

.PARAMETER Release
    Optional release tag, for example v1.0.2.

.PARAMETER Message
    Optional Git commit message.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 `
        -Message "Update CSV Geocoder for EB 1.21"

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 `
        -Message "Update CSV Geocoder for EB 1.21" `
        -Release v1.0.2
#>

[CmdletBinding()]
param(
    [string]$Release = "",
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Widget settings
# ============================================================================
$WidgetName = "csv-geocoder"
$RepoName   = "csv-geocoder-widget"
$EBClient   = "C:\arcgis-experience-builder-1.21\client"
# ============================================================================

$RepoRoot     = $PSScriptRoot
$WidgetSource = Join-Path $EBClient "your-extensions\widgets\$WidgetName"
$WidgetDest   = Join-Path $RepoRoot $WidgetName

function Assert-CommandSucceeded {
    param(
        [string]$CommandName,
        [int[]]$SuccessCodes = @(0)
    )

    if ($SuccessCodes -notcontains $LASTEXITCODE) {
        throw "$CommandName failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath $WidgetSource)) {
    throw "Widget source not found: $WidgetSource"
}

Push-Location $RepoRoot

try {
    Write-Host "==> Repo:   $RepoRoot"
    Write-Host "==> Source: $WidgetSource"
    Write-Host "==> Target: $WidgetDest"

    Write-Host "`n==> Removing old repo widget copy"

    if (Test-Path -LiteralPath $WidgetDest) {
        Remove-Item -LiteralPath $WidgetDest -Recurse -Force
    }

    New-Item -ItemType Directory -Path $WidgetDest -Force | Out-Null

    Write-Host "==> Copying widget files"

    $robocopyArgs = @(
        $WidgetSource
        $WidgetDest
        "/E"
        "/XD"
        "node_modules"
        ".vs"
        "dist"
        "build"
        ".git"
        ".idea"
        ".vscode"
        "coverage"
        "/XF"
        "*.user"
        "*.suo"
        "*.tmp"
        "*.log"
        "*.zip"
        "Thumbs.db"
        ".DS_Store"
        "/R:2"
        "/W:1"
        "/NFL"
        "/NDL"
        "/NJH"
        "/NJS"
        "/NP"
    )

    & robocopy @robocopyArgs | Out-Null
    $robocopyExitCode = $LASTEXITCODE

    # Robocopy exit codes 0 through 7 are successful.
    if ($robocopyExitCode -ge 8) {
        throw "Robocopy failed with exit code $robocopyExitCode."
    }

    Write-Host "    Widget copy completed."

    Write-Host "`n==> Verifying excluded folders"

    $excludedPaths = @(
        (Join-Path $WidgetDest "node_modules")
        (Join-Path $WidgetDest ".vs")
        (Join-Path $WidgetDest "dist")
        (Join-Path $WidgetDest "build")
        (Join-Path $WidgetDest ".git")
        (Join-Path $WidgetDest ".idea")
        (Join-Path $WidgetDest ".vscode")
        (Join-Path $WidgetDest "coverage")
    )

    foreach ($excludedPath in $excludedPaths) {
        if (Test-Path -LiteralPath $excludedPath) {
            Write-Host "    Removing excluded path: $excludedPath"
            Remove-Item -LiteralPath $excludedPath -Recurse -Force
        }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
        Write-Host "`n==> Initializing Git repository"

        git init
        Assert-CommandSucceeded "git init"

        git branch -M main
        Assert-CommandSucceeded "git branch -M main"
    }

    git remote get-url origin 2>$null | Out-Null
    $hasOrigin = $LASTEXITCODE -eq 0

    if (-not $hasOrigin) {
        $ghCommand = Get-Command gh -ErrorAction SilentlyContinue

        if (-not $ghCommand) {
            throw "No GitHub origin exists and the GitHub CLI is not installed."
        }

        Write-Host "`n==> Creating GitHub repository $RepoName"

        gh repo create $RepoName `
            --public `
            --source "." `
            --remote origin `
            --description "ArcGIS Experience Builder $WidgetName custom widget"

        Assert-CommandSucceeded "gh repo create"
    }

    Write-Host "`n==> Staging changes"

    git add -A
    Assert-CommandSucceeded "git add"

    git diff --cached --quiet
    $diffExitCode = $LASTEXITCODE

    if ($diffExitCode -eq 0) {
        Write-Host "    No changes to commit."
    }
    elseif ($diffExitCode -eq 1) {
        if ([string]::IsNullOrWhiteSpace($Message)) {
            $Message = "Sync $WidgetName from EB $(Get-Date -Format 'yyyy-MM-dd')"
        }

        Write-Host "`n==> Committing changes"
        Write-Host "    $Message"

        git commit -m "$Message"
        Assert-CommandSucceeded "git commit"
    }
    else {
        throw "git diff failed with exit code $diffExitCode."
    }

    Write-Host "`n==> Pushing to origin/main"

    git push -u origin main
    Assert-CommandSucceeded "git push"

    if (-not [string]::IsNullOrWhiteSpace($Release)) {
        if ($Release -notmatch '^v\d+\.\d+\.\d+$') {
            throw "Release tag must look like v1.0.2. Received: $Release"
        }

        $ghCommand = Get-Command gh -ErrorAction SilentlyContinue

        if (-not $ghCommand) {
            throw "GitHub CLI 'gh' is required to create a release."
        }

        $existingLocalTag = git tag --list $Release

        if (-not [string]::IsNullOrWhiteSpace($existingLocalTag)) {
            throw "Local tag $Release already exists."
        }

        $existingRemoteTag = git ls-remote --tags origin "refs/tags/$Release"

        if (-not [string]::IsNullOrWhiteSpace($existingRemoteTag)) {
            throw "Remote tag $Release already exists."
        }

        Write-Host "`n==> Creating release $Release"

        git tag $Release
        Assert-CommandSucceeded "git tag"

        git push origin $Release
        Assert-CommandSucceeded "git push tag"

        $zipPath = Join-Path $RepoRoot "$WidgetName-$Release.zip"

        if (Test-Path -LiteralPath $zipPath) {
            Remove-Item -LiteralPath $zipPath -Force
        }

        Write-Host "    Creating release ZIP: $zipPath"

        Compress-Archive `
            -Path $WidgetDest `
            -DestinationPath $zipPath `
            -CompressionLevel Optimal

        gh release create $Release `
            $zipPath `
            --title "$WidgetName $Release" `
            --notes "$WidgetName $Release. See README for installation instructions."

        Assert-CommandSucceeded "gh release create"
    }

    Write-Host "`n==> Finished successfully."
}
finally {
    Pop-Location
}