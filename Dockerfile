FROM python:3.12-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

ENV HOST=0.0.0.0
ENV PORT=8000
ENV DB_PATH=/data/app.sqlite3

EXPOSE 8000

CMD ["python", "server.py"]
