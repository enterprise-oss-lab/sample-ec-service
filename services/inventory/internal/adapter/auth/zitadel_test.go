package auth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRequireAdmin(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/v2/keys" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "test-key", "kty": "RSA", "alg": "RS256",
			"n": base64.RawURLEncoding.EncodeToString(privateKey.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(privateKey.E)).Bytes()),
		}}})
	}))
	defer server.Close()

	configPath := filepath.Join(t.TempDir(), "oidc.json")
	config := bootstrapConfig{Issuer: server.URL, ProjectID: "project-id", AdminClientID: "admin-client", K6ClientID: "k6-client"}
	raw, _ := json.Marshal(config)
	if err := os.WriteFile(configPath, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	validator, err := NewValidator(configPath)
	if err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/inventories", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	admin := router.Group("/admin")
	admin.Use(validator.RequireAdmin())
	admin.POST("/inventories/:id/adjust", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	t.Run("public endpoint remains anonymous", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/inventories", nil)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", res.Code, http.StatusNoContent)
		}
	})
	t.Run("admin endpoint rejects missing token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/admin/inventories/1/adjust", nil)
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", res.Code, http.StatusUnauthorized)
		}
	})
	t.Run("customer token is forbidden", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/admin/inventories/1/adjust", nil)
		req.Header.Set("Authorization", "Bearer "+signedToken(t, privateKey, server.URL, "admin-client", "project-id", "customer"))
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d", res.Code, http.StatusForbidden)
		}
	})
	t.Run("admin token reaches handler", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/admin/inventories/1/adjust", nil)
		req.Header.Set("Authorization", "Bearer "+signedToken(t, privateKey, server.URL, "admin-client", "project-id", "admin"))
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", res.Code, http.StatusNoContent)
		}
	})
}

func signedToken(t *testing.T, key *rsa.PrivateKey, issuer, audience, projectID, role string) string {
	t.Helper()
	header, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "test-key"})
	claims, _ := json.Marshal(map[string]any{
		"iss": issuer, "aud": audience, "exp": time.Now().Add(time.Minute).Unix(),
		"urn:zitadel:iam:org:project:" + projectID + ":roles": map[string]any{role: map[string]any{}},
	})
	input := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(claims)
	hash := sha256.Sum256([]byte(input))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		t.Fatal(err)
	}
	return input + "." + base64.RawURLEncoding.EncodeToString(signature)
}
