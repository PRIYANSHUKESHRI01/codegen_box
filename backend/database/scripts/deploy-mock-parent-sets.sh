#!/bin/bash
# AptRun Production Deployment Script for Mock AI Interview 5 Parent Sets
# Usage: ./backend/database/scripts/deploy-mock-parent-sets.sh

set -e

echo "=== [1/3] Running Database Migrations ==="
php artisan migrate --force

echo "=== [2/3] Seeding 5 Parent Interview Sets Questions ==="
php artisan db:seed --class=MockInterviewParentSetsSeeder --force

echo "=== [3/3] Clearing & Caching Configuration ==="
php artisan config:cache
php artisan route:cache

echo "=== Mock Interview 5 Parent Sets Deployment Complete! ==="
