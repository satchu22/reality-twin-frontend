"""Outbound email helpers used by notification services."""

import json
import os
from urllib import error, request

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


def resolve_user_email(user_id: int) -> str | None:
    """Resolve a user email address from environment configuration."""

    email_map_raw = os.getenv("USER_EMAIL_MAP", "{}")
    default_email = os.getenv("DEFAULT_NOTIFICATION_EMAIL")

    try:
        email_map = json.loads(email_map_raw)
    except json.JSONDecodeError:
        email_map = {}

    resolved_email = email_map.get(str(user_id))
    if resolved_email:
        return resolved_email

    return default_email


def send_email(to: str, subject: str, message: str) -> bool:
    """Send an email through SendGrid when credentials are present."""

    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")

    if not api_key or not from_email or not to:
        return False

    payload = json.dumps(
        {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": from_email},
            "subject": subject,
            "content": [{"type": "text/plain", "value": message}],
        }
    ).encode("utf-8")

    req = request.Request(
        SENDGRID_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req) as response:
            return 200 <= response.status < 300
    except (error.HTTPError, error.URLError, TimeoutError):
        return False
