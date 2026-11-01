"""Django settings for Konark Trust Bank (demo project)."""
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="dev-insecure-key-change-me")
DEBUG = config("DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

BANK_NAME = "Konark Trust Bank"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "corsheaders",
    # local
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------- Database
DATABASE_URL = config("DATABASE_URL", default="")  # e.g. given by a hosting provider

if DATABASE_URL:
    _db = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _db.path.lstrip("/"),
            "USER": unquote(_db.username or ""),
            "PASSWORD": unquote(_db.password or ""),
            "HOST": _db.hostname or "",
            "PORT": str(_db.port or 5432),
            "OPTIONS": {k: v[0] for k, v in parse_qs(_db.query).items()},
        }
    }
elif config("DB_ENGINE", default="postgres") == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="konark_bank"),
            "USER": config("DB_USER", default="konark_user"),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST": config("DB_HOST", default="127.0.0.1"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- DRF / JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_THROTTLE_RATES": {"auth": "30/min"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

# ---------------------------------------------------------------- OTP (one-time passwords)
OTP_LOGIN_REQUIRED = config("OTP_LOGIN_REQUIRED", default=True, cast=bool)
# A transfer of MORE than this amount (in INR) needs an OTP.
OTP_TRANSFER_THRESHOLD = Decimal(config("OTP_TRANSFER_THRESHOLD", default="5000"))
OTP_TTL_SECONDS = 300          # a code is valid for 5 minutes
OTP_RESEND_COOLDOWN = 30       # seconds between two codes
OTP_MAX_ATTEMPTS = 5           # wrong guesses before the code is dead
OTP_MAX_RESENDS = 3

# SMS delivery: "console" only logs the message on the server, "twilio" sends a real SMS.
SMS_PROVIDER = config("SMS_PROVIDER", default="console")
SMS_COUNTRY_CODE = config("SMS_COUNTRY_CODE", default="+91")
TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_FROM_NUMBER = config("TWILIO_FROM_NUMBER", default="")

# Optional extra copy of the OTP by email (only when EMAIL_HOST_USER is set).
EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default=EMAIL_HOST_USER or "noreply@konarktrustbank.local")
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST_USER
    else "django.core.mail.backends.console.EmailBackend"
)
# Only for local testing: also returns the OTP in the API answer so the page can show it.
# Keep this OFF (default) on a real site: the OTP must reach the customer only by SMS.
OTP_DEMO_MODE = config("OTP_DEMO_MODE", default=False, cast=bool)

# ---------------------------------------------------------------- CORS / CSRF
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)
CORS_EXPOSE_HEADERS = ["Content-Disposition"]  # lets the frontend read the PDF file name
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

# ---------------------------------------------------------------- Production
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
