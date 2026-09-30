package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"
)

const testTimeout = 5 * time.Second

func TestRunServesUntilContextIsCancelled(t *testing.T) {
	port := freePort(t)
	stop := startRun(t, map[string]string{"HOST": "127.0.0.1", "PORT": port})

	baseURL := "http://127.0.0.1:" + port
	waitUntilHealthy(t, baseURL)

	if err := stop(); err != nil {
		t.Fatalf("run returned %v, want nil", err)
	}
	if resp, err := http.Get(baseURL + "/healthz"); err == nil {
		resp.Body.Close()
		t.Error("server still accepting connections after shutdown")
	}
}

func TestRunServesStaticDir(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "index.html"), "<html>app</html>")
	port := freePort(t)
	startRun(t, map[string]string{"HOST": "127.0.0.1", "PORT": port, "STATIC_DIR": dir})

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

func TestServeClosesConnectionsWhenShutdownTimesOut(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	srv := newServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}), discardLogger())

	ctx, cancel := context.WithCancel(t.Context())
	served := make(chan error, 1)
	go func() { served <- serve(ctx, srv, listener, discardLogger(), 50*time.Millisecond) }()

	requested := make(chan error, 1)
	go func() {
		resp, err := http.Get("http://" + listener.Addr().String())
		if err == nil {
			resp.Body.Close()
		}
		requested <- err
	}()
	waitFor(t, started, "the request to reach the handler")
	cancel()

	if err := receive(t, served, "serve to return"); !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("serve returned %v, want context.DeadlineExceeded", err)
	}
	if err := receive(t, requested, "the in-flight request to be cut off"); err == nil {
		t.Error("in-flight request completed normally, want its connection closed")
	}
}

func waitFor(t *testing.T, ch <-chan struct{}, what string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(testTimeout):
		t.Fatalf("timed out waiting for %s", what)
	}
}

func receive(t *testing.T, ch <-chan error, what string) error {
	t.Helper()
	select {
	case err := <-ch:
		return err
	case <-time.After(testTimeout):
		t.Fatalf("timed out waiting for %s", what)
		return nil
	}
}

// startRun runs the server in the background. The returned stop cancels it and waits for run to
// return; it also runs on test cleanup, so no server outlives its test.
func startRun(t *testing.T, env map[string]string) (stop func() error) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- run(ctx, envFrom(env), discardLogger()) }()

	stop = sync.OnceValue(func() error {
		// The client may hold a spare connection that never sent a request; Shutdown treats
		// those as active for up to 5s, so release them first.
		http.DefaultClient.CloseIdleConnections()
		cancel()
		select {
		case err := <-done:
			return err
		case <-time.After(testTimeout):
			return errors.New("run did not return after its context was cancelled")
		}
	})
	t.Cleanup(func() {
		if err := stop(); err != nil {
			t.Error(err)
		}
	})
	return stop
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
