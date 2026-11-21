@echo off
title Painel do operador - Adventistas Botafogo
cd /d "%~dp0"

rem usa o Node que vem junto no pacote (pasta node\); se nao tiver, usa o instalado
set "NODE=%~dp0..\node\node.exe"
if not exist "%NODE%" set "NODE=node"

rem /inicio = chamado pelo Windows ao ligar o PC: nao abre o navegador
if /i not "%~1"=="/inicio" start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:3030"

"%NODE%" servidor.mjs
if errorlevel 1 pause
