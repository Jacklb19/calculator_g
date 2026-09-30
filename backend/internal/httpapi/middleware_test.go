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
