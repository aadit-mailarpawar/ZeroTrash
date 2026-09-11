# ZeroTrash free Docker deployment

This setup runs ZeroTrash on one Oracle Cloud Always Free Ubuntu VM. Docker Compose starts the frontend, backend, and Caddy. Caddy provides HTTPS, while `storage/data` and `storage/uploads` keep the SQLite database and photos on the VM disk.

## What remains free

Oracle documents Always Free compute instances and up to 200 GB of combined boot/block storage in the account's home region. Select only resources marked **Always Free eligible**, keep the VM within the displayed free limits, and do not add paid resources. Oracle may reclaim very idle Always Free instances, and capacity can be temporarily unavailable.

Official references:

- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [DuckDNS free dynamic DNS](https://www.duckdns.org/)

## 1. Put the project on GitHub

Create an empty private GitHub repository and push this project to its `main` branch. Do not commit `.env.production`, `storage/`, the SQLite database, or uploaded photos.

## 2. Create the free Oracle VM

1. Create an Oracle Cloud Free Tier account.
2. Choose the home region carefully; Always Free compute and storage must be created there.
3. Open **Compute → Instances → Create instance**.
4. Use Ubuntu 24.04 and an **Always Free eligible** shape. Prefer `VM.Standard.A1.Flex` with no more than the free allocation shown by Oracle. The AMD micro shape also works but has much less memory.
5. Keep the boot volume inside the Always Free allowance.
6. Assign a public IPv4 address and save the generated SSH private key.
7. In the subnet security list, allow inbound TCP ports `80` and `443` from `0.0.0.0/0`. Allow port `22` only from your own public IP where possible.

Do not create a paid load balancer; Caddy runs directly on the VM.

## 3. Create a free HTTPS name

1. Sign in at [DuckDNS](https://www.duckdns.org/).
2. Create a unique subdomain, such as `zerotrash-college.duckdns.org`.
3. Set its IP to the Oracle VM's public IPv4 address.
4. Wait a few minutes for DNS to update.

## 4. Connect to the VM

From PowerShell on your laptop:

```powershell
ssh -i "C:\path\to\your-oracle-key.key" ubuntu@YOUR_VM_PUBLIC_IP
```

On the VM, enable its firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 5. Install Docker and Git

Use Docker's official Ubuntu repository:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
exit
```

Reconnect with SSH so the Docker group change takes effect, then verify:

```bash
docker --version
docker compose version
```

## 6. Download and configure ZeroTrash

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git zerotrash
cd zerotrash
cp .env.production.example .env.production
nano .env.production
```

Set these values:

```env
SITE_ADDRESS=your-name.duckdns.org
PUBLIC_ORIGIN=https://your-name.duckdns.org
ADMIN_NAME=ZeroTrash Admin
ADMIN_EMAIL=your-real-admin-email@example.com
ADMIN_PASSWORD=use-a-long-unique-password-here
SEED_DEMO_USERS=false
SESSION_COOKIE_SECURE=true
NEXT_PUBLIC_PHOTO_LOCATION_ENABLED=false
REQUIRE_PHOTO_LOCATION=false
```

The admin email and password create the initial admin only when the production database is empty. Keep `.env.production` private.

## 7. Start the website

```bash
mkdir -p storage/data storage/uploads
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Open `https://your-name.duckdns.org`. Caddy requests and renews the HTTPS certificate automatically. The first certificate can take a minute; ports 80 and 443 must be reachable and DuckDNS must already point to the VM.

Useful checks:

```bash
docker compose --env-file .env.production logs --tail=100
curl -I https://your-name.duckdns.org/signin
```

## Updating the site

```bash
cd zerotrash
git pull
docker compose --env-file .env.production up -d --build
```

## Backing up the database and photos

Stop the backend briefly so the SQLite backup is consistent:

```bash
cd zerotrash
docker compose --env-file .env.production stop backend
tar -czf "zerotrash-backup-$(date +%F).tar.gz" storage
docker compose --env-file .env.production start backend
```

Download the generated archive to your laptop and keep it private. Restoring means stopping the stack, replacing `storage/` from a backup, and starting it again.

## Cost-safety checklist

- Confirm the VM and boot volume show **Always Free eligible** before creating them.
- Use one VM and its included boot storage; do not create paid databases, extra disks, or paid load balancers.
- Set an Oracle budget alert at a very small amount, such as ₹100, as a safety notification.
- Check **Billing & Cost Management → Cost Analysis** after deployment.
- Keep the SSH key, production environment file, database backups, and admin password private.
