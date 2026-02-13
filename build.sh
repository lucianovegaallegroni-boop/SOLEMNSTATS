#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# Collect static files
cd backend
python manage.py collectstatic --no-input

# Apply database migrations
python manage.py migrate
