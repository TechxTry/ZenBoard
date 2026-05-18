package zentao

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// errAPIUnauthorized 表示 Token 过期/无效，由调用方负责重新登录换 Token。
var errAPIUnauthorized = errors.New("zentao api unauthorized")

func IsAPIUnauthorizedError(err error) bool {
	return errors.Is(err, errAPIUnauthorized)
}

// APIHTTPError 结构化承载禅道 API 非 2xx 响应，便于上层按 Status 决策（例如 404 才回落 webform）。
type APIHTTPError struct {
	Status int
	URL    string
	Body   string
}

func (e *APIHTTPError) Error() string {
	return fmt.Sprintf("zentao api http %d (%s): %s", e.Status, e.URL, e.Body)
}

func IsAPIHTTPError(err error) (*APIHTTPError, bool) {
	var he *APIHTTPError
	if errors.As(err, &he) {
		return he, true
	}
	return nil, false
}

// APIClient 对应禅道企业版/旗舰版 REST API v1。
type APIClient struct {
	BaseURL string
	HTTP    *http.Client
}

func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		BaseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		HTTP: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// APILoginResult 是 /api.php/v1/tokens 的成功响应。
// 禅道常见返回 {"token":"xxx","expire":"7200"} 或 {"token":"xxx"}；部分版本用数字秒数。
type APILoginResult struct {
	Token   string `json:"token"`
	Expire  int64  `json:"expire,omitempty"` // 秒；部分版本缺省
	Account string `json:"account,omitempty"`
}

// APILogin 使用账号密码换 Bearer Token。
func (c *APIClient) APILogin(ctx context.Context, account, password string) (*APILoginResult, error) {
	body := map[string]string{"account": account, "password": password}
	buf, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api.php/v1/tokens", bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, &APIHTTPError{Status: resp.StatusCode, URL: req.URL.String(), Body: snippet(string(raw))}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &APIHTTPError{Status: resp.StatusCode, URL: req.URL.String(), Body: snippet(string(raw))}
	}

	var out APILoginResult
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("zentao api login: invalid json: %w; body=%s", err, snippet(string(raw)))
	}
	if strings.TrimSpace(out.Token) == "" {
		return nil, fmt.Errorf("zentao api login: empty token in response: %s", snippet(string(raw)))
	}
	return &out, nil
}

// APIGetMe 用已有 Token 调 /api.php/v1/user 验证 Token 有效且返回账号名。
func (c *APIClient) APIGetMe(ctx context.Context, token string) (account string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/api.php/v1/user", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Token", token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode == http.StatusUnauthorized {
		return "", errAPIUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", &APIHTTPError{Status: resp.StatusCode, URL: req.URL.String(), Body: snippet(string(raw))}
	}

	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return "", fmt.Errorf("zentao api user: invalid json: %w; body=%s", err, snippet(string(raw)))
	}
	if v, ok := m["account"].(string); ok && v != "" {
		return v, nil
	}
	return "", nil
}

// APICreateTaskEffortInput 与 webform 版共用 CreateTaskEffortInput 结构不便，这里单独定义以对齐 JSON 字段。
type APICreateTaskEffortInput struct {
	TaskID   int64
	WorkDate string // YYYY-MM-DD
	Work     string
	Consumed float64
	Left     float64
}

// APICreateTaskEffortResult 包含 API 成功响应中常见的字段。
type APICreateTaskEffortResult struct {
	ID          int64          `json:"id,omitempty"`
	ObjectID    int64          `json:"objectID,omitempty"`
	ObjectType  string         `json:"objectType,omitempty"`
	RawBody     string         `json:"raw_body,omitempty"`
	Fields      map[string]any `json:"fields,omitempty"`
	UsedURL     string         `json:"used_url,omitempty"`
	UsedVariant string         `json:"used_variant,omitempty"`
	// TaskConsumedAfter：响应是 task 详情快照时，task.consumed 的当前值。弱信号。
	TaskConsumedAfter float64 `json:"task_consumed_after,omitempty"`
	// VerifyAttempted / VerifyMatched：POST 后 GET 任务日志列表做的二次校验结果。
	// 只有 VerifyMatched=true 才能证明 effort 真正插入到 zt_effort 表里。
	VerifyAttempted bool   `json:"verify_attempted,omitempty"`
	VerifyMatched   bool   `json:"verify_matched,omitempty"`
	VerifyError     string `json:"verify_error,omitempty"`
}

// 报工 API 的三种 body 变体。禅道版本之间字段名/路径不同，需要逐个试。
const (
	VariantEstimateModern  = "estimate-modern"  // 开源 ≥20.7 / 企业 ≥10.6 / 旗舰 ≥5.6：date / work / consumed / left（数组）
	VariantEstimateLegacy  = "estimate-legacy"  // 老版本：id / objectID / objectType / dates / work / consumed / left（数组）
	VariantEffortsFallback = "efforts-fallback" // 极少数自定义分支：POST /efforts 单条对象
)

