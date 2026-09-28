FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY gateway ./gateway

# Fail the image build if auth routes are missing (avoids silent old-gateway deploys).
RUN test -f shared/routers/auth.py

ENV PYTHONPATH=/app
ENV GATEWAY_BUILD=0.2.1

EXPOSE 8000

CMD ["sh", "-c", "uvicorn gateway.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
