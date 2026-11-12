# Multistage Dockerfile Backend (Minimal)
FROM python:3.11-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

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