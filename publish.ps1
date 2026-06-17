<#
.SYNOPSIS
    Publish the csv-geocoder widget to GitHub from the local EB install.

.DESCRIPTION
    Syncs the widget folder out of the Experience Builder client/your-extensions/widgets
    directory into this repo, strips node_modules and .vs, commits, and pushes.
    Initializes git and creates the GitHub repo on the first run (via the gh CLI).
    Pass -Release vX.Y.Z to also tag the commit and create a GitHub release with
    a zip of the widget folder attached.

.PARAMETER Release
    Optional release tag (for example v1.0.0). When supplied, the script tags the
    HEAD commit, builds csv-geocoder-<tag>.zip, and creates the GitHub release.

.PARAMETER Message
    Optional commit message. Default: "Sync csv-geocoder from EB <date>".

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1
    Syncs and pushes without creating a release.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\publish.ps1 -Release v1.0.0
    Syncs, pushes, tags, and creates the v1.0.0 release with a zip asset.
#>

[CmdletBinding()]
param(
    [string]$Release,
    [string]$Message
)

# ============================================================================
# Edit these three for each widget repo:
# ============================================================================
$WidgetName = "csv-geocoder"
$RepoName   = "csv-geocoder-widget"
$EBClient   = "C:\arcgis-experience-builder-1.20\client"
# ============================================================================

$ErrorActionPreference = "Stop"
$RepoRoot     = $PSScriptRoot
$WidgetSource = Join-Path $EBClient "your-extensions\widgets\$WidgetName"
$WidgetDest   = Join-Path $RepoRoot $WidgetName

if (-not (Test-Path $WidgetSource)) {
    throw "Widget source not found: $WidgetSource. Edit `$EBClient or `$WidgetName at the top of this script."
}

Push-Location $RepoRoot
try {
    Write-Host "==> Syncing $WidgetName from $WidgetSource"

    # Replace the destination widget folder cleanly.
    if (Test-Path $WidgetDest) {
        Remove-Item -Recurse -Force $WidgetDest
    }
    Copy-Item -Recurse -Force $WidgetSource $WidgetDest

    # Strip cruft that .gitignore/.npmignore handle for git/npm but a
    # right-click 'Send to Compressed folder' would still pick up.
    foreach ($cruft in "node_modules", ".vs", "dist", "build") {
        $p = Join-Path $WidgetDest $cruft
        if (Test-Path $p) {
            Write-Host "    stripping $cruft"
            Remove-Item -Recurse -Force $p
        }
    }

    # Initialize git on first run.
    if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
        Write-Host "==> Initializing git"
        git init | Out-Null
        # Make sure the default branch is main, regardless of git's default.
        git symbolic-ref HEAD refs/heads/main
    }

    # Create the GitHub repo on first run.
    $hasRemote = $false
    try {
        $null = git remote get-url origin 2>$null
        if ($LASTEXITCODE -eq 0) { $hasRemote = $true }
    } catch { $hasRemote = $false }

    if (-not $hasRemote) {
        Write-Host "==> Creating GitHub repo $RepoName"
        gh repo create $RepoName --public --source . --remote origin --description "ArcGIS Experience Builder $WidgetName custom widget"
    }

    # Stage and commit.
    Write-Host "==> Committing"
    git add -A

    # `git diff --cached --quiet` exits 0 if there are no staged changes.
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    no changes to commit"
    } else {
        if (-not $Message) {
            $stamp = (Get-Date -Format "yyyy-MM-dd")
            $Message = "Sync $WidgetName from EB $stamp"
        }
        git commit -m $Message
    }

    # Push.
    Write-Host "==> Pushing to origin/main"
    git push -u origin main

    # Optional release.
    if ($Release) {
        if ($Release -notmatch '^v\d+\.\d+\.\d+') {
            throw "Release tag must look like v1.0.0 (got '$Release')."
        }

        Write-Host "==> Creating release $Release"

        # Tag locally and push the tag.
        $existingTag = git tag --list $Release
        if ($existingTag) {
            throw "Tag $Release already exists. GitHub rejects duplicate tags. Use a new version number."
        }
        git tag $Release
        git push origin $Release

        # Build the release zip from the clean widget subfolder.
        $zipPath = Join-Path $RepoRoot "$WidgetName-$Release.zip"
        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Write-Host "    zipping $WidgetDest -> $zipPath"
        Compress-Archive -Path $WidgetDest -DestinationPath $zipPath -CompressionLevel Optimal

        # Create the GitHub release with the zip attached.
        gh release create $Release $zipPath --title "$WidgetName $Release" --notes "$WidgetName $Release. See README for install steps."
    }

    Write-Host "`n==> Finished."
}
finally {
    Pop-Location
}
