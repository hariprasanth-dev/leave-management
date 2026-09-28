FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY gateway ./gateway
COPY services ./services
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts/start-production.sh ./scripts/start-production.sh
RUN chmod +x ./scripts/start-production.sh

ENV PYTHONPATH=/app
ENV AUTH_SERVICE_URL=http://127.0.0.1:8001
ENV EMPLOYEE_SERVICE_URL=http://127.0.0.1:8002
ENV LEAVE_SERVICE_URL=http://127.0.0.1:8003
ENV APPROVAL_SERVICE_URL=http://127.0.0.1:8004

EXPOSE 8000

CMD ["./scripts/start-production.sh"]
