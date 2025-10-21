#!/bin/bash

# 静默收集系统信息并输出JSON格式

# 获取IP信息
IP_INFO=$(curl -s ipinfo.io 2>/dev/null)

# CPU信息
CPU_CORES=$(nproc 2>/dev/null || echo "unknown")
CPU_MODEL=$(lscpu 2>/dev/null | grep "Model name" | sed 's/Model name://g' | xargs || echo "unknown")
CPU_ARCH=$(lscpu 2>/dev/null | grep "Architecture" | sed 's/Architecture://g' | xargs || echo "unknown")
CPU_FREQ=$(lscpu 2>/dev/null | grep "CPU max MHz" | sed 's/CPU max MHz://g' | xargs || echo "unknown")

# 内存信息
TOTAL_RAM=$(free -m 2>/dev/null | grep "Mem:" | awk '{print $2}' || echo "0")
AVAILABLE_RAM=$(free -m 2>/dev/null | grep "Mem:" | awk '{print $7}' || echo "0")
USED_RAM=$(free -m 2>/dev/null | grep "Mem:" | awk '{print $3}' || echo "0")
TOTAL_RAM_GB=$(echo "scale=2; $TOTAL_RAM / 1024" | bc 2>/dev/null || echo "$((TOTAL_RAM / 1024))")

# 硬盘信息
DISK_ARRAY=()
while read -r line; do
  DEVICE=$(echo "$line" | awk '{print $1}')
  TOTAL=$(echo "$line" | awk '{print $2}')
  USED=$(echo "$line" | awk '{print $3}')
  AVAIL=$(echo "$line" | awk '{print $4}')
  USE_PCT=$(echo "$line" | awk '{print $5}')
  MOUNT=$(echo "$line" | awk '{print $6}')
  DISK_ARRAY+=("{\"device\":\"$DEVICE\",\"total\":\"$TOTAL\",\"used\":\"$USED\",\"available\":\"$AVAIL\",\"use_pct\":\"$USE_PCT\",\"mount\":\"$MOUNT\"}")
done < <(df -h 2>/dev/null | grep -E "^/dev/" || echo "")
DISK_JSON=$(printf ",%s" "${DISK_ARRAY[@]}")
DISK_JSON="[${DISK_JSON:1}]"
DISK_COUNT=${#DISK_ARRAY[@]}

PHYSICAL_DISKS=()
while read -r line; do
  NAME=$(echo "$line" | awk '{print $1}')
  SIZE=$(echo "$line" | awk '{print $2}')
  TYPE=$(echo "$line" | awk '{print $3}')
  if [ "$TYPE" = "disk" ]; then
    PHYSICAL_DISKS+=("{\"name\":\"$NAME\",\"size\":\"$SIZE\"}")
  fi
done < <(lsblk -o NAME,SIZE,TYPE 2>/dev/null | tail -n +2 || echo "")
PHYSICAL_JSON=$(printf ",%s" "${PHYSICAL_DISKS[@]}")
PHYSICAL_JSON="[${PHYSICAL_JSON:1}]"
PHYSICAL_COUNT=${#PHYSICAL_DISKS[@]}

# 默认不进行网络测试
NETWORK_TEST=false

# 解析命令行参数
for arg in "$@"; do
  case $arg in
    --network)
      NETWORK_TEST=true
      ;;
  esac
done

# 网络速度测试
SPEED_TEST_DOWNLOAD="not_tested"
SPEED_TEST_UPLOAD="not_tested"

if [ "$NETWORK_TEST" = true ]; then
  if command -v curl &> /dev/null; then
    # Download test (1MB file from Cloudflare)
    DL_START=$(date +%s%N)
    curl -s -o /dev/null "https://speed.cloudflare.com/__down?bytes=1000000" 2>/dev/null
    DL_END=$(date +%s%N)
    DL_TIME_NS=$((DL_END - DL_START))
    if [ $DL_TIME_NS -gt 0 ]; then
      DL_TIME_S=$(echo "scale=3; $DL_TIME_NS / 1000000000" | bc)
      DL_SPEED_MBPS=$(echo "scale=2; (1 * 8) / $DL_TIME_S" | bc)  # 1MB = 8Mb
      SPEED_TEST_DOWNLOAD="${DL_SPEED_MBPS} Mbps"
    fi

    # Upload test (POST 1MB data to Cloudflare)
    UL_START=$(date +%s%N)
    curl -s -o /dev/null --data-binary @<(head -c 1000000 /dev/zero) "https://speed.cloudflare.com/__up" 2>/dev/null
    UL_END=$(date +%s%N)
    UL_TIME_NS=$((UL_END - UL_START))
    if [ $UL_TIME_NS -gt 0 ]; then
      UL_TIME_S=$(echo "scale=3; $UL_TIME_NS / 1000000000" | bc)
      UL_SPEED_MBPS=$(echo "scale=2; (1 * 8) / $UL_TIME_S" | bc)
      SPEED_TEST_UPLOAD="${UL_SPEED_MBPS} Mbps"
    fi
  fi

  # Prefer speedtest-cli if available for more accurate results
  if command -v speedtest-cli &> /dev/null; then
    SPEED_TEST_RESULT=$(speedtest-cli --simple 2>/dev/null)
    SPEED_TEST_DOWNLOAD=$(echo "$SPEED_TEST_RESULT" | grep "Download:" | awk '{print $2 " " $3}')
    SPEED_TEST_UPLOAD=$(echo "$SPEED_TEST_RESULT" | grep "Upload:" | awk '{print $2 " " $3}')
  fi
fi

# 显卡信息
GPU_INFO="unknown"
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "nvidia_detected")
elif command -v rocm-smi &> /dev/null; then
    GPU_INFO="amd_rocm_detected"
