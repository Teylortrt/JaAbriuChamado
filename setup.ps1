$ErrorActionPreference = 'Stop'
$mavenVersion = '3.9.11'
$toolsDir = Join-Path $PSScriptRoot '.tools'
$mavenDir = Join-Path $toolsDir "apache-maven-$mavenVersion"

if (-not (Test-Path (Join-Path $mavenDir 'bin\mvn.cmd'))) {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $zipFile = Join-Path $toolsDir "apache-maven-$mavenVersion-bin.zip"
    Invoke-WebRequest "https://archive.apache.org/dist/maven/maven-3/$mavenVersion/binaries/apache-maven-$mavenVersion-bin.zip" -OutFile $zipFile
    Expand-Archive -Path $zipFile -DestinationPath $toolsDir -Force
    Remove-Item -LiteralPath $zipFile
}

Write-Host 'Maven local pronto. Agora execute: .\mvnw.cmd spring-boot:run'
