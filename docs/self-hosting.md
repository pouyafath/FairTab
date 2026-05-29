# Self-Hosting FairTab on Ubuntu Server

This guide takes you from a fresh Ubuntu Server 24.04 LTS installation to a production-ready FairTab instance with HTTPS, automatic backups to a laptop, and auto-start on reboot.

Every command below is **copy-paste ready**. Replace placeholder values (marked `YOUR_*`) with your own.

---

## What You'll End Up With

```
Internet → Router (port 443) → Nginx (SSL) → Docker (FairTab) → SQLite (/data/fairtab.db)
                                                     ↓ rsync every 5 min
                                                 Laptop backup
```

---

## Prerequisites

| Item | Notes |
|---|---|
| Home PC | Any x86-64 machine, 2 GB RAM minimum |
| Ubuntu Server 24.04 LTS | Free download: [ubuntu.com/download/server](https://ubuntu.com/download/server) |
| A domain name | Free option: [DuckDNS](https://www.duckdns.org) |
| Laptop (optional) | For the backup replica |
| UPS battery backup | **Strongly recommended** — prevents SQLite corruption on power loss |

---

## Step 1 — Install Ubuntu Server

1. Download [Ubuntu Server 24.04 LTS](https://ubuntu.com/download/server) ISO
2. Flash it to a USB drive with [Balena Etcher](https://etcher.balena.io/)
3. Boot your PC from the USB, follow the installer
4. During install: enable **OpenSSH server**, skip LVM, create a user (e.g. `fairtab`)

---

## Step 2 — Initial Server Setup

SSH into your server from another machine, or run commands directly on it.

```bash
# Update everything
sudo apt update && sudo apt upgrade -y

# Install useful tools
sudo apt install -y curl wget git htop unzip

# Enable automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Set up firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 3 — Set a Static Local IP

This stops the PC's IP from changing, so the router always finds it.

```bash
# Find your network interface name (usually eth0 or eno1)
ip link show

# Find your router's gateway IP
ip route | grep default
```

Edit the netplan config (replace `eth0` and IPs to match your network):

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Paste (adjust interface name, IP, and gateway to your network):

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.10/24     # static IP for this PC
      routes:
        - to: default
          via: 192.168.1.1    # your router's IP
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

```bash
sudo netplan apply
ip addr show eth0   # verify the new IP
```

---

## Step 4 — Install Docker

```bash
# Official Docker install script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## Step 5 — Deploy FairTab

```bash
# Clone the repository
git clone https://github.com/pouyafath/FairTab.git
cd FairTab

# Create the data directory (SQLite file lives here)
mkdir -p data

# Set your public URL (update after you set up a domain in step 7)
echo 'NEXT_PUBLIC_APP_URL=http://192.168.1.10:3000' > .env.local

# Build and start (first build takes ~3 min)
docker compose up -d

# Watch the logs
docker compose logs -f
```

Wait until you see `FairTab: database ready.` and then:

```bash
# Test it's working
curl http://localhost:3000/api/health
# → {"status":"ok","timestamp":"..."}
```

Open **http://192.168.1.10:3000** on any device on your network.

---

## Step 6 — Port Forwarding on Your Router

To make FairTab reachable from outside your home:

1. Log into your router admin page (usually **192.168.1.1** or **192.168.1.254**)
2. Find **Port Forwarding** (sometimes under Advanced or NAT)
3. Add two rules:
   - External port **80** → Internal IP **192.168.1.10** port **80**
   - External port **443** → Internal IP **192.168.1.10** port **443**

---

## Step 7 — Dynamic DNS (Free Domain)

Your home IP address changes. DuckDNS gives you a stable free subdomain.

1. Go to [duckdns.org](https://www.duckdns.org) and sign in with GitHub/Google
2. Create a subdomain, e.g. `fairtab.duckdns.org`
3. Note your **token**

Auto-update the IP every 5 minutes:

```bash
# Create update script
mkdir -p ~/duckdns
cat > ~/duckdns/duck.sh << 'EOF'
#!/bin/bash
echo url="https://www.duckdns.org/update?domains=YOUR_SUBDOMAIN&token=YOUR_TOKEN&ip=" \
  | curl -k -o ~/duckdns/duck.log -K -
EOF

# Replace with your values
nano ~/duckdns/duck.sh

chmod +x ~/duckdns/duck.sh

# Run it now to verify it works
~/duckdns/duck.sh
cat ~/duckdns/duck.log   # should print "OK"

# Schedule every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1") | crontab -
```

---

## Step 8 — Nginx Reverse Proxy + HTTPS (SSL)

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Test Nginx
sudo systemctl status nginx
```

Create the FairTab Nginx site config:

```bash
sudo nano /etc/nginx/sites-available/fairtab
```

Paste (replace `YOUR_DOMAIN` with your DuckDNS subdomain):

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.duckdns.org;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/fairtab /etc/nginx/sites-enabled/
sudo nginx -t           # test config
sudo systemctl reload nginx

# Get a free SSL certificate from Let's Encrypt
sudo certbot --nginx -d YOUR_DOMAIN.duckdns.org

# Certbot auto-configures Nginx for HTTPS and sets up auto-renewal
# Verify renewal works
sudo certbot renew --dry-run
```

Now update your app URL and restart:

```bash
echo 'NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN.duckdns.org' > ~/FairTab/.env.local
cd ~/FairTab
docker compose down
docker compose up -d
```

FairTab is now live at **https://YOUR_DOMAIN.duckdns.org**

---

## Step 9 — Laptop Backup Replica

Set up your laptop as a hot standby. If the PC goes offline, you can switch to the laptop in minutes.

### On the laptop — install Ubuntu Server the same way (Steps 1–5)

Give it IP `192.168.1.11` in the static IP config.

### On the PC — set up passwordless SSH to the laptop

```bash
# Generate SSH key (press Enter for no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/fairtab-backup -C "fairtab-backup"

# Copy the public key to the laptop
ssh-copy-id -i ~/.ssh/fairtab-backup.pub fairtab@192.168.1.11

# Test it
ssh -i ~/.ssh/fairtab-backup fairtab@192.168.1.11 "echo 'SSH OK'"
```

### Create the backup script

```bash
cat > ~/backup-fairtab.sh << 'EOF'
#!/bin/bash
LOGFILE="$HOME/fairtab-backup.log"
echo "[$(date)] Starting backup..." >> "$LOGFILE"

rsync -avz --delete \
  -e "ssh -i $HOME/.ssh/fairtab-backup -o StrictHostKeyChecking=no" \
  ~/FairTab/data/fairtab.db \
  fairtab@192.168.1.11:~/FairTab/data/fairtab.db \
  >> "$LOGFILE" 2>&1

echo "[$(date)] Done." >> "$LOGFILE"
EOF

chmod +x ~/backup-fairtab.sh

# Test it
~/backup-fairtab.sh
cat ~/fairtab-backup.log
```

### Schedule every 5 minutes

```bash
(crontab -l 2>/dev/null; echo "*/5 * * * * ~/backup-fairtab.sh") | crontab -
```

### Failover procedure (if PC goes down)

On the laptop, run the same Steps 5–8. The laptop already has the latest DB copy from the last rsync. Update the router's port-forwarding rules to point at `192.168.1.11` instead.

---

## Step 10 — Verify Everything

```bash
# App is running
curl https://YOUR_DOMAIN.duckdns.org/api/health

# Docker container is healthy
docker ps
# STATUS should show "healthy"

# Logs are clean
docker compose logs --tail=50

# Backups are running
crontab -l
cat ~/fairtab-backup.log
```

---

## Updating FairTab

```bash
cd ~/FairTab
git pull
docker compose down
docker compose up -d --build
docker compose logs -f
```

Docker volumes (`./data/`) persist across updates — your database is safe.

---

## Monitoring and Alerts

Check system resources:

```bash
htop               # CPU / RAM
df -h              # disk space
docker stats       # container resource usage
```

Set up an uptime monitor (free):  
- [UptimeRobot](https://uptimerobot.com) — add `https://YOUR_DOMAIN.duckdns.org/api/health` as an HTTP monitor
- It will email you if FairTab goes down

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose up` fails with build error | Run `docker compose build --no-cache` |
| Can't reach from outside network | Check router port forwarding and `sudo ufw status` |
| SSL certificate error | `sudo certbot renew` and `sudo systemctl reload nginx` |
| Database corruption after power loss | Restore from laptop backup: `rsync -avz fairtab@192.168.1.11:~/FairTab/data/fairtab.db ~/FairTab/data/` |
| Container keeps restarting | `docker compose logs` to see the error |
| Forgot to set static IP, PC changed IP | Update router port forwarding to the new IP |

---

## Security Hardening (Optional but Recommended)

```bash
# Disable password SSH login (key-only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh

# Change SSH port (reduces automated scanning)
# Set: Port 2222
# Then: sudo ufw allow 2222/tcp && sudo ufw delete allow ssh

# Install fail2ban (blocks brute-force attempts)
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
```