// AllEffortVariants 给 handler 用的默认顺序。
var AllEffortVariants = []string{
	VariantEstimateModern,
	VariantEstimateLegacy,
	VariantEffortsFallback,
}

// ErrAPIEffortNotPersisted：API 返回 200 + task 详情，但 task.consumed 没有按预期增加。
// 表示这个变体的 body 字段被禅道忽略了，handler 应该尝试下一个变体。
var ErrAPIEffortNotPersisted = errors.New("zentao api returned 200 but task.consumed did not increase; effort likely NOT persisted")

// APITaskEffort 是 GET /api.php/v1/tasks/{id}/estimate 列表项。
type APITaskEffort struct {
	ID         int64   `json:"id"`
	ObjectType string  `json:"objectType"`
	ObjectID   int64   `json:"objectID"`
	Account    string  `json:"account"`
	Work       string  `json:"work"`
	Date       string  `json:"date"`
	Consumed   float64 `json:"consumed"`
	Left       float64 `json:"left"`
}

// APIListTaskEfforts 拉取一个任务的所有日志（effort）记录。
// 禅道返回格式有两种：{"effort":{"9":{...},...}} 或 {"efforts":[...]}，都兼容。
func (c *APIClient) APIListTaskEfforts(ctx context.Context, token string, taskID int64) ([]APITaskEffort, error) {
	url := fmt.Sprintf("%s/api.php/v1/tasks/%d/estimate", c.BaseURL, taskID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Token", token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, errAPIUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &APIHTTPError{Status: resp.StatusCode, URL: url, Body: snippet(string(raw))}
	}

	var wrapper struct {
		Effort  map[string]APITaskEffort `json:"effort"`
		Efforts []APITaskEffort          `json:"efforts"`
	}
	if err := json.Unmarshal(raw, &wrapper); err != nil {
		return nil, fmt.Errorf("zentao api list efforts: invalid json: %w; body=%s", err, snippet(string(raw)))
	}
	out := make([]APITaskEffort, 0, len(wrapper.Effort)+len(wrapper.Efforts))
	for _, v := range wrapper.Effort {
		out = append(out, v)
	}
	out = append(out, wrapper.Efforts...)
	return out, nil
}

// findMatchingEffort 在 effort 列表里找一条与本次提交匹配的：date 前缀相同、work trim 相等、consumed 近似相等。
func findMatchingEffort(efforts []APITaskEffort, in APICreateTaskEffortInput) *APITaskEffort {
	wantWork := strings.TrimSpace(in.Work)
	wantDate := strings.TrimSpace(in.WorkDate)
	for i := range efforts {
		e := &efforts[i]
		dateField := strings.TrimSpace(e.Date)
		// 禅道有时返回 "2026-04-27"、有时 "2026-04-27 00:00:00"，前缀匹配即可
		if !strings.HasPrefix(dateField, wantDate) {
			continue
		}
		if strings.TrimSpace(e.Work) != wantWork {
			continue
		}
		if in.Consumed > 0 && abs64(e.Consumed-in.Consumed) > 1e-3 {
			continue
		}
		return e
	}
	return nil
}

