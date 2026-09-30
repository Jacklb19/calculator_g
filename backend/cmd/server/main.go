// Command server runs the calculator API. It is configured through environment variables:
// PORT (default 8080), HOST (default: all interfaces) and STATIC_DIR (optional frontend build to serve).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Jacklb19/calculator/backend/internal/httpapi"
)

const shutdownTimeout = 10 * time.Second

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	// Restores default signal handling after the first signal, so a second Ctrl+C kills a stuck shutdown.
	context.AfterFunc(ctx, stop)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	if err := run(ctx, os.Getenv, logger); err != nil {
		logger.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, getenv func(string) string, logger *slog.Logger) error {
	cfg, err := loadConfig(getenv)
	if err != nil {
		return err
	}

	listener, err := net.Listen("tcp", cfg.addr())
	if err != nil {
		return fmt.Errorf("listening on %s: %w", cfg.addr(), err)
	}
	logger.Info("listening", "addr", listener.Addr().String(), "static_dir", cfg.staticDir)

	srv := newServer(httpapi.NewHandler(logger, cfg.staticFS()), logger)
	return serve(ctx, srv, listener, logger, shutdownTimeout)
}

func newServer(handler http.Handler, logger *slog.Logger) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
}

func serve(ctx context.Context, srv *http.Server, listener net.Listener, logger *slog.Logger, shutdownTimeout time.Duration) error {
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(listener) }()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serving: %w", err)
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	// The parent context is already cancelled, so shutdown needs its own deadline.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return errors.Join(fmt.Errorf("shutting down: %w", err), srv.Close())
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serving: %w", err)
	}
	return nil
}
