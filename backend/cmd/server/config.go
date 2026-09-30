package main

import (
	"fmt"
	"io/fs"
	"net"
	"os"
	"path/filepath"
	"strconv"
)

const defaultPort = 8080

type config struct {
	host      string
	port      int
	staticDir string
}

func loadConfig(getenv func(string) string) (config, error) {
	port, err := parsePort(getenv("PORT"))
	if err != nil {
		return config{}, err
	}
	staticDir := getenv("STATIC_DIR")
	if err := validateStaticDir(staticDir); err != nil {
		return config{}, err
	}
	return config{host: getenv("HOST"), port: port, staticDir: staticDir}, nil
}

func parsePort(raw string) (int, error) {
	if raw == "" {
		return defaultPort, nil
	}
	port, err := strconv.Atoi(raw)
	if err != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("invalid PORT %q: must be an integer between 1 and 65535", raw)
	}
	return port, nil
}

func validateStaticDir(dir string) error {
	if dir == "" {
		return nil
	}
	if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
		return fmt.Errorf("invalid STATIC_DIR %q: %w", dir, err)
	}
	return nil
}

func (c config) addr() string {
	return net.JoinHostPort(c.host, strconv.Itoa(c.port))
}

func (c config) staticFS() fs.FS {
	if c.staticDir == "" {
		return nil
	}
	return os.DirFS(c.staticDir)
}
