# Stage 1: Build stage
FROM python:3.10-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runner stage
FROM python:3.10-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Create non-root group and user
RUN groupadd -g 10001 crmgroup && useradd -u 10001 -g crmgroup crmuser

# Copy installed libraries and executables
COPY --from=builder /root/.local /home/crmuser/.local
COPY . .

# Set correct ownership for directories (including chroma_db workspace)
RUN chown -R crmuser:crmgroup /app

USER crmuser
ENV PATH=/home/crmuser/.local/bin:$PATH

EXPOSE 9002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9002"]