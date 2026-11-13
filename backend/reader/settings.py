import os
import sys
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Load a local .env for development convenience. It is git-ignored; real
# deployments must pass the same variables through the environment.
try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / '.env', override=False)
except ImportError:  # pragma: no cover - python-dotenv is a declared dependency
    pass


def env(name: str, default: str | None = None) -> str | None:
    """Read an environment variable, treating blank values as unset."""
    value = os.environ.get(name)
    if value is None or value.strip() == '':
        return default
    return value.strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = env(name)
    if value is None:
        return default
    return value.lower() in ('1', 'true', 'yes', 'on')


def env_list(name: str, default: list[str] | None = None) -> list[str]:
    value = env(name)
    if value is None:
        return list(default or [])
    return [item.strip() for item in value.split(',') if item.strip()]


def env_int(name: str, default: int) -> int:
    value = env(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f'{name} must be an integer, got {value!r}.') from exc


IS_TEST_RUN = 'test' in sys.argv or os.environ.get('DJANGO_TEST_MODE') == '1'

DEBUG = env_bool('DEBUG', False)

# No hardcoded production secret. Tests and DEBUG runs get a clearly-labelled
# throwaway key; anything else must configure SECRET_KEY explicitly.
SECRET_KEY = env('SECRET_KEY') or env('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if DEBUG or IS_TEST_RUN:
        SECRET_KEY = 'django-insecure-dev-only-not-for-production'
    else:
        raise ImproperlyConfigured(
            'SECRET_KEY is not set. Export SECRET_KEY (or DJANGO_SECRET_KEY) before '
            'starting the server. See .env.example for the full list of variables.'
        )

# No wildcard host. In DEBUG we default to the loopback hosts only.
ALLOWED_HOSTS = env_list('ALLOWED_HOSTS')
if not ALLOWED_HOSTS:
    if DEBUG or IS_TEST_RUN:
        ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']
    else:
        raise ImproperlyConfigured(
            'ALLOWED_HOSTS is empty. Set the comma-separated public hostnames, '
            'for example "reader.example.com".'
        )

CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'reader.books',
    'reader.translations',
    'reader.vocabulary',
    'reader.core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'reader.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'reader.wsgi.application'

# Database configuration (SQLite default for fast lightweight deployment)
DB_PATH = Path(env('SQLITE_PATH', str(BASE_DIR / 'db_data' / 'db.sqlite3')))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DB_PATH,
        'OPTIONS': {
            # Reduce "database is locked" under concurrent gunicorn workers.
            'timeout': env_int('SQLITE_TIMEOUT', 20),
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(env('MEDIA_ROOT', str(BASE_DIR / 'media')))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# CORS is opt-in per origin. Credentials stay off unless explicitly enabled,
# because the wildcard origin and credentials together are rejected browsers.
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_ALL_ORIGINS = env_bool('CORS_ALLOW_ALL_ORIGINS', False)
CORS_ALLOW_CREDENTIALS = env_bool('CORS_ALLOW_CREDENTIALS', False)
if CORS_ALLOW_CREDENTIALS and CORS_ALLOW_ALL_ORIGINS:
    raise ImproperlyConfigured(
        'CORS_ALLOW_ALL_ORIGINS cannot be combined with CORS_ALLOW_CREDENTIALS. '
        'List the allowed origins in CORS_ALLOWED_ORIGINS instead.'
    )

# Upload limits. Request bodies above DATA_UPLOAD_MAX_MEMORY_SIZE are rejected
# outright; files above FILE_UPLOAD_MAX_MEMORY_SIZE are streamed to disk instead
# of being buffered in worker memory.
MAX_FILE_SIZE = env_int('MAX_FILE_SIZE', 100 * 1024 * 1024)  # 100MB
SUPPORTED_FORMATS = env_list('SUPPORTED_FORMATS', ['epub', 'txt', 'pdf', 'md', 'zip'])
DATA_UPLOAD_MAX_MEMORY_SIZE = env_int('DATA_UPLOAD_MAX_MEMORY_SIZE', 25 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = env_int('FILE_UPLOAD_MAX_MEMORY_SIZE', int(2.5 * 1024 * 1024))

# Cache configuration (LocMemCache fallback)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'contextual-reader-cache',
    }
}

# OmniRoute configuration. OMNIROUTE_URL is kept as a legacy alias so existing
# deployments do not silently lose their endpoint; both names now resolve from
# the same value and there is no invalid placeholder default.
OMNIROUTE_BASE_URL = env('OMNIROUTE_BASE_URL') or env('OMNIROUTE_URL') or ''
OMNIROUTE_URL = OMNIROUTE_BASE_URL
OMNIROUTE_MODEL = env('OMNIROUTE_MODEL', 'auto/best-free')
OMNIROUTE_API_KEY = env('OMNIROUTE_API_KEY', '')

# Server-side allowlist for client supplied LLM endpoints. Empty means "only the
# host of OMNIROUTE_BASE_URL", which is derived below.
LLM_ALLOWED_HOSTS = env_list('LLM_ALLOWED_HOSTS')

# Book processing
SUPPORTED_FORMATS = SUPPORTED_FORMATS or ['epub', 'txt', 'pdf']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': env('LOG_LEVEL', 'INFO'),
    },
}
