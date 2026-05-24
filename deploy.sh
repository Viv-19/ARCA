#!/bin/bash
# ==============================================================================
# ARCA Production Deployer Script
# Orchestrates git pulling, environment checks, and docker container rebuilds.
# ==============================================================================

set -e

echo "=== [Deployer] Starting ARCA deployment sequence... ==="

# 1. Update Repository
echo "=== [Deployer] Pulling latest updates from GitHub..."
git fetch origin
git checkout dev/compliance-agent
git pull origin dev/compliance-agent

# 2. Check for environment parameters
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "=== [Deployer Warning] Production $ENV_FILE file not found on host!"
    echo "=== Creating default template..."
    cat <<EOT > .env
# Production Keys
OPENAI_API_KEY=your_openai_api_key_here
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=arca_compliance_secret_key_prod
JIRA_BASE_URL=https://mock-jira.atlassian.net
JIRA_API_TOKEN=mock_jira_token_for_hackathon
EOT
    echo "=== [Deployer Action] Default .env created. PLEASE EDIT THIS FILE WITH YOUR AWS PRODUCTION KEYS before running again."
    exit 1
fi

# 3. Synchronize environment files to service subdirectories
echo "=== [Deployer] Copying env configurations..."
cp .env arca_backend/.env
cp .env arca_ai_service/.env

# 4. Build and Launch Containers
echo "=== [Deployer] Building and launching production Docker stack..."
# Ensure Nginx config is linked
docker compose -f docker/docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker/docker-compose.prod.yml up -d --build

# 5. Database Schema Migration and Seeding
echo "=== [Deployer] Waiting for PostgreSQL database container to start..."
sleep 8

echo "=== [Deployer] Executing database schema pushes..."
docker compose -f docker/docker-compose.prod.yml exec -T backend npx prisma db push

echo "=== [Deployer] Seeding Bank Departments..."
docker compose -f docker/docker-compose.prod.yml exec -T backend node scripts/seed_departments.js

echo "=== [Deployer] Deployment completed successfully! ==="
echo "=== [Deployer] Access the platform at http://localhost (or your Elastic IP / Domain name)!"
