import json
from functools import lru_cache
from pathlib import Path

import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient


class TokenValidator:
    def __init__(self, issuer: str, audience: str | list[str], jwks_url: str | None = None, jwks_host: str | None = None):
        self.issuer = issuer.rstrip("/")
        self.audience = audience
        self.jwks = PyJWKClient(jwks_url or f"{self.issuer}/oauth/v2/keys", headers={"Host": jwks_host} if jwks_host else None)

    def subject(self, authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="authentication required")
        try:
            key = self.jwks.get_signing_key_from_jwt(token)
            claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=self.audience, issuer=self.issuer)
            subject = claims.get("sub")
            if not isinstance(subject, str) or not subject:
                raise jwt.InvalidTokenError("missing subject")
            return subject
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token") from exc


@lru_cache
def validator_from_bootstrap(path: str) -> TokenValidator:
    config = json.loads(Path(path).read_text())
    # The dedicated k6 machine client is also a valid caller for load traffic;
    # browser users must still use the Storefront audience.
    return TokenValidator(config["issuer"], [config["storefrontClientId"], config["k6ClientId"]], config.get("jwksUrl"), config.get("jwksHost"))


def current_subject(request: Request) -> str:
    validator = validator_from_bootstrap(request.app.state.zitadel_bootstrap_config)
    return validator.subject(request.headers.get("Authorization"))
