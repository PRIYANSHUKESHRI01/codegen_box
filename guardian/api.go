package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// API talks to the AptRun backend (routes/api.php, /guardian/*).
type API struct {
	Base string
	HTTP *http.Client
}

func NewAPI(base string) *API {
	return &API{Base: strings.TrimRight(base, "/"), HTTP: &http.Client{Timeout: 8 * time.Second}}
}

// ServerError is a refusal with a machine-readable code (the same codes the page sees).
type ServerError struct {
	Status  int
	Code    string
	Message string
	LastSeq int64
}

func (e *ServerError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("server answered %d", e.Status)
}

func decodeError(status int, body []byte) *ServerError {
	var v struct {
		Message string `json:"message"`
		Code    string `json:"code"`
		LastSeq int64  `json:"last_seq"`
	}
	_ = json.Unmarshal(body, &v)
	return &ServerError{Status: status, Code: v.Code, Message: v.Message, LastSeq: v.LastSeq}
}

// PairResponse is the server's answer to a pairing code.
type PairResponse struct {
	Token     string `json:"token"`
	LinkID    int64  `json:"link_id"`
	ExpiresAt string `json:"expires_at"`
	User      struct {
		Name string `json:"name"`
	} `json:"user"`
	Policy json.RawMessage `json:"policy"`
}

func (a *API) Pair(code string, s *Saved, version, exeSHA string, machine map[string]any) (*PairResponse, error) {
	body, _ := json.Marshal(map[string]any{
		"code":       code,
		"public_key": s.PublicKey,
		"install_id": s.InstallID,
		"version":    version,
		"exe_sha256": exeSHA,
		"platform":   "windows",
		"machine":    machine,
	})
	req, _ := http.NewRequest(http.MethodPost, a.Base+"/guardian/pair", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := a.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, decodeError(resp.StatusCode, raw)
	}
	var out PairResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// BeatResponse is the server's answer to a report.
type BeatResponse struct {
	OK            bool            `json:"ok"`
	Seq           int64           `json:"seq"`
	Marker        string          `json:"marker"`
	ExamActive    bool            `json:"exam_active"`
	PolicyVersion string          `json:"policy_version"`
	Policy        json.RawMessage `json:"policy"`
}

// signedPost sends a body signed with the installation's key.
func (a *API) signedPost(path string, priv ed25519.PrivateKey, linkID, seq int64, token string, body []byte) ([]byte, error) {
	req, _ := http.NewRequest(http.MethodPost, a.Base+path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Guardian-Signature", Sign(priv, linkID, seq, body))

	resp, err := a.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode != http.StatusOK {
		return nil, decodeError(resp.StatusCode, raw)
	}
	return raw, nil
}

func (a *API) Beat(priv ed25519.PrivateKey, linkID int64, token string, seq int64, payload map[string]any) (*BeatResponse, error) {
	payload["seq"] = seq
	body, _ := json.Marshal(payload)
	raw, err := a.signedPost("/guardian/beat", priv, linkID, seq, token, body)
	if err != nil {
		return nil, err
	}
	var out BeatResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (a *API) Unpair(priv ed25519.PrivateKey, linkID int64, token string, seq int64) error {
	body, _ := json.Marshal(map[string]any{"seq": seq})
	_, err := a.signedPost("/guardian/unpair", priv, linkID, seq, token, body)
	return err
}
