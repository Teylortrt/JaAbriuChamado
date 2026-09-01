@echo off
setlocal
set "MAVEN_HOME=%~dp0.tools\apache-maven-3.9.11"
if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo Maven local nao encontrado. Execute setup.ps1 uma vez.
  exit /b 1
)
call "%MAVEN_HOME%\bin\mvn.cmd" %*