elif lspci 2>/dev/null | grep -i vga &> /dev/null; then
    GPU_INFO=$(lspci 2>/dev/null | grep -i vga | head -1 | cut -d: -f3 | xargs || echo "vga_detected")
fi

# 系统基本信息
OS_NAME=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "unknown")
KERNEL_VERSION=$(uname -r 2>/dev/null || echo "unknown")
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
UPTIME=$(uptime -s 2>/dev/null || echo "unknown")
USERNAME=$(whoami 2>/dev/null || echo "unknown")
ARCH=$(uname -m 2>/dev/null || echo "unknown")

# 系统负载
LOAD_AVERAGE=$(cat /proc/loadavg 2>/dev/null | cut -d' ' -f1-3 || echo "unknown")
PROCESS_COUNT=$(ps aux 2>/dev/null | wc -l || echo "0")

# 网络接口
NETWORK_INTERFACES=$(ip addr show 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | tr '\n' ',' | sed 's/,$//' || echo "unknown")

# Docker信息
DOCKER_VERSION="not_installed"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version 2>/dev/null | awk '{print $3}' | sed 's/,//' || echo "installed")
    DOCKER_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l || echo "0")
else
    DOCKER_CONTAINERS="0"
fi

# 开发环境
NODE_VERSION=$(command -v node &> /dev/null && node --version 2>/dev/null || echo "not_installed")
NPM_VERSION=$(command -v npm &> /dev/null && npm --version 2>/dev/null || echo "not_installed")
PNPM_VERSION=$(command -v pnpm &> /dev/null && pnpm --version 2>/dev/null || echo "not_installed")

# 当前时间
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "unknown")

# 输出JSON
cat << EOF
{
  "timestamp": "$TIMESTAMP",
  "ip_info": $IP_INFO,
  "system": {
    "os": "$OS_NAME",
    "kernel": "$KERNEL_VERSION",
    "hostname": "$HOSTNAME",
    "uptime": "$UPTIME",
    "username": "$USERNAME",
    "architecture": "$ARCH",
    "load_average": "$LOAD_AVERAGE",
    "process_count": $PROCESS_COUNT
  },
  "hardware": {
    "cpu": {
      "cores": $CPU_CORES,
      "model": "$CPU_MODEL",
      "architecture": "$CPU_ARCH",
      "max_frequency_mhz": "$CPU_FREQ"
    },
    "memory": {
      "total_mb": $TOTAL_RAM,
      "used_mb": $USED_RAM,
      "available_mb": $AVAILABLE_RAM,
      "total_gb": $TOTAL_RAM_GB
    },
    "disk": {
      "partition_count": $DISK_COUNT,
      "partitions": $DISK_JSON,
      "physical_count": $PHYSICAL_COUNT,
      "physical": $PHYSICAL_JSON
    },
    "gpu": "$GPU_INFO"
  },
  "network": {
    "speed_test": {
      "download": "$SPEED_TEST_DOWNLOAD",
      "upload": "$SPEED_TEST_UPLOAD"
    },
    "interfaces": "$NETWORK_INTERFACES"
  },
  "development": {
    "node_version": "$NODE_VERSION",
    "npm_version": "$NPM_VERSION",
    "pnpm_version": "$PNPM_VERSION",
    "docker": {
      "version": "$DOCKER_VERSION",
      "containers": $DOCKER_CONTAINERS
    }
  }
}
EOF
