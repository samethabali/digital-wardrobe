#!/usr/bin/env bash
# Oracle Cloud Ubuntu 24.04 (ARM) sunucusunu arka plan servisi için hazırlar. Tekrar çalıştırılabilir.
# Kullanım (sunucuda): sudo CUTOUT_HOST=130-110-13-57.sslip.io bash setup.sh
# Önkoşul: /opt/aura-cutout altında dist/ ve package.json, /etc/aura-cutout.env dosyası (README).
set -euo pipefail

: "${CUTOUT_HOST:?CUTOUT_HOST gerekli (ör. 130-110-13-57.sslip.io)}"
NODE_VERSION=v22.20.0
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== Node.js"
if [ "$(node -v 2>/dev/null || true)" != "$NODE_VERSION" ]; then
  cd /tmp
  curl -fsSLO "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-arm64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" | grep "node-$NODE_VERSION-linux-arm64.tar.xz" | sha256sum -c -
  mkdir -p /opt/node && tar -xJf "node-$NODE_VERSION-linux-arm64.tar.xz" -C /opt/node --strip-components=1
  ln -sf /opt/node/bin/node /usr/local/bin/node
  ln -sf /opt/node/bin/npm /usr/local/bin/npm
fi

echo "== Servis kullanıcısı ve klasörler"
id aura-cutout >/dev/null 2>&1 || useradd --system --home /var/lib/aura-cutout --shell /usr/sbin/nologin aura-cutout
mkdir -p /var/lib/aura-cutout/models
chown -R aura-cutout:aura-cutout /var/lib/aura-cutout
test -f /etc/aura-cutout.env || { echo "/etc/aura-cutout.env yok"; exit 1; }
chown root:aura-cutout /etc/aura-cutout.env && chmod 640 /etc/aura-cutout.env

echo "== Bağımlılıklar"
cd /opt/aura-cutout
npm install --omit=dev --no-audit --no-fund
chown -R root:root /opt/aura-cutout
# Windows'tan kopyalanan klasörler yalnızca sahibine açık gelebilir; servis kullanıcısı okuyabilmeli
chmod -R a+rX /opt/aura-cutout

echo "== Swap (2 GB, bellek taşmasına karşı güvenlik payı)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== Güvenlik duvarı (80/443)"
for port in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 5 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
done
netfilter-persistent save

echo "== Otomatik güvenlik güncellemeleri"
apt-get install -y unattended-upgrades >/dev/null
systemctl enable --now unattended-upgrades

echo "== Caddy"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update >/dev/null && apt-get install -y caddy >/dev/null
fi
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
cp "$HERE/Caddyfile" /etc/caddy/Caddyfile
mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironment=CUTOUT_HOST=%s\n' "$CUTOUT_HOST" > /etc/systemd/system/caddy.service.d/host.conf

echo "== Servisler"
cp "$HERE/aura-cutout.service" /etc/systemd/system/aura-cutout.service
systemctl daemon-reload
systemctl enable aura-cutout caddy
systemctl restart aura-cutout caddy
echo "Kurulum tamam. Durum: systemctl status aura-cutout --no-pager"
