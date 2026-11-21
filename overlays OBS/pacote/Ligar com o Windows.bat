@echo off
rem Cria um atalho na pasta Inicializar do Windows: o painel sobe sozinho (minimizado) quando o PC liga.
set "ALVO=%~dp0painel\iniciar-painel.bat"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Painel Overlays Igreja.lnk'); $s.TargetPath='%ALVO%'; $s.Arguments='/inicio'; $s.WorkingDirectory='%~dp0painel'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (echo Nao foi possivel criar o atalho. & pause & exit /b 1)
echo.
echo  Pronto: o painel vai abrir sozinho (minimizado) toda vez que o Windows iniciar.
echo  Para desfazer, use "Desligar do Windows.bat".
echo.
pause
