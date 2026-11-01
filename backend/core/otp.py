"""One-time passwords (OTP) for login and for large transfers.

* The 6-digit code is never stored, only an HMAC of it.
* A code is valid for OTP_TTL_SECONDS, allows OTP_MAX_ATTEMPTS wrong guesses and works once.
* A transfer OTP is tied to the receiver and the amount, so it cannot be reused for another payment.
"""
import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from . import sms
from .models import OneTimeCode

logger = logging.getLogger(__name__)


class OTPError(Exception):
    """A problem the user can read and act on."""

    def __init__(self, message, retry_after=None):
        super().__init__(message)
        self.retry_after = retry_after


def _digest(*parts):
    message = ":".join(str(p) for p in parts).encode()
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def transfer_context(user, to_number, amount):
    return _digest("transfer", user.pk, to_number, f"{amount:.2f}")


def phone_context(phone):
    return _digest("phone", phone)


def mask_phone(phone):
    phone = (phone or "").strip()
    if len(phone) < 6:
        return ""
    return f"{phone[:2]}{'*' * (len(phone) - 4)}{phone[-2:]}"


def _new_code():
    return f"{secrets.randbelow(10 ** 6):06d}"


def _send(user, code, purpose, amount=None, phone=None):
    """SMS the code (and email a copy when email is set up).
    Returns the code only in OTP_DEMO_MODE (local testing), else None."""
    phone = phone or user.phone
    if not phone:
        raise OTPError("No mobile number is registered for this account.")
    what = "log in" if purpose == OneTimeCode.Purpose.LOGIN else f"confirm your transfer of Rs. {amount}"
    minutes = settings.OTP_TTL_SECONDS // 60
    text = (
        f"Konark Trust Bank: {code} is your OTP to {what}. "
        f"Valid for {minutes} minutes. Never share it with anyone."
    )
    try:
        sms.send_sms(phone, text)
    except sms.SMSError:
        logger.exception("Could not SMS the OTP to %s", user.username)
        if not settings.OTP_DEMO_MODE:
            raise OTPError("We could not send the OTP right now. Please try again in a moment.")
    if settings.EMAIL_HOST_USER and user.email:
        try:
            send_mail("Your Konark Trust Bank OTP", text, settings.DEFAULT_FROM_EMAIL, [user.email])
        except Exception:
            logger.exception("Could not email the OTP to %s", user.username)
    return code if settings.OTP_DEMO_MODE else None


def _payload(challenge, demo_code, phone):
    return {
        "otp_required": True,
        "challenge_id": challenge.challenge,
        "sent_to": f"+91 {mask_phone(phone)}" if phone and not phone.startswith("+") else mask_phone(phone),
        "expires_in": settings.OTP_TTL_SECONDS,
        "resend_after": settings.OTP_RESEND_COOLDOWN,
        "demo_otp": demo_code,
    }


def issue(user, purpose, context="", amount=None, phone=None):
    """Create (and send) a new code. Older unused codes for the same purpose stop working."""
    now = timezone.now()
    latest = OneTimeCode.objects.filter(user=user, purpose=purpose, used_at__isnull=True).order_by("-sent_at").first()
    if latest and (now - latest.sent_at).total_seconds() < settings.OTP_RESEND_COOLDOWN:
        wait = int(settings.OTP_RESEND_COOLDOWN - (now - latest.sent_at).total_seconds()) + 1
        raise OTPError(f"Please wait {wait} seconds before asking for a new OTP.", retry_after=wait)

    OneTimeCode.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(used_at=now)
    code = _new_code()
    challenge = OneTimeCode.objects.create(
        user=user, purpose=purpose, challenge=secrets.token_urlsafe(24),
        code_hash=_digest("code", code), context_hash=context,
        expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
    )
    demo = _send(user, code, purpose, amount, phone)
    return _payload(challenge, demo, phone or user.phone)


def resend(challenge_id, purpose, phone=None):
    """Send a fresh code for an open challenge (same challenge id)."""
    challenge = OneTimeCode.objects.select_related("user").filter(
        challenge=challenge_id, purpose=purpose, used_at__isnull=True
    ).first()
    if challenge is None:
        raise OTPError("This OTP request has expired. Please start again.")
    now = timezone.now()
    gap = (now - challenge.sent_at).total_seconds()
    if gap < settings.OTP_RESEND_COOLDOWN:
        wait = int(settings.OTP_RESEND_COOLDOWN - gap) + 1
        raise OTPError(f"Please wait {wait} seconds before asking for a new OTP.", retry_after=wait)
    if challenge.resend_count >= settings.OTP_MAX_RESENDS:
        raise OTPError("Too many OTP requests. Please start again.")

    # A challenge made for a new mobile number can only be resent to that same number.
    if challenge.context_hash and (not phone or phone_context(phone) != challenge.context_hash):
        raise OTPError("Please enter your mobile number again.")

    code = _new_code()
    challenge.code_hash = _digest("code", code)
    challenge.sent_at = now
    challenge.expires_at = now + timedelta(seconds=settings.OTP_TTL_SECONDS)
    challenge.attempts = 0
    challenge.resend_count += 1
    challenge.save(update_fields=["code_hash", "sent_at", "expires_at", "attempts", "resend_count"])
    demo = _send(challenge.user, code, purpose, phone=phone)
    return _payload(challenge, demo, phone or challenge.user.phone)


def verify(challenge_id, code, purpose, user=None, context=""):
    """Check a code. Returns the user on success; raises OTPError otherwise."""
    code = (code or "").strip()
    challenge = OneTimeCode.objects.select_related("user").filter(
        challenge=challenge_id or "", purpose=purpose
    ).first()
    if challenge is None or challenge.used_at is not None:
        raise OTPError("This OTP is no longer valid. Please request a new one.")
    if user is not None and challenge.user_id != user.pk:
        raise OTPError("This OTP is no longer valid. Please request a new one.")
    if challenge.context_hash != context:
        raise OTPError("These details do not match the OTP. Please start the transfer again.")
    if timezone.now() >= challenge.expires_at:
        raise OTPError("This OTP has expired. Please request a new one.")
    if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise OTPError("Too many wrong attempts. Please request a new OTP.")

    challenge.attempts += 1
    if not (len(code) == 6 and code.isdigit() and hmac.compare_digest(challenge.code_hash, _digest("code", code))):
        challenge.save(update_fields=["attempts"])
        left = settings.OTP_MAX_ATTEMPTS - challenge.attempts
        if left <= 0:
            raise OTPError("Too many wrong attempts. Please request a new OTP.")
        raise OTPError(f"Incorrect OTP. {left} attempt{'s' if left != 1 else ''} left.")

    challenge.used_at = timezone.now()
    challenge.save(update_fields=["attempts", "used_at"])
    return challenge.user
