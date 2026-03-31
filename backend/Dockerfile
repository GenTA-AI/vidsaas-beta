FROM python:3.12-slim

# FFmpeg 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt greenlet

COPY app/ app/

# uploads 디렉토리
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
