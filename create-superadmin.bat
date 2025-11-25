@echo off
REM Create Superadmin Account Script
REM Run this after starting your backend server

echo Creating superadmin account...
echo.

curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\": \"superadmin@example.com\", \"password\": \"superadmin123\", \"full_name\": \"Super Administrator\", \"role\": \"superadmin\"}"

echo.
echo.
echo ======================================
echo Superadmin Account Created!
echo ======================================
echo Email: superadmin@example.com
echo Password: superadmin123
echo.
echo You can now login at:
echo http://localhost:3001/login
echo ======================================

pause
