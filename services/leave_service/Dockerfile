FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY alembic ./alembic
COPY alembic.ini .
COPY services/leave_service ./services/leave_service

ENV PYTHONPATH=/app
EXPOSE 8003

CMD ["uvicorn", "services.leave_service.main:app", "--host", "0.0.0.0", "--port", "8003"]
