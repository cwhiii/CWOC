#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-3333} --reload
