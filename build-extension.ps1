[CmdletBinding()]
param(
	[switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectDirectory = $PSScriptRoot
$distDirectory = Join-Path $projectDirectory "dist"
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("nb-clipper-build-" + [guid]::NewGuid().ToString("N"))
$chromeStage = Join-Path $temporaryRoot "chrome"
$firefoxStage = Join-Path $temporaryRoot "firefox"
$chromeArchive = Join-Path $distDirectory "nb-clipper-chrome.zip"
$firefoxArchive = Join-Path $distDirectory "nb-clipper-firefox.zip"

function Invoke-CheckedCommand {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Command,

		[Parameter(Mandatory = $true)]
		[string[]]$Arguments
	)

	& $Command @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "$Command failed with exit code $LASTEXITCODE."
	}
}

function Copy-ExtensionFiles {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Destination
	)

	New-Item -ItemType Directory -Path $Destination | Out-Null
	Copy-Item -LiteralPath (Join-Path $projectDirectory "manifest.json") -Destination $Destination
	Copy-Item -LiteralPath (Join-Path $projectDirectory "lib") -Destination $Destination -Recurse
	Copy-Item -LiteralPath (Join-Path $projectDirectory "_locales") -Destination $Destination -Recurse
	Copy-Item -LiteralPath (Join-Path $projectDirectory "src") -Destination $Destination -Recurse
}

function Compress-Stage {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Stage,

		[Parameter(Mandatory = $true)]
		[string]$Archive
	)

	if (Test-Path -LiteralPath $Archive) {
		Remove-Item -LiteralPath $Archive -Force
	}

	Add-Type -AssemblyName System.IO.Compression
	Add-Type -AssemblyName System.IO.Compression.FileSystem

	$archiveStream = [IO.File]::Open($Archive, [IO.FileMode]::CreateNew)
	try {
		$zip = [IO.Compression.ZipArchive]::new(
			$archiveStream,
			[IO.Compression.ZipArchiveMode]::Create,
			$false
		)
		try {
			$stageRoot = [IO.Path]::GetFullPath($Stage).TrimEnd("\", "/") + [IO.Path]::DirectorySeparatorChar
			foreach ($file in Get-ChildItem -LiteralPath $Stage -File -Recurse) {
				$entryName = $file.FullName.Substring($stageRoot.Length).Replace("\", "/")
				[IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
					$zip,
					$file.FullName,
					$entryName,
					[IO.Compression.CompressionLevel]::Optimal
				) | Out-Null
			}
		}
		finally {
			$zip.Dispose()
		}
	}
	finally {
		$archiveStream.Dispose()
	}
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
	throw "npm.cmd was not found. Install Node.js before running this script."
}

if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
	throw "npx.cmd was not found. Install Node.js before running this script."
}

try {
	Push-Location $projectDirectory
	try {
		if (-not $SkipInstall) {
			Invoke-CheckedCommand "npm.cmd" @("ci")
		}
		Invoke-CheckedCommand "npx.cmd" @("rollup", "-c", "rollup.config.js")
	}
	finally {
		Pop-Location
	}

	New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null
	New-Item -ItemType Directory -Path $temporaryRoot | Out-Null

	Copy-ExtensionFiles $chromeStage
	Copy-ExtensionFiles $firefoxStage

	# Chrome ignores Firefox-only extension metadata more gracefully when it is
	# omitted from the packaged manifest.
	$chromeManifestPath = Join-Path $chromeStage "manifest.json"
	$chromeManifest = Get-Content -LiteralPath $chromeManifestPath -Raw | ConvertFrom-Json
	$chromeManifest.PSObject.Properties.Remove("sidebar_action")
	$chromeManifest.PSObject.Properties.Remove("browser_specific_settings")
	$chromeManifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $chromeManifestPath -Encoding UTF8

	# Firefox uses the web authentication flow selected by the original Unix
	# packaging script. Change only the staged copy.
	$firefoxConfigPath = Join-Path $firefoxStage "src\core\bg\config.js"
	$firefoxConfig = Get-Content -LiteralPath $firefoxConfigPath -Raw
	if (-not $firefoxConfig.Contains("forceWebAuthFlow: false")) {
		throw "The expected Firefox authentication setting was not found."
	}
	$firefoxConfig.Replace("forceWebAuthFlow: false", "forceWebAuthFlow: true") |
		Set-Content -LiteralPath $firefoxConfigPath -Encoding UTF8

	Compress-Stage $chromeStage $chromeArchive
	Compress-Stage $firefoxStage $firefoxArchive

	Write-Host ""
	Write-Host "Built browser packages:"
	Write-Host "  $chromeArchive"
	Write-Host "  $firefoxArchive"
}
finally {
	$resolvedTempRoot = [IO.Path]::GetFullPath($temporaryRoot)
	$systemTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
	if (
		(Test-Path -LiteralPath $resolvedTempRoot) -and
		$resolvedTempRoot.StartsWith($systemTempRoot, [StringComparison]::OrdinalIgnoreCase) -and
		([IO.Path]::GetFileName($resolvedTempRoot)).StartsWith("nb-clipper-build-", [StringComparison]::Ordinal)
	) {
		Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
	}
}
