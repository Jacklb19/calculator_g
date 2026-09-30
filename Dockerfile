# syntax=docker/dockerfile:1

# Both build stages run on the build machine's platform: the frontend output is platform-independent
# and Go cross-compiles, so multi-arch images don't need emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS backend
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=backend /out/server /server
COPY --from=frontend /src/dist /static
ENV STATIC_DIR=/static
EXPOSE 8080
ENTRYPOINT ["/server"]
