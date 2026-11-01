"""Send a text message. Provider is chosen with SMS_PROVIDER in the environment:

* "console" (default): only writes the message to the server log. Good for local testing.
* "twilio": real SMS through Twilio's HTTP API (no extra package needed).
"""
import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


class SMSError(Exception):
    pass


def full_number(phone):
    phone = phone.strip()
    return phone if phone.startswith("+") else f"{settings.SMS_COUNTRY_CODE}{phone}"


def send_sms(phone, text):
    provider = settings.SMS_PROVIDER
    if provider == "console":
        logger.warning("SMS to %s: %s", full_number(phone), text)
        return
    if provider == "twilio":
        return _send_twilio(full_number(phone), text)
    raise SMSError(f"Unknown SMS_PROVIDER '{provider}'.")


def _send_twilio(to, text):
    sid, token = settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN
    if not (sid and token and settings.TWILIO_FROM_NUMBER):
        raise SMSError("Twilio is not configured.")
    body = urllib.parse.urlencode({"To": to, "From": settings.TWILIO_FROM_NUMBER, "Body": text}).encode()
    request = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=body, method="POST"
    )
    request.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        raise SMSError(f"Twilio refused the message ({exc.code}): {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SMSError(f"Could not reach Twilio: {exc}") from exc
