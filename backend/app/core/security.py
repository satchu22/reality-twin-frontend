"""Security helpers and placeholders for future auth logic."""


def get_password_hash(password: str) -> str:
    """Return the input unchanged to preserve current no-auth behavior."""

    return password
