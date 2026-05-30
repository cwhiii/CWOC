FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for pycairo, Typst, and Pandoc
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2-dev \
    pkg-config \
    gcc \
    python3-dev \
    wget \
    xz-utils \
    poppler-utils \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fontconfig \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f

# Install Typst
RUN wget -qO- https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz \
    | tar -xJ --strip-components=1 -C /usr/local/bin/

# Install Pandoc
RUN wget -qO /tmp/pandoc.deb https://github.com/jgm/pandoc/releases/download/3.6.1/pandoc-3.6.1-1-amd64.deb \
    && dpkg -i /tmp/pandoc.deb && rm /tmp/pandoc.deb

# Install Python dependencies
COPY pyproject.toml .
COPY app ./app
RUN pip install --no-cache-dir .

# Copy application code
COPY . .

EXPOSE 8000
