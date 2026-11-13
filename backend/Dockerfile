# Multistage Dockerfile Backend (Minimal)
FROM python:3.11-slim AS builder

WORKDIR /app
# Jaringan server lambat/fluktuatif: beri pip waktu & retry lebih besar agar unduhan wheel tidak gagal di tengah jalan
ENV PIP_RETRIES=15 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
# Cache mount: wheel yang sudah terunduh lengkap tidak diulang saat build retry
# (jaringan server fluktuatif — percobaan gagal di tengah jalan tidak menghapus cache)
RUN --mount=type=cache,target=/root/.cache/pip pip install --user -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
RUN mkdir -p /app/db_data /app/media /app/logs
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD curl -f http://localhost:8000/api/core/health/ || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "reader.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]