func abs64(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

// APICreateTaskEffortByVariant 用指定变体调一次报工 API。
//
// 错误约定：
//   - 401 → errAPIUnauthorized
//   - 非 2xx → APIHTTPError
//   - 2xx 但 (a) 响应里 task.consumed 没增长 或 (b) 二次 GET 列表找不到本次记录 → ErrAPIEffortNotPersisted
//     这种"半生效"必须被识别（个别定制版禅道的 estimate 接口只更新 task 字段、不创建 effort 行）。
//   - 2xx 且二次校验通过 → result, nil（result.ID 会被回填为 effort 的真实 ID）
//
// 二次校验失败处理（GET 拉不到 / 网络抖动）：fail-open，按 task.consumed 判断兜底。
func (c *APIClient) APICreateTaskEffortByVariant(ctx context.Context, token string, in APICreateTaskEffortInput, variant string) (*APICreateTaskEffortResult, error) {
	if in.TaskID <= 0 {
		return nil, fmt.Errorf("invalid task id")
	}
	if strings.TrimSpace(in.Work) == "" {
		return nil, fmt.Errorf("work is required")
	}
	if strings.TrimSpace(in.WorkDate) == "" {
		in.WorkDate = time.Now().Format("2006-01-02")
	}

	url, body, err := c.buildEffortRequest(in, variant)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Token", token)

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 128*1024))

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, errAPIUnauthorized
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &APIHTTPError{Status: resp.StatusCode, URL: url, Body: snippet(string(raw))}
	}

	r := &APICreateTaskEffortResult{
		RawBody:     snippet(string(raw)),
		UsedURL:     url,
		UsedVariant: variant,
	}
	var m map[string]any
	if jErr := json.Unmarshal(raw, &m); jErr == nil {
		r.Fields = m

		// 极少数版本即使 2xx 也通过 {"error":"..."} 表达错误
		if errVal, ok := m["error"].(string); ok && errVal != "" {
			return r, &APIHTTPError{Status: resp.StatusCode, URL: url, Body: snippet(string(raw))}
		}

		if v, ok := m["id"].(float64); ok {
			r.ID = int64(v)
		}
		if v, ok := m["objectID"].(float64); ok {
			r.ObjectID = int64(v)
		}
		if v, ok := m["objectType"].(string); ok {
			r.ObjectType = v
		}

		// 弱信号：响应里 task.consumed 字段，仅当严格小于本次提交值时能直接判定假成功。
		// 不能反过来用 "consumed >= input.Consumed" 判定真成功——
		// 因为某些定制版会更新 task.consumed 但不创建 effort（见下方二次 GET 校验）。
		if in.Consumed > 0 {
			respID, hasID := numFromAny(m["id"])
			respConsumed, hasConsumed := numFromAny(m["consumed"])
			if hasID && hasConsumed && int64(respID) == in.TaskID {
				r.TaskConsumedAfter = respConsumed
				if respConsumed < in.Consumed-1e-6 {
					return r, ErrAPIEffortNotPersisted
				}
			}
		}
	}

	// 强校验：立即 GET 一次任务的日志列表，确认本次记录真的写到 zt_effort 表了。
	// 这是为了识别"半生效假成功"——某些定制版禅道的 POST /tasks/{id}/estimate
	// 只更新 task 表的 consumed/left 字段，但根本不创建 effort 行。
	verifyCtx, verifyCancel := context.WithTimeout(ctx, 8*time.Second)
	defer verifyCancel()
	efforts, listErr := c.APIListTaskEfforts(verifyCtx, token, in.TaskID)
	if listErr == nil {
		matched := findMatchingEffort(efforts, in)
		if matched == nil {
			r.VerifyAttempted = true
			r.VerifyMatched = false
			return r, ErrAPIEffortNotPersisted
		}
		r.VerifyAttempted = true
		r.VerifyMatched = true
		r.ID = matched.ID
		r.ObjectID = matched.ObjectID
		if matched.ObjectType != "" {
			r.ObjectType = matched.ObjectType
		}
		return r, nil
	}
	// GET 失败（404 / 网络）→ fail-open：保持上面 task.consumed 弱判断的结果。
	r.VerifyAttempted = true
	r.VerifyMatched = false
	r.VerifyError = listErr.Error()
	return r, nil
}

// buildEffortRequest 按变体生成 URL 和 body。
func (c *APIClient) buildEffortRequest(in APICreateTaskEffortInput, variant string) (string, []byte, error) {
	estimateURL := fmt.Sprintf("%s/api.php/v1/tasks/%d/estimate", c.BaseURL, in.TaskID)
	effortsURL := fmt.Sprintf("%s/api.php/v1/tasks/%d/efforts", c.BaseURL, in.TaskID)

	var (
		url  string
		body map[string]any
	)
	switch variant {
	case VariantEstimateModern:
		url = estimateURL
		body = map[string]any{
			"date":     []string{in.WorkDate},
			"work":     []string{in.Work},
			"consumed": []float64{in.Consumed},
			"left":     []float64{in.Left},
		}
	case VariantEstimateLegacy:
		url = estimateURL
		body = map[string]any{
			"id":         []int{0},
			"objectID":   []int64{in.TaskID},
			"objectType": []string{"task"},
			"dates":      []string{in.WorkDate},
			"work":       []string{in.Work},
			"consumed":   []float64{in.Consumed},
			"left":       []float64{in.Left},
		}
	case VariantEffortsFallback:
		url = effortsURL
		body = map[string]any{
			"date":     in.WorkDate,
			"work":     in.Work,
			"consumed": in.Consumed,
			"left":     in.Left,
		}
	default:
		return "", nil, fmt.Errorf("unknown effort variant: %s", variant)
	}

	buf, err := json.Marshal(body)
	if err != nil {
		return "", nil, err
	}
	return url, buf, nil
}

// numFromAny 兼容 JSON 数字、字符串数字、json.Number。
func numFromAny(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case json.Number:
		f, err := x.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(x), 64)
		return f, err == nil
	}
	return 0, false
}

func snippet(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 400 {
		return s[:400] + "…"
	}
	return s
}
