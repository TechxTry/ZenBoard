package zentao

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type LoginResult struct {
	FinalURL string
	Cookies  []*http.Cookie
}

// LoginByForm tries to login Zentao via POST form.
// It returns cookies captured by the client jar.
func LoginByForm(ctx context.Context, loginURL, account, password string) (*LoginResult, error) {
	loginURL = strings.TrimSpace(loginURL)
	if loginURL == "" {
		return nil, fmt.Errorf("login url is empty")
	}
	if strings.TrimSpace(account) == "" {
		return nil, fmt.Errorf("account is empty")
	}
	if strings.TrimSpace(password) == "" {
		return nil, fmt.Errorf("password is empty")
	}

	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Timeout: 20 * time.Second,
		Jar:     jar,
	}

	// Step 1: GET 登录页，拿隐藏字段（token/verifyRand 等）以及可能的真实 form action。
	form := url.Values{}
	targetURL := loginURL
	reqGet, err := http.NewRequestWithContext(ctx, http.MethodGet, loginURL, nil)
	if err == nil {
		reqGet.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		if respGet, getErr := client.Do(reqGet); getErr == nil {
			func() {
				defer respGet.Body.Close()
				bodyB, _ := io.ReadAll(io.LimitReader(respGet.Body, 128*1024))
				body := string(bodyB)
				for k, v := range extractHiddenInputs(body) {
					form.Set(k, v)
				}
				if action := extractLoginFormAction(body); action != "" {
					if u, pErr := url.Parse(loginURL); pErr == nil {
						if a, aErr := u.Parse(action); aErr == nil {
							targetURL = a.String()
						}
					}
				}
			}()
		}
	}

	form.Set("account", account)
	form.Set("password", password)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("login request failed with http %d", resp.StatusCode)
	}

	// Read small body snippet for detecting obvious failure text
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	body := string(b)
	if strings.Contains(body, "登录失败") || strings.Contains(strings.ToLower(body), "login failed") {
		return nil, fmt.Errorf("login failed")
	}
	cookies := collectLoginCookies(jar, targetURL, resp)
	if len(cookies) == 0 {
		return nil, fmt.Errorf("login seems unsuccessful (no cookies returned)")
	}
	// Some Zentao instances return 200 + login-like HTML even after the
	// credentials have been accepted. Verify the session with the same cookie jar
	// before concluding that login really failed.
	if looksLikeLoginPage(resp, body) && !verifySessionAfterLogin(ctx, client, loginURL) {
		return nil, fmt.Errorf("login failed")
	}

	return &LoginResult{
		FinalURL: resp.Request.URL.String(),
		Cookies:  cookies,
	}, nil
}

func collectLoginCookies(jar http.CookieJar, targetURL string, resp *http.Response) []*http.Cookie {
	if jar == nil {
		return nil
	}
	u, _ := url.Parse(targetURL)
	cookies := jar.Cookies(u)
	if len(cookies) == 0 && resp != nil && resp.Request != nil && resp.Request.URL != nil {
		// Sometimes cookies are set on the redirect target host; try resp.Request.URL.
		cookies = jar.Cookies(resp.Request.URL)
	}
	return cookies
}

func verifySessionAfterLogin(ctx context.Context, client *http.Client, loginURL string) bool {
	baseURL := deriveBaseURLFromLoginURL(loginURL)
	if baseURL == "" || client == nil {
		return false
	}
	targets := []string{
		baseURL + "/my/",
		baseURL + "/user-view-myself.html",
		baseURL + "/index.html",
	}
	for _, target := range targets {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		resp, err := client.Do(req)
		if err != nil {
			continue
		}
		bodyB, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
		_ = resp.Body.Close()
		body := string(bodyB)
		if resp.StatusCode >= 200 && resp.StatusCode < 400 && !looksLikeLoginPage(resp, body) {
			return true
		}
	}
	return false
}

func deriveBaseURLFromLoginURL(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u == nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	u.RawQuery = ""
	u.Fragment = ""
	path := strings.TrimRight(u.Path, "/")
	if idx := strings.LastIndex(path, "/"); idx >= 0 {
		u.Path = path[:idx]
	} else {
		u.Path = ""
	}
	if u.Path == "/" {
		u.Path = ""
	}
	return strings.TrimRight(u.String(), "/")
}

func extractHiddenInputs(html string) map[string]string {
	out := map[string]string{}
	if strings.TrimSpace(html) == "" {
		return out
	}
	// 匹配 hidden input，并抽取 name/value。兼容单/双引号与属性顺序差异。
	reInput := regexp.MustCompile(`(?is)<input[^>]*type=['"]hidden['"][^>]*>`)
	reName := regexp.MustCompile(`(?is)\bname=['"]([^'"]+)['"]`)
	reValue := regexp.MustCompile(`(?is)\bvalue=['"]([^'"]*)['"]`)
	for _, input := range reInput.FindAllString(html, -1) {
		mn := reName.FindStringSubmatch(input)
		if len(mn) < 2 {
			continue
		}
		mv := reValue.FindStringSubmatch(input)
		val := ""
		if len(mv) >= 2 {
			val = mv[1]
		}
		out[strings.TrimSpace(mn[1])] = val
	}
	return out
}

func extractLoginFormAction(html string) string {
	if strings.TrimSpace(html) == "" {
		return ""
	}
	// 优先找包含 account/password 字段的 form，再拿 action。
	reForm := regexp.MustCompile(`(?is)<form[^>]*>.*?(name=['"]account['"]|id=['"]account['"]).*?(name=['"]password['"]|id=['"]password['"]).*?</form>`)
	form := reForm.FindString(html)
	if form == "" {
		return ""
	}
	reAction := regexp.MustCompile(`(?is)<form[^>]*\baction=['"]([^'"]+)['"]`)
	m := reAction.FindStringSubmatch(form)
	if len(m) < 2 {
		return ""
	}
	return strings.TrimSpace(m[1])
}
