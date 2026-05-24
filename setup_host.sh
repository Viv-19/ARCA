#!/bin/bash
# ==============================================================================
# ARCA AWS Ubuntu EC2 Host Bootstrapper Script
# Designed for clean Ubuntu 22.04 LTS installations on AWS.
# ==============================================================================

# Exit immediately if any command fails
set -e

echo "=== [Bootstrap] Starting ARCA Host Setup on AWS ==="
echo "=== [Bootstrap] Updating system package index..."
sudo apt-get update -y

echo "=== [Bootstrap] Installing foundational dependencies (curl, git, certificates)..."
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# 1. Install Docker CE Engine
echo "=== [Bootstrap] Adding official Docker GPG key..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "=== [Bootstrap] Setting up Docker repository..."
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "=== [Bootstrap] Installing Docker CE engine..."
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group to run without sudo
echo "=== [Bootstrap] Configuring Docker user group privileges..."
sudo usermod -aG docker $USER

# 2. Install Certbot for Free Let's Encrypt SSL
echo "=== [Bootstrap] Installing Let's Encrypt Certbot for secure HTTPS..."
sudo apt-get install -y certbot

# 3. Configure Firewall (UFW)
echo "=== [Bootstrap] Configuring secure host firewalls..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable

echo "=== [Bootstrap] Setup complete! ==="
echo "=== [Bootstrap] IMPORTANT: Please log out of your SSH session and log back in for user group changes to take effect."
echo "=== [Bootstrap] Once logged back in, clone the repo and run './deploy.sh' to launch."
