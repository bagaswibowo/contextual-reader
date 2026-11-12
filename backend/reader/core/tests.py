from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from reader.core.security import LLMUrlError, validate_llm_base_url


PUBLIC_RESOLVER = lambda host: ['93.184.216.34']  # noqa: E731
PRIVATE_RESOLVER = lambda host: ['10.0.0.7']  # noqa: E731


@override_settings(LLM_ALLOWED_HOSTS=['llm.example.com'])
class ValidateLLMBaseUrlTest(SimpleTestCase):
    def test_accepts_allowlisted_public_host(self):
        url = validate_llm_base_url(
            'https://llm.example.com/v1', resolver=PUBLIC_RESOLVER
        )
        self.assertEqual(url, 'https://llm.example.com/v1')

    def test_strips_trailing_slash(self):
        url = validate_llm_base_url(
            'https://llm.example.com/v1/', resolver=PUBLIC_RESOLVER
        )
        self.assertEqual(url, 'https://llm.example.com/v1')

    def test_rejects_host_outside_allowlist(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'https://attacker.example.com/v1', resolver=PUBLIC_RESOLVER
            )

    def test_rejects_loopback(self):
        for url in (
            'http://127.0.0.1:20129/v1',
            'http://127.1.2.3/v1',
            'http://[::1]:8000/v1',
            'http://[::ffff:127.0.0.1]/v1',
        ):
            with self.subTest(url=url):
                with self.assertRaises(LLMUrlError):
                    validate_llm_base_url(url, allowed_hosts=['127.0.0.1', '::1'])

    def test_rejects_cloud_metadata(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'http://169.254.169.254/latest/meta-data/',
                allowed_hosts=['169.254.169.254'],
            )

    def test_rejects_private_ranges(self):
        for url, host in (
            ('http://10.0.0.5/v1', '10.0.0.5'),
            ('http://192.168.1.10/v1', '192.168.1.10'),
            ('http://172.16.5.4/v1', '172.16.5.4'),
        ):
            with self.subTest(url=url):
                with self.assertRaises(LLMUrlError):
                    validate_llm_base_url(url, allowed_hosts=[host])

    def test_rejects_localhost_hostnames(self):
        for url in (
            'http://localhost:8000/v1',
            'http://api.localhost/v1',
            'http://service.internal/v1',
        ):
            with self.subTest(url=url):
                with self.assertRaises(LLMUrlError):
                    validate_llm_base_url(url, allowed_hosts=['localhost'])

    def test_rejects_dns_rebinding_to_private_ip(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'https://llm.example.com/v1', resolver=PRIVATE_RESOLVER
            )

    def test_rejects_non_http_scheme(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url('file:///etc/passwd')

    def test_rejects_embedded_credentials(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'https://user:pass@llm.example.com/v1', resolver=PUBLIC_RESOLVER
            )

    def test_rejects_invalid_port(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'https://llm.example.com:notaport/v1', resolver=PUBLIC_RESOLVER
            )

    @override_settings(LLM_ALLOWED_HOSTS=[], OMNIROUTE_BASE_URL='')
    def test_rejects_everything_when_no_allowlist_configured(self):
        with self.assertRaises(LLMUrlError):
            validate_llm_base_url(
                'https://llm.example.com/v1', resolver=PUBLIC_RESOLVER
            )

    @override_settings(LLM_ALLOWED_HOSTS=[], OMNIROUTE_BASE_URL='https://llm.example.com/v1')
    def test_defaults_allowlist_to_omniroute_host(self):
        url = validate_llm_base_url(
            'https://llm.example.com/v1', resolver=PUBLIC_RESOLVER
        )
        self.assertEqual(url, 'https://llm.example.com/v1')


class SSRFEndpointTest(SimpleTestCase):
    """The API must answer 400, never 500 or a request to the internal host."""

    def setUp(self):
        self.client = APIClient()

    def test_word_translation_rejects_internal_base_url(self):
        response = self.client.post(
            '/api/translations/word/',
            {'sentence_id': 1, 'word': 'hello', 'custom_base_url': 'http://169.254.169.254/v1'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_sentence_translation_rejects_loopback_base_url(self):
        response = self.client.post(
            '/api/translations/sentence/',
            {'sentence_id': 1, 'custom_base_url': 'http://127.0.0.1:20129/v1'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_explain_3d_rejects_private_base_url(self):
        response = self.client.post(
            '/api/translations/explain-3d/',
            {
                'sentence_text': 'The cat sat on the mat.',
                'selected_text': 'sat',
                'custom_base_url': 'http://10.0.0.9/v1',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_paragraph_summary_rejects_disallowed_host(self):
        response = self.client.post(
            '/api/translations/paragraph-summary/',
            {'paragraph_text': 'Some text.', 'custom_base_url': 'https://evil.example.com/v1'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)


class MigrationSchemaTest(TestCase):
    """The four tables that used to be missing must exist after migrate."""

    def test_translations_and_vocabulary_tables_exist(self):
        tables = set(connection.introspection.table_names())
        for table in (
            'translations_wordtranslation',
            'translations_sentencetranslation',
            'vocabulary_vocabularyentry',
            'vocabulary_reviewsession',
        ):
            with self.subTest(table=table):
                self.assertIn(table, tables)


class SettingsHardeningTest(SimpleTestCase):
    def test_no_wildcard_hosts(self):
        from django.conf import settings

        self.assertNotIn('*', settings.ALLOWED_HOSTS)

    def test_cors_is_not_wide_open(self):
        from django.conf import settings

        self.assertFalse(settings.CORS_ALLOW_ALL_ORIGINS)
        self.assertFalse(settings.CORS_ALLOW_CREDENTIALS)

    def test_upload_memory_limit_is_small(self):
        from django.conf import settings

        self.assertLessEqual(settings.FILE_UPLOAD_MAX_MEMORY_SIZE, 3 * 1024 * 1024)

    def test_omniroute_names_agree(self):
        from django.conf import settings

        self.assertEqual(settings.OMNIROUTE_URL, settings.OMNIROUTE_BASE_URL)
