@echo off
cd /d "C:\Users\OHK20250617\Desktop\UGA\phase 8\backend"
call npm test > "C:\Users\OHK20250617\Desktop\UGA\phase 8\test-results.txt" 2>&1
echo EXITCODE=%ERRORLEVEL% >> "C:\Users\OHK20250617\Desktop\UGA\phase 8\test-results.txt"