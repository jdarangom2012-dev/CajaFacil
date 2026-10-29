# CajaFácil Nube — imagen del servidor (panel + API)
FROM node:22-alpine AS panel
WORKDIR /panel
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY frontend/ ./
RUN npx vite build --outDir /panel/dist --emptyOutDir

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NUBE_FRONTEND_DIR=/app/frontend_dist
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=panel /panel/dist /app/frontend_dist
RUN useradd -m nube && mkdir -p /datos/respaldos && chown -R nube /app /datos
USER nube
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput -v0 && gunicorn nube.wsgi -b 0.0.0.0:8000 -w 3 --timeout 300 --access-logfile -"]
