package httpapi_test

import (
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/Jacklb19/calculator/backend/internal/httpapi"
)

const jsonType = "application/json"

type errorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type calculateResponse struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
	Result    float64   `json:"result"`
}

func TestCalculateReturnsResult(t *testing.T) {
	tests := []struct {
		name        string
		operation   string
		contentType string
		body        string
		want        calculateResponse
	}{
		{"add", "add", jsonType, `{"operands":[2,3]}`, calculateResponse{"add", []float64{2, 3}, 5}},
		{"subtract", "subtract", jsonType, `{"operands":[3,5]}`, calculateResponse{"subtract", []float64{3, 5}, -2}},
		{"multiply", "multiply", jsonType, `{"operands":[1.5,4]}`, calculateResponse{"multiply", []float64{1.5, 4}, 6}},
		{"divide", "divide", jsonType, `{"operands":[10,4]}`, calculateResponse{"divide", []float64{10, 4}, 2.5}},
		{"power", "power", jsonType, `{"operands":[2,10]}`, calculateResponse{"power", []float64{2, 10}, 1024}},
		{"sqrt", "sqrt", jsonType, `{"operands":[16]}`, calculateResponse{"sqrt", []float64{16}, 4}},
		{"percentage", "percentage", jsonType, `{"operands":[50,200]}`, calculateResponse{"percentage", []float64{50, 200}, 100}},
		{"content type with charset", "add", "application/json; charset=utf-8", `{"operands":[1,1]}`, calculateResponse{"add", []float64{1, 1}, 2}},
		{"surrounding whitespace", "add", jsonType, "\n {\"operands\":[1,1]} \n", calculateResponse{"add", []float64{1, 1}, 2}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serve(t, newHandler(nil), http.MethodPost, "/api/v1/calculate/"+tt.operation, tt.contentType, tt.body)

			assertJSONResponse(t, rec, http.StatusOK)
			got := decode[calculateResponse](t, rec)
			if got.Operation != tt.want.Operation || got.Result != tt.want.Result || !slices.Equal(got.Operands, tt.want.Operands) {
				t.Errorf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestCalculateReturnsError(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		path        string
		contentType string
		body        string
		wantStatus  int
		wantCode    string
		wantAllow   string
	}{
		{"malformed JSON", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,2`, 400, "INVALID_JSON", ""},
		{"empty body", "POST", "/api/v1/calculate/add", jsonType, ``, 400, "INVALID_JSON", ""},
		{"unknown field", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,2],"extra":true}`, 400, "INVALID_JSON", ""},
		{"trailing object", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,2]}{}`, 400, "INVALID_JSON", ""},
		{"trailing garbage", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,2]} x`, 400, "INVALID_JSON", ""},
		{"top-level array", "POST", "/api/v1/calculate/add", jsonType, `[1,2]`, 400, "INVALID_JSON", ""},

		{"missing operands", "POST", "/api/v1/calculate/add", jsonType, `{}`, 400, "INVALID_OPERANDS", ""},
		{"null operands", "POST", "/api/v1/calculate/add", jsonType, `{"operands":null}`, 400, "INVALID_OPERANDS", ""},
		{"null operand", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,null]}`, 400, "INVALID_OPERANDS", ""},
		{"string operand", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,"5"]}`, 400, "INVALID_OPERANDS", ""},
		{"operands not an array", "POST", "/api/v1/calculate/add", jsonType, `{"operands":{"a":1}}`, 400, "INVALID_OPERANDS", ""},
		{"number beyond float64", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1e400,1]}`, 400, "INVALID_OPERANDS", ""},
		{"empty operands", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[]}`, 400, "INVALID_OPERANDS", ""},
		{"too many operands", "POST", "/api/v1/calculate/sqrt", jsonType, `{"operands":[4,9]}`, 400, "INVALID_OPERANDS", ""},

		{"unknown operation", "POST", "/api/v1/calculate/modulo", jsonType, `{"operands":[1,2]}`, 404, "UNKNOWN_OPERATION", ""},
		{"unknown operation wins over bad body", "POST", "/api/v1/calculate/modulo", "text/plain", `not json`, 404, "UNKNOWN_OPERATION", ""},
		{"unknown api path", "GET", "/api/v1/nope", "", ``, 404, "NOT_FOUND", ""},
		{"unknown api version", "POST", "/api/v2/calculate/add", jsonType, `{"operands":[1,2]}`, 404, "NOT_FOUND", ""},
		{"extra path segment", "POST", "/api/v1/calculate/add/more", jsonType, `{"operands":[1,2]}`, 404, "NOT_FOUND", ""},

		{"GET on calculate", "GET", "/api/v1/calculate/add", "", ``, 405, "METHOD_NOT_ALLOWED", "POST"},
		{"DELETE on calculate", "DELETE", "/api/v1/calculate/add", "", ``, 405, "METHOD_NOT_ALLOWED", "POST"},

		{"oversized body", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[` + strings.Repeat("1,", 1024) + `1]}`, 413, "PAYLOAD_TOO_LARGE", ""},
		{"oversized trailing data", "POST", "/api/v1/calculate/add", jsonType, `{"operands":[1,2]}` + strings.Repeat(" ", 2048), 413, "PAYLOAD_TOO_LARGE", ""},

		{"missing content type", "POST", "/api/v1/calculate/add", "", `{"operands":[1,2]}`, 415, "UNSUPPORTED_MEDIA_TYPE", ""},
		{"wrong content type", "POST", "/api/v1/calculate/add", "text/plain", `{"operands":[1,2]}`, 415, "UNSUPPORTED_MEDIA_TYPE", ""},
		{"json-like content type", "POST", "/api/v1/calculate/add", "application/json-patch+json", `{"operands":[1,2]}`, 415, "UNSUPPORTED_MEDIA_TYPE", ""},

		{"division by zero", "POST", "/api/v1/calculate/divide", jsonType, `{"operands":[1,0]}`, 422, "DIVISION_BY_ZERO", ""},
		{"zero to negative power", "POST", "/api/v1/calculate/power", jsonType, `{"operands":[0,-1]}`, 422, "DIVISION_BY_ZERO", ""},
		{"sqrt of negative", "POST", "/api/v1/calculate/sqrt", jsonType, `{"operands":[-4]}`, 422, "DOMAIN_ERROR", ""},
		{"fractional power of negative", "POST", "/api/v1/calculate/power", jsonType, `{"operands":[-8,0.5]}`, 422, "DOMAIN_ERROR", ""},
		{"overflow", "POST", "/api/v1/calculate/multiply", jsonType, `{"operands":[1e308,10]}`, 422, "RESULT_OUT_OF_RANGE", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serve(t, newHandler(nil), tt.method, tt.path, tt.contentType, tt.body)

			assertJSONResponse(t, rec, tt.wantStatus)
			got := decode[errorResponse](t, rec)
			if got.Error.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", got.Error.Code, tt.wantCode)
			}
			if got.Error.Message == "" {
				t.Error("message is empty")
			}
			if allow := rec.Header().Get("Allow"); allow != tt.wantAllow {
				t.Errorf("Allow = %q, want %q", allow, tt.wantAllow)
			}
		})
	}
}

func TestHealth(t *testing.T) {
	rec := serve(t, newHandler(nil), http.MethodGet, "/healthz", "", "")

	assertJSONResponse(t, rec, http.StatusOK)
	if got := decode[map[string]string](t, rec); got["status"] != "ok" {
		t.Errorf("got %v, want status ok", got)
	}
}

func TestStaticFiles(t *testing.T) {
	static := fstest.MapFS{
		"index.html":    {Data: []byte("<html>app</html>")},
		"assets/app.js": {Data: []byte("console.log('app')")},
	}
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
		wantBody   string
	}{
		{"root serves index", "GET", "/", 200, "<html>app</html>"},
		{"existing file", "GET", "/assets/app.js", 200, "console.log('app')"},
		{"client-side route falls back to index", "GET", "/history/42", 200, "<html>app</html>"},
		{"directory falls back to index", "GET", "/assets/", 200, "<html>app</html>"},
		{"non-GET is rejected", "POST", "/history", 405, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serve(t, newHandler(static), tt.method, tt.path, "", "")

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantBody != "" && rec.Body.String() != tt.wantBody {
				t.Errorf("body = %q, want %q", rec.Body.String(), tt.wantBody)
			}
		})
	}
}

func TestStaticFilesNeverShadowAPI(t *testing.T) {
	static := fstest.MapFS{"index.html": {Data: []byte("<html>app</html>")}}

	rec := serve(t, newHandler(static), http.MethodGet, "/api/v1/unknown", "", "")

	assertJSONResponse(t, rec, http.StatusNotFound)
	if got := decode[errorResponse](t, rec); got.Error.Code != "NOT_FOUND" {
		t.Errorf("code = %q, want NOT_FOUND", got.Error.Code)
	}
}

func newHandler(static fs.FS) http.Handler {
	return httpapi.NewHandler(slog.New(slog.DiscardHandler), static)
}

func serve(t *testing.T, h http.Handler, method, target, contentType, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func assertJSONResponse(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Errorf("status = %d, want %d (body: %s)", rec.Code, wantStatus, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != jsonType {
		t.Errorf("Content-Type = %q, want %q", ct, jsonType)
	}
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.NewDecoder(rec.Body).Decode(&v); err != nil {
		t.Fatalf("decoding response %q: %v", rec.Body, err)
	}
	return v
}
