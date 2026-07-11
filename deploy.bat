@echo off
REM ============================================
REM  HUNTER - Deploy automatico
REM  Uso:  deploy.bat "messaggio del commit"
REM ============================================

cd /d C:\Users\rinal\OneDrive\Desktop\Hunter

echo.
echo === HUNTER DEPLOY ===
echo.

REM --- 1) se c'e' il file nuovo scaricato, lo mette al posto giusto ---
if exist "%USERPROFILE%\Downloads\hunter-index.html" (
    echo Trovato hunter-index.html in Downloads: lo installo...
    if exist index.html del /q index.html
    move /y "%USERPROFILE%\Downloads\hunter-index.html" index.html >nul
    echo    file installato.
) else (
    if exist hunter-index.html (
        echo Trovato hunter-index.html nella cartella: lo rinomino...
        if exist index.html del /q index.html
        ren hunter-index.html index.html
        echo    file rinominato.
    ) else (
        echo Nessun file nuovo da installare, uso index.html esistente.
    )
)

REM --- 2) mostra la versione che sta per pubblicare ---
echo.
echo Versione nel file:
findstr /C:"APP_VERSION = " index.html

REM --- 3) commit e push ---
echo.
set MSG=%~1
if "%MSG%"=="" set MSG=aggiornamento Hunter

git add .
git commit -m "%MSG%"
git push

echo.
echo === FATTO ===
echo Sito: https://rinaldocardaci08-afk.github.io/Hunter/
echo Sul telefono: apri l'app e premi "Aggiorna app" nel menu.
echo.
pause
