#!/usr/bin/env bash
# BIO ARCADE 실시간 중계 서버 설치 (Oracle Cloud 무료 서버 · Ubuntu 22.04/24.04)
#   서버에 접속해서 아래 한 줄을 붙여 넣으면 끝납니다.
#     curl -fsSL https://seongwoo0823-hub.github.io/BioGame-mod/server/setup.sh | sudo bash
#   도메인을 따로 만들었다면 끝에 붙임:  … | sudo bash -s biogame.duckdns.org
#   하는 일: Node.js·Caddy 설치 → 중계 서버를 서비스로 등록(재부팅해도 자동 실행) → 80·443 포트 열기 → https 인증서 자동 발급
set -euo pipefail
BASE="${BIO_BASE:-https://seongwoo0823-hub.github.io/BioGame-mod/server}"
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS https://api.ipify.org || curl -fsS https://ifconfig.me)"
  DOMAIN="$(echo "$IP" | tr '.' '-').sslip.io"     # 가입 없이 쓰는 무료 주소 (예: 1-2-3-4.sslip.io)
fi
echo "▶ 서버 주소: $DOMAIN"

echo "▶ 1/5 프로그램 설치 (Node.js, Caddy)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "▶ 2/5 중계 서버 받기"
mkdir -p /opt/bio-relay && cd /opt/bio-relay
curl -fsSL "$BASE/server.js" -o server.js
curl -fsSL "$BASE/package.json" -o package.json
npm install --omit=dev --no-audit --no-fund
id -u biorelay >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin biorelay
chown -R biorelay:biorelay /opt/bio-relay

echo "▶ 3/5 서비스 등록"
cat > /etc/systemd/system/bio-relay.service <<'EOF'
[Unit]
Description=BIO ARCADE realtime relay
After=network.target
[Service]
User=biorelay
WorkingDirectory=/opt/bio-relay
Environment=PORT=8080
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=2
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now bio-relay
systemctl restart bio-relay

echo "▶ 4/5 https(wss) 설정"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  reverse_proxy 127.0.0.1:8080
}
EOF
systemctl restart caddy

echo "▶ 5/5 방화벽 열기 (80, 443)"
for p in 443 80; do
  iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp -m state --state NEW --dport $p -j ACCEPT
done
netfilter-persistent save || true

sleep 8
echo
if curl -fsS "https://$DOMAIN/" >/dev/null 2>&1; then
  echo "✅ 완료! 아래 주소를 Claude에게 알려 주세요:"
else
  echo "⚠ 아직 https 인증서를 받는 중이거나, Oracle 보안 목록(Ingress)에 80·443 포트가 안 열렸을 수 있어요."
  echo "   1~2분 뒤 브라우저로 https://$DOMAIN 을 열어 {\"ok\":true…} 가 보이면 성공이에요. 주소를 Claude에게 알려 주세요:"
fi
echo "   wss://$DOMAIN"
