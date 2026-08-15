FROM node:22-slim AS frontend

WORKDIR /frontend
COPY academic-os/package.json academic-os/package-lock.json* ./
RUN npm install
COPY academic-os/ .
RUN npm run icons && npm run build

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY academic_os/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY academic_os/ .
COPY --from=frontend /frontend/dist /app/odyssey

ENV ACADEMIC_OS_DATA=/data
ENV ACADEMIC_OS_CLOUD=1
ENV PORT=10000

RUN mkdir -p /data

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:10000/api/health')" || exit 1

CMD uvicorn api.server:app --host 0.0.0.0 --port ${PORT}
