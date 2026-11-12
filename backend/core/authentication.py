"""One login at a time per user, like net banking.

A login gets a random `sid` that is saved on the user and put inside the tokens. While that login is
in use nobody can log in again with the same user. If it is idle for 10 minutes (or the user logs out)
the next login is allowed, and the old tokens stop working.
"""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User

SESSION_IDLE = timedelta(minutes=10)  # keep in step with IDLE_MS in IdleGuard.jsx
TOUCH_EVERY = timedelta(seconds=30)  # do not write to the database on every single request


class AccountLocked(APIException):
    status_code = 429
    default_code = "account_locked"
    default_detail = "Too many wrong passwords. Please try again later."


class AlreadyLoggedIn(APIException):
    status_code = 409
    default_code = "already_logged_in"
    default_detail = (
        "This account is already logged in on another tab or device. Log out there first. "
        "If you closed it without logging out, you can log in again after 10 minutes."
    )


def single_session_on():
    return getattr(settings, "SINGLE_SESSION", True)


def session_is_live(user, now=None):
    now = now or timezone.now()
    return bool(user.session_key and user.session_seen and now - user.session_seen < SESSION_IDLE)


def check_session(user, sid, touch=True):
    """Raises AuthenticationFailed when these tokens are not the user's current login any more."""
    if not single_session_on():
        return
    now = timezone.now()
    if not user.session_key or sid != user.session_key:
        raise AuthenticationFailed("You were logged out because this account logged in somewhere else.", code="session_replaced")
    if not session_is_live(user, now):
        User.objects.filter(pk=user.pk).update(session_key="", session_seen=None)
        raise AuthenticationFailed("Your session ended because there was no activity for 10 minutes.", code="session_idle")
    if touch and now - user.session_seen > TOUCH_EVERY:
        User.objects.filter(pk=user.pk).update(session_seen=now)


def start_session(user):
    """Called after a good login. Returns the new sid."""
    import secrets

    user.session_key = secrets.token_hex(16)
    user.session_seen = timezone.now()
    user.save(update_fields=["session_key", "session_seen"])
    return user.session_key


def end_session(user):
    User.objects.filter(pk=user.pk).update(session_key="", session_seen=None)


class SessionJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result
        check_session(user, token.get("sid"))
        return user, token


class SessionRefreshSerializer(TokenRefreshSerializer):
    """A refresh token of a replaced or idle login cannot get new access tokens."""

    def validate(self, attrs):
        try:
            token = RefreshToken(attrs["refresh"])
            user = User.objects.get(pk=token["user_id"])
        except (TokenError, User.DoesNotExist, KeyError):
            raise InvalidToken("This login has ended.")
        check_session(user, token.get("sid"), touch=False)
        return super().validate(attrs)
