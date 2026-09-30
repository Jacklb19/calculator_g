package main

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

const testTimeout = 5 * time.Second

func TestRunServesUntilContextIsCancelled(t *testing.T) {
	port := freePort(t)
	ctx, cancel := context.WithCancel(t.Context())
	done := startRun(ctx, map[string]string{"HOST": "127.0.0.1", "PORT": port})

	baseURL := "http://127.0.0.1:" + port
	waitUntilHealthy(t, baseURL)

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("run returned %v, want nil", err)
		}
	case <-time.After(testTimeout):
		t.Fatal("run did not return after context was cancelled")
	}

	if _, err := http.Get(baseURL + "/healthz"); err == nil {
		t.Error("server still accepting connections after shutdown")
	}
}

func TestRunServesStaticDir(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "index.html"), "<html>app</html>")
	port := freePort(t)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	startRun(ctx, map[string]string{"HOST": "127.0.0.1", "PORT": port, "STATIC_DIR": dir})

	baseURL := "http://127.0.0.1:" + port
	waitUntilHealthy(t, baseURL)

	resp, err := http.Get(baseURL + "/some/client/route")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "<html>app</html>" {
		t.Errorf("body = %q, want index.html", body)
	}
}

func TestRunFailsWhenPortIsTaken(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	port := strconv.Itoa(taken.Addr().(*net.TCPAddr).Port)

	err = run(t.Context(), envFrom(map[string]string{"HOST": "127.0.0.1", "PORT": port}), discardLogger())
	if err == nil {
		t.Fatal("want error for port already in use, got nil")
	}
}

func TestRunFailsOnInvalidConfig(t *testing.T) {
	err := run(t.Context(), envFrom(map[string]string{"PORT": "not-a-port"}), discardLogger())
	if err == nil {
		t.Fatal("want error for invalid PORT, got nil")
	}
}

func startRun(ctx context.Context, env map[string]string) <-chan error {
	done := make(chan error, 1)
	go func() { done <- run(ctx, envFrom(env), discardLogger()) }()
	return done
}

func freePort(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	return strconv.Itoa(listener.Addr().(*net.TCPAddr).Port)
}

func waitUntilHealthy(t *testing.T, baseURL string) {
	t.Helper()
	deadline := time.Now().Add(testTimeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(baseURL + "/healthz")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("server at %s did not become healthy within %s", baseURL, testTimeout)
}

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}
