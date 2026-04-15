#!/bin/bash
# ============================================================
#  run.sh — Khởi động backend với Python 3.12 (venv)
#  Dùng lệnh: bash run.sh
# ============================================================
cd "$(dirname "$0")"

PYTHON="venv/bin/python3.12"

if [ ! -f "$PYTHON" ]; then
    echo "❌ Không tìm thấy $PYTHON"
    echo "   Chạy: python3.12 -m venv venv && venv/bin/python3.12 -m pip install -r requirements.txt"
    exit 1
fi

echo "🚀 Khởi động backend với $PYTHON..."
$PYTHON app.py
