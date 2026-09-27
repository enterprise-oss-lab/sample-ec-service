package auth

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type bootstrapConfig struct {
	Issuer        string `json:"issuer"`
	JWKSURL       string `json:"jwksUrl"`
	JWKSHost      string `json:"jwksHost"`
	ProjectID     string `json:"projectId"`
	AdminClientID string `json:"adminClientId"`
	K6ClientID    string `json:"k6ClientId"`
}

type Validator struct {
	issuer, jwksURL, jwksHost, projectID string
	k6ClientID                           string
	audiences                            map[string]struct{}
	client                               *http.Client
	mu                                   sync.Mutex
	keys                                 map[string]*rsa.PublicKey
	keysExpiry                           time.Time
}

func NewValidator(configPath string) (*Validator, error) {
	raw, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read ZITADEL bootstrap config: %w", err)
	}
	var config bootstrapConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil, fmt.Errorf("parse ZITADEL bootstrap config: %w", err)
	}
	if config.Issuer == "" || config.ProjectID == "" || config.AdminClientID == "" || config.K6ClientID == "" {
		return nil, errors.New("incomplete ZITADEL bootstrap config")
	}
	jwksURL := config.JWKSURL
	if jwksURL == "" {
		jwksURL = strings.TrimSuffix(config.Issuer, "/") + "/oauth/v2/keys"
	}
	return &Validator{issuer: strings.TrimSuffix(config.Issuer, "/"), jwksURL: jwksURL, jwksHost: config.JWKSHost, projectID: config.ProjectID, k6ClientID: config.K6ClientID, audiences: map[string]struct{}{config.AdminClientID: {}, config.K6ClientID: {}}, client: &http.Client{Timeout: 5 * time.Second}}, nil
}

func (v *Validator) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/admin/") {
			next.ServeHTTP(w, r)
			return
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
			return
		}
		if err := v.ValidateAdmin(r.Header.Get("Authorization")); err != nil {
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ValidateAdmin verifies that header contains a valid ZITADEL access token for
// an admin client with the admin project role.  Callers must not log header or
// the returned error because both can reveal authentication details.
func (v *Validator) ValidateAdmin(header string) error {
	if !strings.HasPrefix(header, "Bearer ") {
		return errors.New("missing bearer token")
	}
	parts := strings.Split(strings.TrimPrefix(header, "Bearer "), ".")
	if len(parts) != 3 {
		return errors.New("malformed jwt")
	}
	var hdr struct {
		Algorithm string `json:"alg"`
		KeyID     string `json:"kid"`
	}
	if err := decode(parts[0], &hdr); err != nil || hdr.Algorithm != "RS256" || hdr.KeyID == "" {
		return errors.New("unsupported jwt")
	}
	var claims struct {
		Issuer    string          `json:"iss"`
		Audience  json.RawMessage `json:"aud"`
		ExpiresAt int64           `json:"exp"`
		ClientID  string          `json:"client_id"`
	}
	if err := decode(parts[1], &claims); err != nil || claims.Issuer != v.issuer || claims.ExpiresAt <= time.Now().Unix() {
		return errors.New("invalid jwt claims")
	}
	if !v.hasAudience(claims.Audience) {
		return errors.New("invalid jwt audience")
	}
	roleClaim := "urn:zitadel:iam:org:project:" + v.projectID + ":roles"
	var raw map[string]json.RawMessage
	var all map[string]json.RawMessage
	if err := decode(parts[1], &all); err == nil {
		_ = json.Unmarshal(all[roleClaim], &raw)
	}
	// ZITADEL does not emit project-role claims for machine-user access tokens.
	// The bootstrap only grants the dedicated k6 machine user the admin role, so
	// accept that exact registered client while human users must carry the role.
	if _, hasAdminRole := raw["admin"]; !hasAdminRole && claims.ClientID != v.k6ClientID {
		return errors.New("admin role required")
	}
	key, err := v.key(hdr.KeyID)
	if err != nil {
		return err
	}
	signingInput := []byte(parts[0] + "." + parts[1])
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return err
	}
	hash := sha256.Sum256(signingInput)
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], signature)
}

func (v *Validator) hasAudience(raw json.RawMessage) bool {
	var one string
	if json.Unmarshal(raw, &one) == nil {
		_, ok := v.audiences[one]
		return ok
	}
	var many []string
	if json.Unmarshal(raw, &many) != nil {
		return false
	}
	for _, audience := range many {
		if _, ok := v.audiences[audience]; ok {
			return true
		}
	}
	return false
}
func decode(encoded string, value any) error {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, value)
}
func (v *Validator) key(keyID string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if time.Now().After(v.keysExpiry) {
		if err := v.refreshKeys(); err != nil {
			return nil, err
		}
	}
	key := v.keys[keyID]
	if key == nil {
		return nil, errors.New("unknown signing key")
	}
	return key, nil
}
func (v *Validator) refreshKeys() error {
	request, err := http.NewRequest(http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	if v.jwksHost != "" {
		request.Host = v.jwksHost
	}
	response, err := v.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("JWKS status %d", response.StatusCode)
	}
	var document struct {
		Keys []struct {
			KeyID     string `json:"kid"`
			KeyType   string `json:"kty"`
			Algorithm string `json:"alg"`
			N         string `json:"n"`
			E         string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&document); err != nil {
		return err
	}
	keys := map[string]*rsa.PublicKey{}
	for _, jwk := range document.Keys {
		if jwk.KeyType != "RSA" || jwk.Algorithm != "RS256" {
			continue
		}
		n, err := base64.RawURLEncoding.DecodeString(jwk.N)
		if err != nil {
			continue
		}
		e, err := base64.RawURLEncoding.DecodeString(jwk.E)
		if err != nil {
			continue
		}
		exponent := 0
		for _, byteValue := range e {
			exponent = exponent<<8 + int(byteValue)
		}
		keys[jwk.KeyID] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: exponent}
	}
	if len(keys) == 0 {
		return errors.New("no RSA signing keys")
	}
	v.keys, v.keysExpiry = keys, time.Now().Add(5*time.Minute)
	return nil
}
