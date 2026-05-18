package zentao

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLoginByFormAcceptsLoginLikeResponseAfterSessionVerified(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/zentao/user-login.html", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			http.SetCookie(w, &http.Cookie{Name: "anon", Value: "1", Path: "/"})
			_, _ = w.Write([]byte(`<html><body><form action="/zentao/do-login"><input type="hidden" name="token" value="abc"><input name="account"><input name="password"></form></body></html>`))
		case http.MethodPost:
			if err := r.ParseForm(); err != nil {
				t.Fatalf("parse form: %v", err)
			}
			if got := r.Form.Get("token"); got != "abc" {
				t.Fatalf("expected hidden token to be posted, got %q", got)
			}
			if r.Form.Get("account") != "alice" || r.Form.Get("password") != "secret" {
				t.Fatalf("unexpected credential payload: %v", r.Form)
			}
			http.SetCookie(w, &http.Cookie{Name: "auth", Value: "ok", Path: "/"})
			// 模拟一个“看起来仍像登录页”的成功返回，旧逻辑会在这里误判失败。
			_, _ = w.Write([]byte(`<html><body><script>self.location='/zentao/user-login.html'</script></body></html>`))
		default:
			t.Fatalf("unexpected method %s", r.Method)
		}
	})
	mux.HandleFunc("/zentao/do-login", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if got := r.Form.Get("token"); got != "abc" {
			t.Fatalf("expected hidden token to be posted, got %q", got)
		}
		http.SetCookie(w, &http.Cookie{Name: "auth", Value: "ok", Path: "/"})
		_, _ = w.Write([]byte(`<html><body><script>self.location='/zentao/user-login.html'</script></body></html>`))
	})
	mux.HandleFunc("/zentao/my/", func(w http.ResponseWriter, r *http.Request) {
		if ck, err := r.Cookie("auth"); err == nil && ck.Value == "ok" {
			_, _ = w.Write([]byte(`<html><body><h1>workspace</h1></body></html>`))
			return
		}
		_, _ = w.Write([]byte(`<html><body><form><input name="account"><input name="password"></form></body></html>`))
	})
	mux.HandleFunc("/zentao/user-view-myself.html", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/zentao/my/", http.StatusFound)
	})
	mux.HandleFunc("/zentao/index.html", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/zentao/my/", http.StatusFound)
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	got, err := LoginByForm(context.Background(), srv.URL+"/zentao/user-login.html", "alice", "secret")
	if err != nil {
		t.Fatalf("expected login success, got error: %v", err)
	}
	if got == nil {
		t.Fatal("expected login result, got nil")
	}
	if got.FinalURL == "" {
		t.Fatal("expected final url to be set")
	}
	if len(got.Cookies) == 0 {
		t.Fatal("expected returned cookies")
	}
}

func TestDeriveBaseURLFromLoginURL(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"https://zentao.example.com/user-login.html", "https://zentao.example.com"},
		{"https://zentao.example.com/zentao/user-login-L3plbnRhby8=.html?keepLogin=1", "https://zentao.example.com/zentao"},
	}
	for _, tc := range cases {
		t.Run(strings.ReplaceAll(tc.in, "https://", ""), func(t *testing.T) {
			if got := deriveBaseURLFromLoginURL(tc.in); got != tc.want {
				t.Fatalf("deriveBaseURLFromLoginURL(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestVerifySessionAfterLoginRejectsUnauthedLoginPage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/user-login.html", "/my/", "/user-view-myself.html", "/index.html":
			_, _ = fmt.Fprint(w, `<html><body><form><input name="account"><input name="password"></form></body></html>`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	if verifySessionAfterLogin(context.Background(), srv.Client(), srv.URL+"/user-login.html") {
		t.Fatal("expected unauthenticated login page to fail session verification")
	}
}
