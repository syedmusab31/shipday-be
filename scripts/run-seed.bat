@echo off
echo ========================================
echo Dummy Shipment Data Seeding Script
echo ========================================
echo.
echo This script will populate your database with sample shipment data.
echo Press Ctrl+C to cancel.
echo.
pause

echo.
echo Running seeding script...
node seedShipments.js

echo.
echo ========================================
echo Script execution completed
echo ========================================
pause