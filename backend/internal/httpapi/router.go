package httpapi

import (
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
)

type server struct {
	logger *slog.Logger
}

// NewHandler returns the application's HTTP handler. When static is non-nil
// it is served as a single-page app on every path outside /api and /healthz.
func NewHandler(logger *slog.Logger, static fs.FS) http.Handler {
	s := &server{logger: logger}

	mux := http.NewServeMux()
	mux.Handle("/api/", s.withJSONFallback(s.apiRoutes()))
	mux.HandleFunc("GET /healthz", s.handleHealth)
	if static != nil {
		mux.Handle("/", spa(static))
	}
	return s.logRequests(s.recoverPanics(mux))
}

func (s *server) apiRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate/{operation}", s.handleCalculate)
	return mux
}

// withJSONFallback replaces the mux's built-in plain-text 404 and 405
// responses with the API's JSON error shape, keeping the Allow header.
func (s *server) withJSONFallback(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fallback, pattern := mux.Handler(r)
		if pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}

		captured := newCaptureWriter()
		fallback.ServeHTTP(captured, r)
		if captured.status == http.StatusMethodNotAllowed {
			w.Header().Set("Allow", captured.header.Get("Allow"))
			s.writeError(w, fmt.Errorf("%w: %s", errMethodNotAllowed, r.Method))
			return
		}
		s.writeError(w, fmt.Errorf("%w: %s", errNotFound, r.URL.Path))
	})
}

type captureWriter struct {
	header http.Header
	status int
}

func newCaptureWriter() *captureWriter {
	return &captureWriter{header: http.Header{}, status: http.StatusOK}
}

func (c *captureWriter) Header() http.Header         { return c.header }
func (c *captureWriter) Write(p []byte) (int, error) { return len(p), nil }
func (c *captureWriter) WriteHeader(status int)      { c.status = status }
