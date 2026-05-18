package extcal

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/emersion/go-webdav"
	"github.com/emersion/go-webdav/caldav"
)

func ensureHTTPSScheme(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	// 若用户只填了 host/path（很多客户端支持这种输入），默认补 https://
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	return "https://" + raw
}

func joinURLPath(base string, suffix string) string {
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return base
	}
	// suffix should be absolute path
	if !strings.HasPrefix(suffix, "/") {
		suffix = "/" + suffix
	}
	u.Path = suffix
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

func candidateEndpoints(endpoint string) []string {
	endpoint = ensureHTTPSScheme(endpoint)
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint == "" {
		return nil
	}

	// 先尝试原样；失败后再尝试常见的 CalDAV/WebDAV 发现路径。
	seen := map[string]bool{}
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		if !seen[s] {
			seen[s] = true
		}
	}
	add(endpoint)

	// RFC 6764: well-known
	add(joinURLPath(endpoint, "/.well-known/caldav"))

	// 常见厂商/实现路径（很多客户端会自动探测）
	add(joinURLPath(endpoint, "/dav"))
	add(joinURLPath(endpoint, "/caldav"))
	add(joinURLPath(endpoint, "/remote.php/dav"))
	add(joinURLPath(endpoint, "/remote.php/dav/calendars"))

	// 一些部署把 CalDAV 放在 /webdav 或 /dav/caldav 下
	add(joinURLPath(endpoint, "/webdav"))
	add(joinURLPath(endpoint, "/dav/caldav"))

	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	// 保持“原 endpoint 优先”的顺序：手工构造一个固定顺序
	ordered := []string{
		endpoint,
		joinURLPath(endpoint, "/.well-known/caldav"),
		joinURLPath(endpoint, "/dav"),
		joinURLPath(endpoint, "/caldav"),
		joinURLPath(endpoint, "/remote.php/dav"),
		joinURLPath(endpoint, "/remote.php/dav/calendars"),
		joinURLPath(endpoint, "/webdav"),
		joinURLPath(endpoint, "/dav/caldav"),
	}
	final := make([]string, 0, len(ordered))
	used := map[string]bool{}
	for _, c := range ordered {
		if c == "" || used[c] || !seen[c] {
			continue
		}
		used[c] = true
		final = append(final, c)
	}
	// 补齐剩余的（理论上不会太多）
	for _, c := range out {
		if !used[c] {
			final = append(final, c)
		}
	}
	return final
}

func caldavEndpointHint(endpoint string, err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	// 常见误配置：填了 OWA/Portal/Tomcat 普通页面，而非 CalDAV/WebDAV 端点，导致 PROPFIND 501。
	if strings.Contains(strings.ToUpper(msg), "PROPFIND") ||
		strings.Contains(msg, "501") ||
		strings.Contains(msg, "Not Implemented") ||
		strings.Contains(msg, "not supported by this URL") {
		return fmt.Errorf(
			"CalDAV 拉取失败：服务器不支持 WebDAV 方法（PROPFIND）。这通常表示 CalDAV 服务器地址填错了（指向普通网页/OWA/Tomcat，而不是 DAV 端点），或反向代理拦截了 PROPFIND。endpoint=%q，原始错误=%v。请改为真实 CalDAV endpoint（例如包含 /dav、/caldav、/.well-known/caldav、/principals 等路径），并确保网关允许 PROPFIND/REPORT 等方法",
			endpoint, err,
		)
	}
	return fmt.Errorf("CalDAV 拉取失败：endpoint=%q，错误=%w", endpoint, err)
}

func FetchCalDAVEvents(ctx context.Context, endpoint, username, password string, from, toInclusive time.Time) ([]ParsedEvent, error) {
	endpoint = strings.TrimSpace(endpoint)
	username = strings.TrimSpace(username)
	if endpoint == "" || username == "" || strings.TrimSpace(password) == "" {
		return nil, fmt.Errorf("missing endpoint or credentials")
	}

	// CalDAV expects a time range with an exclusive end.
	endExclusive := toInclusive.Add(24 * time.Hour)

	base := &http.Client{Timeout: 20 * time.Second}
	httpc := webdav.HTTPClientWithBasicAuth(base, username, password)
	var lastErr error
	var usedEndpoint string
	var cals []caldav.Calendar
	var c *caldav.Client
	for _, ep := range candidateEndpoints(endpoint) {
		cc, err := caldav.NewClient(httpc, ep)
		if err != nil {
			lastErr = err
			continue
		}
		principal, err := cc.FindCurrentUserPrincipal(ctx)
		if err != nil {
			lastErr = err
			continue
		}
		home, err := cc.FindCalendarHomeSet(ctx, principal)
		if err != nil {
			lastErr = err
			continue
		}
		found, err := cc.FindCalendars(ctx, home)
		if err != nil {
			lastErr = err
			continue
		}
		if len(found) == 0 {
			lastErr = fmt.Errorf("no calendars found")
			continue
		}
		usedEndpoint = ep
		cals = found
		c = cc
		lastErr = nil
		break
	}
	if lastErr != nil || c == nil || len(cals) == 0 {
		return nil, caldavEndpointHint(endpoint, lastErr)
	}

	// Pick first calendar that supports VEVENT; fallback to first.
	targetPath := cals[0].Path
	for _, cal := range cals {
		for _, comp := range cal.SupportedComponentSet {
			if strings.EqualFold(comp, "VEVENT") {
				targetPath = cal.Path
				break
			}
		}
	}

	query := &caldav.CalendarQuery{
		CompRequest: caldav.CalendarCompRequest{
			Name:     "VCALENDAR",
			AllComps: true,
		},
		CompFilter: caldav.CompFilter{
			Name:  "VCALENDAR",
			Comps: []caldav.CompFilter{{Name: "VEVENT", Start: from, End: endExclusive}},
		},
	}
	objs, err := c.QueryCalendar(ctx, targetPath, query)
	if err != nil {
		// 这里用最终发现到的 endpoint 回报更准确（用户填写的可能只是入口）
		if strings.TrimSpace(usedEndpoint) == "" {
			usedEndpoint = endpoint
		}
		return nil, caldavEndpointHint(usedEndpoint, err)
	}

	var out []ParsedEvent
	for _, obj := range objs {
		if obj.Data == nil {
			continue
		}
		for _, ev := range obj.Data.Events() {
			title, _ := ev.Props.Text("SUMMARY")
			if strings.TrimSpace(title) == "" {
				title = "(无标题)"
			}

			start, err := ev.DateTimeStart(time.Local)
			if err != nil {
				continue
			}
			end, err := ev.DateTimeEnd(time.Local)
			if err != nil {
				end = start.Add(time.Hour)
			}

			allDay := false
			if p := ev.Props.Get("DTSTART"); p != nil {
				if strings.EqualFold(fmt.Sprint(p.ValueType()), "DATE") {
					allDay = true
				}
			}

			if !intersectsWindow(start, end, from, endExclusive) {
				continue
			}
			out = append(out, ParsedEvent{
				Title:  title,
				Start:  start,
				End:    end,
				AllDay: allDay,
			})
		}
	}
	return out, nil
}
