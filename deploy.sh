#!/bin/bash
set -e

# ============================================
# GenTA Studio GCP 배포 스크립트
# ============================================
# 사용법:
#   1. 아래 변수들을 수정
#   2. chmod +x deploy.sh && ./deploy.sh
# ============================================

# === 설정 (수정 필요) ===
PROJECT_ID="genta-vidsaas-beta"        # GCP 프로젝트 ID
ZONE="asia-northeast3-a"               # 서울 리전
INSTANCE_NAME="genta-studio"
MACHINE_TYPE="e2-standard-2"           # 2vCPU, 8GB
DISK_SIZE="100"                        # GB
DOMAIN=""                              # 도메인 (비워두면 IP로 접속)

# === API 키 (수정 필요) ===
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:?환경변수 ANTHROPIC_API_KEY를 설정하세요}"
GOOGLE_API_KEY="${GOOGLE_API_KEY:?환경변수 GOOGLE_API_KEY를 설정하세요}"
DB_PASSWORD="genta_$(openssl rand -hex 8)"

echo "====================================="
echo " GenTA Studio GCP 배포"
echo "====================================="

# 1. GCP 프로젝트 설정
echo "[1/6] GCP 프로젝트 설정..."
gcloud config set project $PROJECT_ID

# 2. VM 생성
echo "[2/6] VM 생성 ($MACHINE_TYPE, ${DISK_SIZE}GB)..."
gcloud compute instances create $INSTANCE_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --boot-disk-size=${DISK_SIZE}GB \
    --boot-disk-type=pd-ssd \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server \
    --metadata=startup-script='#!/bin/bash
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable docker
systemctl start docker
'

# 3. 방화벽 규칙
echo "[3/6] 방화벽 규칙..."
gcloud compute firewall-rules create allow-http \
    --allow tcp:80,tcp:443 \
    --target-tags=http-server,https-server \
    2>/dev/null || true

# 4. 고정 IP
echo "[4/6] 고정 IP 할당..."
gcloud compute addresses create genta-ip --region=$(echo $ZONE | sed 's/-[a-z]$//') 2>/dev/null || true
STATIC_IP=$(gcloud compute addresses describe genta-ip --region=$(echo $ZONE | sed 's/-[a-z]$//') --format='get(address)')
echo "  -> IP: $STATIC_IP"

# 5. 파일 전송
echo "[5/6] 파일 전송..."
sleep 30  # VM 부팅 대기

# .env 파일 생성
cat > /tmp/genta.env << EOF
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
GOOGLE_API_KEY=$GOOGLE_API_KEY
DB_PASSWORD=$DB_PASSWORD
DB_USER=genta
DB_NAME=genta
FRONTEND_URL=http://$STATIC_IP
EOF

# 프로젝트 파일 전송
gcloud compute scp --zone=$ZONE --recurse \
    backend frontend docker-compose.yml nginx.conf \
    $INSTANCE_NAME:~/genta-studio/

gcloud compute scp --zone=$ZONE /tmp/genta.env $INSTANCE_NAME:~/genta-studio/.env

# 6. 서버 시작
echo "[6/6] Docker 빌드 & 시작..."
gcloud compute ssh --zone=$ZONE $INSTANCE_NAME --command="
cd ~/genta-studio
sudo docker compose up -d --build
"

echo ""
echo "====================================="
echo " 배포 완료!"
echo "====================================="
echo " URL: http://$STATIC_IP"
echo " DB Password: $DB_PASSWORD"
echo ""
echo " 도메인 연결:"
echo "   DNS A 레코드 -> $STATIC_IP"
echo ""
echo " SSH 접속:"
echo "   gcloud compute ssh --zone=$ZONE $INSTANCE_NAME"
echo ""
echo " 로그 확인:"
echo "   gcloud compute ssh --zone=$ZONE $INSTANCE_NAME --command='cd ~/genta-studio && sudo docker compose logs -f'"
echo "====================================="
