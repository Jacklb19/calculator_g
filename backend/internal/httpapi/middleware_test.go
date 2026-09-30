package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoverPanicsReturnsGenericInternalError(t *testing.T) {
	s := &server{logger: slog.New(slog.DiscardHandler)}
	h := s.recoverPanics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("secret detail")
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var got errorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	want := errorBody{Code: "INTERNAL_ERROR", Message: "internal server error"}
	if got.Error != want {
		t.Errorf("got %+v, want %+v", got.Error, want)
	}
}

func TestRecoverPanicsAbortsWhenTheResponseHasStarted(t *testing.T) {
	tests := []struct {
		name  string
		start func(w http.ResponseWriter)
	}{
		{"after WriteHeader", func(w http.ResponseWriter) { w.WriteHeader(http.StatusOK) }},
		{"after an implicit header from Write", func(w http.ResponseWriter) { _, _ = w.Write([]byte("partial")) }},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &server{logger: slog.New(slog.DiscardHandler)}
			h := s.recoverPanics(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				tt.start(w)
				panic("boom")
			}))
			rec := httptest.NewRecorder()

			defer func() {
				if got := recover(); got != http.ErrAbortHandler {
					t.Errorf("recovered %v, want http.ErrAbortHandler", got)
				}
				if strings.Contains(rec.Body.String(), "INTERNAL_ERROR") {
					t.Errorf("error JSON appended to a response already in progress: %q", rec.Body)
				}
			}()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		})
	}
}

func TestLogRequestsRecordsTheFirstStatusOnly(t *testing.T) {
	var logs bytes.Buffer
	s := &server{logger: slog.New(slog.NewTextHandler(&logs, nil))}
	h := s.logRequests(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		w.WriteHeader(http.StatusInternalServerError)
	}))

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if !strings.Contains(logs.String(), "status=202") {
		t.Errorf("log %q does not report the status actually sent", logs.String())
	}
}

func TestRecoverPanicsRepanicsOnAbortHandler(t *testing.T) {
	s := &server{logger: slog.New(slog.DiscardHandler)}
	h := s.recoverPanics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	defer func() {
		if rec := recover(); rec != http.ErrAbortHandler {
			t.Errorf("recovered %v, want http.ErrAbortHandler", rec)
		}
	}()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
}

func TestLogRequestsRecordsStatus(t *testing.T) {
	var logs bytes.Buffer
	s := &server{logger: slog.New(slog.NewTextHandler(&logs, nil))}
	h := s.logRequests(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v1/calculate/add", nil))

	for _, want := range []string{"method=POST", "path=/api/v1/calculate/add", "status=418"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q does not contain %q", logs.String(), want)
		}
	}
}
