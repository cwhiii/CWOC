FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    wget \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Clone ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /app

# Install Python dependencies
RUN pip3 install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
RUN pip3 install --no-cache-dir -r requirements.txt

# Create model directories
RUN mkdir -p /app/models/checkpoints /app/models/vae /app/output

# Expose ComfyUI port
EXPOSE 8188

# Run ComfyUI — listen on all interfaces, enable CORS for Docker networking
# --preview-method auto: sends latent preview images via WebSocket at each sampling step
CMD ["python3", "main.py", "--listen", "0.0.0.0", "--port", "8188", "--lowvram", "--preview-method", "auto"]
