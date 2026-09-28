FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY gateway ./gateway

RUN test -f shared/routers/auth.py

ENV PYTHONPATH=/app
ENV GATEWAY_BUILD=0.3.0

EXPOSE 8000

CMD ["sh", "-c", "uvicorn gateway.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
