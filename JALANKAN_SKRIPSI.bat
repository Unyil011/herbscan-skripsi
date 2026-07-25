@echo off
echo ========================================================
echo   MENYALAKAN SISTEM SPICEGUARD AI (SKRIPSI RIVALRAM)
echo ========================================================
echo.
echo [1] Menyambungkan ke Database dan AI Gemini...
echo [2] Membuka Website di Browser...
echo.

:: Pindah ke folder backend
cd backend

:: Buka website frontend di browser default
start "" "..\frontend\index.html"

:: Jalankan server backend FastAPI
python -m uvicorn main:app --port 8000

:: python -m uvicorn main:app --reload untuk development mode