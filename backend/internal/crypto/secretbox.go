package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

const prefixV1 = "v1:"

func key32(secret string) [32]byte {
	return sha256.Sum256([]byte(secret))
}

func EncryptString(plain, secret string) (string, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return "", fmt.Errorf("empty secret")
	}
	k := key32(secret)
	block, err := aes.NewCipher(k[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plain), nil)
	buf := append(nonce, ct...)
	return prefixV1 + base64.StdEncoding.EncodeToString(buf), nil
}

func DecryptString(enc, secret string) (string, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return "", fmt.Errorf("empty secret")
	}
	if !strings.HasPrefix(enc, prefixV1) {
		return "", fmt.Errorf("unsupported ciphertext format")
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(enc, prefixV1))
	if err != nil {
		return "", err
	}
	k := key32(secret)
	block, err := aes.NewCipher(k[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(raw) < ns {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ct := raw[:ns], raw[ns:]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}
