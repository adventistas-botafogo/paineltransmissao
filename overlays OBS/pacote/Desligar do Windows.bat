@echo off
rem Remove o atalho criado por "Ligar com o Windows.bat".
powershell -NoProfile -Command "Remove-Item -LiteralPath ([Environment]::GetFolderPath('Startup')+'\Painel Overlays Igreja.lnk') -ErrorAction SilentlyContinue"
echo.
echo  Pronto: o painel nao abre mais sozinho com o Windows.
echo.
pause
