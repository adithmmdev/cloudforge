#!/bin/bash
# Render deployment build script

# Exit on error
set -e

echo "Installing requirements..."
pip install -r requirements.txt

echo "Running DB migrations..."
alembic upgrade head

echo "Build complete."
