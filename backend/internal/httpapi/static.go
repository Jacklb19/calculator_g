package httpapi

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// spa serves files from static and falls back to index.html for any path
// that isn't a file, so client-side routes survive a page reload.
func spa(static fs.FS) http.Handler {
	fileServer := http.FileServerFS(static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}
		if !isFile(static, r.URL.Path) {
			http.ServeFileFS(w, r, static, "index.html")
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func isFile(fsys fs.FS, urlPath string) bool {
	info, err := fs.Stat(fsys, strings.TrimPrefix(path.Clean(urlPath), "/"))
	return err == nil && !info.IsDir()
}
