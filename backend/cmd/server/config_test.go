package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfigPort(t *testing.T) {
	tests := []struct {
		raw     string
		want    int
		wantErr bool
	}{
		{raw: "", want: defaultPort},
		{raw: "3000", want: 3000},
		{raw: "1", want: 1},
		{raw: "65535", want: 65535},
		{raw: "0", wantErr: true},
		{raw: "65536", wantErr: true},
		{raw: "-80", wantErr: true},
		{raw: "http", wantErr: true},
		{raw: " 80", wantErr: true},
		{raw: "80.5", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			cfg, err := loadConfig(envFrom(map[string]string{"PORT": tt.raw}))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("got port %d, want error", cfg.port)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if cfg.port != tt.want {
				t.Errorf("port = %d, want %d", cfg.port, tt.want)
			}
		})
	}
}

func TestLoadConfigStaticDir(t *testing.T) {
	withIndex := t.TempDir()
	writeFile(t, filepath.Join(withIndex, "index.html"), "<html></html>")

	tests := []struct {
		name    string
		dir     string
		wantErr bool
	}{
		{name: "unset", dir: ""},
		{name: "directory with index.html", dir: withIndex},
		{name: "directory without index.html", dir: t.TempDir(), wantErr: true},
		{name: "missing directory", dir: filepath.Join(t.TempDir(), "missing"), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := loadConfig(envFrom(map[string]string{"STATIC_DIR": tt.dir}))
			if tt.wantErr {
				if err == nil {
					t.Fatal("want error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if (cfg.staticFS() == nil) != (tt.dir == "") {
				t.Errorf("staticFS() nil = %v, want %v", cfg.staticFS() == nil, tt.dir == "")
			}
		})
	}
}

func TestConfigAddr(t *testing.T) {
	tests := []struct {
		host string
		want string
	}{
		{host: "", want: ":8080"},
		{host: "127.0.0.1", want: "127.0.0.1:8080"},
		{host: "::1", want: "[::1]:8080"},
	}

	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			cfg := config{host: tt.host, port: 8080}
			if got := cfg.addr(); got != tt.want {
				t.Errorf("addr() = %q, want %q", got, tt.want)
			}
		})
	}
}

func envFrom(env map[string]string) func(string) string {
	return func(key string) string { return env[key] }
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
