# Tartarus API (gateway + worker) — multi-stage build.
# Build context is the repo root:  docker build -f deploy/Dockerfile .

# ---- 1. Build the Rust binary (distributed = Redis + Postgres support) ----
FROM rust:1.83-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml ./
COPY crates ./crates
RUN cargo build --release -p tartarus-server --features distributed

# ---- 2. Fetch the WASI interpreter runtimes ----
FROM debian:bookworm-slim AS runtimes
WORKDIR /runtimes
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY runtimes/ ./
RUN chmod +x fetch-runtimes.sh && ./fetch-runtimes.sh

# ---- 3. Minimal runtime image ----
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 10001 tartarus
WORKDIR /app
COPY --from=builder /app/target/release/tartarus /usr/local/bin/tartarus
COPY --from=runtimes /runtimes /app/runtimes
COPY migrations /app/migrations
ENV RUNTIMES_DIR=/app/runtimes \
    BIND=0.0.0.0:8080 \
    WORKER_CONCURRENCY=2
USER tartarus
EXPOSE 8080
ENTRYPOINT ["tartarus"]
# `all` = gateway + worker in one process. With REDIS_URL + DATABASE_URL set it runs distributed.
CMD ["all"]
