<#
.SYNOPSIS
    Publish the csv-geocoder widget to GitHub from the local EB install.

.DESCRIPTION
    Copies the current widget from ArcGIS Experience Builder 1.21 into this
    repository, excluding dependency, cache, build, and editor folders.

    The destination widget folder is deleted first so old excluded folders
    such as node_modules, .vs, dist, and build cannot remain in the repo copy.

    The script then stages, commits, and pushes changes to GitHub.

    When a release tag is supplied, the script checks that manifest.json and
    package.json agree with each other and with the tag before it publishes
    anything, so a release can never ship a version number nobody bumped.

.PARAMETER Release
    Optional release tag, for example v1.1.0. Must match the version in
    manifest.json and package.json.

.PARAMETER Message
    Optional Git commit message. Also accepted as -CommitMessage.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 `
        -Message "Update CSV Geocoder for EB 1.21"

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 `
        -Message "Update CSV Geocoder for EB 1.21" `
        -Release v1.1.0

.EXAMPLE
    Redo a release. The tag must be deleted first, locally and on GitHub.

        gh release delete v1.1.0 --cleanup-tag --yes
        git tag -d v1.1.0
        powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.1.0
#>

[CmdletBinding()]
param(
    [string]$Release = "",

    [Alias("CommitMessage")]
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

function Get-JsonVersion {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found: $Path"
    }

    $version = (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json).version

    if ([string]::IsNullOrWhiteSpace($version)) {
        throw "$Label has no version field: $Path"
    }

    return $version
}

if (-not (Test-Path -LiteralPath $WidgetSource)) {
    throw "Widget source not found: $WidgetSource"
}

Push-Location $RepoRoot

try {
    Write-Host "==> Repo:   $RepoRoot"
    Write-Host "==> Source: $WidgetSource"
    Write-Host "==> Target: $WidgetDest"

    # ------------------------------------------------------------------------
    # Version check, against the EB source folder because that is the single
    # source of truth. Done before anything is copied or pushed so a mismatch
    # costs nothing to fix.
    # ------------------------------------------------------------------------
    $manifestVersion = Get-JsonVersion (Join-Path $WidgetSource "manifest.json") "manifest.json"
    $packageVersion  = Get-JsonVersion (Join-Path $WidgetSource "package.json")  "package.json"

    Write-Host "`n==> Versions"
    Write-Host "    manifest.json: $manifestVersion"
    Write-Host "    package.json:  $packageVersion"

    if ($manifestVersion -ne $packageVersion) {
        $versionMismatch = "manifest.json is $manifestVersion but package.json is $packageVersion. Bump both together."

        if ([string]::IsNullOrWhiteSpace($Release)) {
            Write-Warning $versionMismatch
        }
        else {
            throw $versionMismatch
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($Release)) {
        if ($Release -notmatch '^v\d+\.\d+\.\d+$') {
            throw "Release tag must look like v1.1.0. Received: $Release"
        }

        if ($Release -ne "v$manifestVersion") {
            throw "Release tag $Release does not match the widget version $manifestVersion. Edit manifest.json and package.json in the EB folder, or pass -Release v$manifestVersion."
        }
    }

    Write-Host "`n==> Removing old repo widget copy"

    if (Test-Path -LiteralPath $WidgetDest) {
        Remove-Item -LiteralPath $WidgetDest -Recurse -Force
    }

    New-Item -ItemType Directory -Path $WidgetDest -Force | Out-Null

    Write-Host "==> Copying widget files"

    # "Claude outputs" is the working folder Cowork writes deliverables and zips
    # into. It lives in the EB widget folder and must never ship.
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
        "Claude outputs"
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
        (Join-Path $WidgetDest "Claude outputs")
    )

    foreach ($excludedPath in $excludedPaths) {
        if (Test-Path -LiteralPath $excludedPath) {
            Write-Host "    Removing excluded path: $excludedPath"
            Remove-Item -LiteralPath $excludedPath -Recurse -Force
        }
    }

    # The manifest has to sit directly inside the widget folder. A second level
    # of nesting is the most common downstream install failure.
    if (-not (Test-Path -LiteralPath (Join-Path $WidgetDest "manifest.json"))) {
        throw "manifest.json is not directly inside $WidgetDest. The copy is wrong; do not publish it."
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
        Write-Host "    $($Message.Split("`n")[0])"

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
        $ghCommand = Get-Command gh -ErrorAction SilentlyContinue

        if (-not $ghCommand) {
            throw "GitHub CLI 'gh' is required to create a release."
        }

        $existingLocalTag = git tag --list $Release

        if (-not [string]::IsNullOrWhiteSpace($existingLocalTag)) {
            throw "Local tag $Release already exists. Remove it with: git tag -d $Release"
        }

        $existingRemoteTag = git ls-remote --tags origin "refs/tags/$Release"

        if (-not [string]::IsNullOrWhiteSpace($existingRemoteTag)) {
            throw "Remote tag $Release already exists. Remove it with: gh release delete $Release --cleanup-tag --yes"
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

        # Zips the cleaned repo copy, never the live EB folder, so the archive
        # contains a single <widget-name> folder with manifest.json inside it.
        Compress-Archive `
            -Path $WidgetDest `
            -DestinationPath $zipPath `
            -CompressionLevel Optimal

        $releaseNotes = @"
Download $WidgetName-$Release.zip, extract it, and drop the $WidgetName folder into client\your-extensions\widgets so manifest.json sits directly inside it, not a second level deep.

Then install dependencies from the client folder and restart the client:

- Experience Builder 1.20 and earlier: npm install
- Experience Builder 1.21 and later: pnpm install

See README.md for configuration and CHANGELOG.md for what changed in this version.
"@

        gh release create $Release `
            $zipPath `
            --title "$WidgetName $Release" `
            --notes $releaseNotes

        Assert-CommandSucceeded "gh release create"

        Write-Host "`n    Release published."
        Write-Host "    Esri Community attachment: $zipPath"
    }

    Write-Host "`n==> Finished successfully."
}
finally {
    Pop-Location
}