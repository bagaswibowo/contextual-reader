# Translations views
import re
from urllib.parse import quote

import requests
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from reader.books.models import Sentence
from reader.core.security import LLMUrlError, validate_llm_base_url
from .dictionary import DictionaryNotFound, lookup as lookup_dictionary
from .interlinear import build_interlinear
from .languages import language_catalogue, tts_voice
from .language_detection import detect_language
from .models import WordTranslation, SentenceTranslation
from .serializers import WordTranslationSerializer, SentenceTranslationSerializer
from .services import translation_service

MAX_DETECT_CHARS = 5000
MAX_CONTEXT_CHARS = 1000
WORD_PATTERN = re.compile(r"^[\w\s'’.\-]+$", re.UNICODE)


class InvalidCustomBaseUrl(Exception):
    """Internal control-flow signal carrying the caller-safe error message."""


def tts_url(text: str, lang: str) -> str:
    """Relative audio URL for a sentence layer, capped at the TTS text limit."""
    clean = (text or '').strip()[:300]
    if not clean:
        return ''
    return (
        '/api/translations/tts/?text=' + quote(clean)
        + '&lang=' + quote((lang or 'en').strip().lower())
    )


def _validated_custom_base_url(request) -> str | None:
    """Return the validated ``custom_base_url`` or None when it was not sent."""
    raw = request.data.get('custom_base_url')
    if raw in (None, ''):
        return None
    try:
        return validate_llm_base_url(raw)
    except LLMUrlError as exc:
        raise InvalidCustomBaseUrl(str(exc)) from exc


class TranslationViewSet(viewsets.ViewSet):
    """Translation endpoints for words and sentences"""

    def _bad_request(self, message: str) -> Response:
        return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def word(self, request):
        """Get word translation via Google Translate (free & multi-meaning) or LLM / Custom AI Provider"""
        sentence_id = request.data.get('sentence_id')
        word = request.data.get('word')
        target_lang = request.data.get('target_lang', 'id')
        mother_lang = request.data.get('mother_lang', 'id')
        engine = request.data.get('engine', 'google')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not sentence_id or not word:
            return self._bad_request('sentence_id and word are required')

        try:
            custom_base_url = _validated_custom_base_url(request)
        except InvalidCustomBaseUrl as exc:
            return self._bad_request(str(exc))

        try:
            sentence = Sentence.objects.get(id=sentence_id)
        except (Sentence.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Sentence not found'}, status=status.HTTP_404_NOT_FOUND)

        translation = translation_service.translate_word_contextual(
            sentence, word, target_lang=target_lang, mother_lang=mother_lang, engine=engine,
            custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
        )
        return Response(WordTranslationSerializer(translation).data)

    @action(detail=False, methods=['post'])
    def sentence(self, request):
        """Get full sentence translation via Google Translate or LLM / Custom AI Provider"""
        sentence_id = request.data.get('sentence_id')
        target_lang = request.data.get('target_lang', 'id')
        mother_lang = request.data.get('mother_lang', 'id')
        engine = request.data.get('engine', 'google')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not sentence_id:
            return self._bad_request('sentence_id is required')

        try:
            custom_base_url = _validated_custom_base_url(request)
        except InvalidCustomBaseUrl as exc:
            return self._bad_request(str(exc))

        try:
            sentence = Sentence.objects.get(id=sentence_id)
        except (Sentence.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Sentence not found'}, status=status.HTTP_404_NOT_FOUND)

        translation = translation_service.translate_sentence(
            sentence, target_lang=target_lang, mother_lang=mother_lang, engine=engine,
            custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
        )
        payload = SentenceTranslationSerializer(translation).data

        if request.data.get('layers'):
            layers = self._sentence_layers(
                sentence, translation, target_lang, mother_lang, engine,
                custom_base_url, custom_api_key, custom_model,
            )
            payload['layers'] = layers
            payload['audio'] = {
                'book': tts_url(layers['book']['text'], layers['book']['lang']),
                'target': tts_url(layers['target']['text'], layers['target']['lang']),
                'mother': tts_url(layers['mother']['text'], layers['mother']['lang']),
            }
        return Response(payload)

    def _sentence_layers(self, sentence, target_translation, target_lang, mother_lang, engine,
                         custom_base_url, custom_api_key, custom_model):
        """Return the book, studied, and mother-tongue layers in one response."""
        book_lang = (sentence.chapter.book.language or 'en').lower()
        book_text = (sentence.text or '').strip()

        def layer_text(text, lang):
            value = (text or '').strip()
            # The provider echoes the source when it has no translation; an
            # echoed line is not a translation, so the layer stays empty.
            if value and value == book_text and str(lang).lower() != book_lang:
                return ''
            return value

        layers = {
            'book': {'lang': book_lang, 'text': sentence.text},
            'target': {
                'lang': target_lang,
                'text': layer_text(target_translation.indonesian_text, target_lang),
            },
        }
        if str(mother_lang).lower() == str(target_lang).lower():
            layers['mother'] = dict(layers['target'])
        else:
            mother_translation = translation_service.translate_sentence(
                sentence, target_lang=mother_lang, mother_lang=mother_lang, engine=engine,
                custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
            )
            layers['mother'] = {
                'lang': mother_lang,
                'text': layer_text(mother_translation.indonesian_text, mother_lang),
            }
        # Same three names the word card uses for its examples, so the book
        # examples render through one contract on the client.
        layers['text_book'] = layers['book']['text']
        layers['text_learning'] = layers['target']['text']
        layers['text_mother'] = layers['mother']['text']
        return layers

    @action(detail=False, methods=['post'])
    def batch_sentence(self, request):
        """Translate multiple sentences at once"""
        sentence_ids = request.data.get('sentence_ids', [])
        target_lang = request.data.get('target_lang', 'id')
        engine = request.data.get('engine', 'google')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not sentence_ids:
            return self._bad_request('sentence_ids required')

        try:
            custom_base_url = _validated_custom_base_url(request)
        except InvalidCustomBaseUrl as exc:
            return self._bad_request(str(exc))

        results = []
        sentences = Sentence.objects.filter(id__in=sentence_ids)
        for sentence in sentences:
            t = translation_service.translate_sentence(
                sentence, target_lang=target_lang, engine=engine,
                custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
            )
            results.append(SentenceTranslationSerializer(t).data)

        return Response(results)

    @action(detail=False, methods=['get'])
    def dictionary(self, request):
        """Return the full word card: source entry plus two meaning layers."""
        word = (request.query_params.get('word') or '').strip()
        lang = (request.query_params.get('lang') or '').strip()
        context = (request.query_params.get('context') or '').strip()
        mother_lang = (request.query_params.get('mother_lang') or 'id').strip() or 'id'
        target_lang = (request.query_params.get('target_lang') or '').strip()

        if not word or not lang:
            return self._bad_request('word and lang parameters are required')
        if len(word) > 255:
            return self._bad_request('word must be at most 255 characters')
        if len(lang) > 10:
            return self._bad_request('lang must be at most 10 characters')
        if len(mother_lang) > 10:
            return self._bad_request('mother_lang must be at most 10 characters')
        if len(target_lang) > 10:
            return self._bad_request('target_lang must be at most 10 characters')
        if len(context) > MAX_CONTEXT_CHARS:
            return self._bad_request(f'context must be at most {MAX_CONTEXT_CHARS} characters')
        if not WORD_PATTERN.match(word):
            return self._bad_request('word contains unsupported characters')

        try:
            payload = lookup_dictionary(
                word, lang, context=context, mother_lang=mother_lang, target_lang=target_lang
            )
        except DictionaryNotFound as exc:
            return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)

        return Response(payload)

    @action(detail=False, methods=['post'])
    def detect(self, request):
        """Detect the language of a short text (max 5000 characters)."""
        text = request.data.get('text')
        if not isinstance(text, str) or not text.strip():
            return self._bad_request('text is required')
        if len(text) > MAX_DETECT_CHARS:
            return self._bad_request(f'text must be at most {MAX_DETECT_CHARS} characters')

        return Response(detect_language(text))

    @action(detail=False, methods=['get'])
    def languages(self, request):
        """Return the selectable languages so the UI never hard-codes a list."""
        return Response({'languages': language_catalogue()})

    @action(detail=False, methods=['post'])
    def interlinear(self, request):
        """Full translation, per-word alignment and grammar shape for one sentence."""
        text = request.data.get('text')
        source_lang = (request.data.get('source_lang') or '').strip()
        target_lang = (request.data.get('target_lang') or 'id').strip() or 'id'
        mother_lang = (request.data.get('mother_lang') or 'id').strip() or 'id'

        if not isinstance(text, str) or not text.strip():
            return self._bad_request('text is required')
        if len(text) > MAX_CONTEXT_CHARS:
            return self._bad_request(f'text must be at most {MAX_CONTEXT_CHARS} characters')
        if len(source_lang) > 10 or len(target_lang) > 10 or len(mother_lang) > 10:
            return self._bad_request('language codes must be at most 10 characters')

        return Response(build_interlinear(text, source_lang, target_lang, mother_lang))

    @action(detail=False, methods=['get'])
    def tts(self, request):
        """High-Quality Natural Neural Audio TTS Proxy Endpoint"""
        text = request.query_params.get('text', '').strip()
        lang = request.query_params.get('lang', 'en').strip().lower()
        speed = (request.query_params.get('speed') or 'normal').strip().lower()
        if not text:
            return self._bad_request('text parameter is required')

        clean_text = text[:300]
        voice = tts_voice(lang)
        # Google's TTS only exposes one slow mode; the reader's 0.5x control
        # uses it, and the frontend can also lower playbackRate for finer steps.
        slow = speed in {'slow', '0.5', '0.25', '0.24'}

        url = (
            "https://translate.google.com/translate_tts?ie=UTF-8"
            f"&tl={voice}&client=tw-ob&q={requests.utils.quote(clean_text)}"
        )
        if slow:
            url += "&ttsspeed=0.24"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200 and len(res.content) > 100:
                response = HttpResponse(res.content, content_type="audio/mpeg")
                response["Cache-Control"] = "public, max-age=86400"
                return response
        except Exception:
            pass
        return Response({'error': 'Failed to generate TTS audio'}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=['post'], url_path='explain-3d')
    def explain_3d(self, request):
        """Reading.help 3-Dimensional Assistance: Lexical, Grammar, and Comprehension Explanation"""
        sentence_text = request.data.get('sentence_text', '')
        sentence_id = request.data.get('sentence_id')
        selected_text = request.data.get('selected_text', '').strip()
        user_level = request.data.get('user_level', 'B2')
        target_lang = request.data.get('target_lang', 'id')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        try:
            custom_base_url = _validated_custom_base_url(request)
        except InvalidCustomBaseUrl as exc:
            return self._bad_request(str(exc))

        if not sentence_text and sentence_id:
            try:
                sent = Sentence.objects.get(id=sentence_id)
                sentence_text = sent.text
            except (Sentence.DoesNotExist, ValueError, TypeError):
                return Response({'error': 'Sentence not found'}, status=status.HTTP_404_NOT_FOUND)

        if not sentence_text or not selected_text:
            return self._bad_request('sentence_text (or sentence_id) and selected_text are required')

        result = translation_service.explain_3d(
            sentence_text=sentence_text,
            selected_text=selected_text,
            user_level=user_level,
            target_lang=target_lang,
            custom_base_url=custom_base_url,
            custom_api_key=custom_api_key,
            custom_model=custom_model
        )
        return Response(result)

    @action(detail=False, methods=['post'], url_path='paragraph-summary')
    def paragraph_summary(self, request):
        """Reading.help Paragraph-Aligned Margin Summary & Proactive Vocabulary Recommendation"""
        paragraph_text = request.data.get('paragraph_text', '').strip()
        detail_level = request.data.get('detail_level', 'concise')
        target_lang = request.data.get('target_lang', 'id')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not paragraph_text:
            return self._bad_request('paragraph_text is required')

        try:
            custom_base_url = _validated_custom_base_url(request)
        except InvalidCustomBaseUrl as exc:
            return self._bad_request(str(exc))

        result = translation_service.generate_paragraph_summary(
            paragraph_text=paragraph_text,
            detail_level=detail_level,
            target_lang=target_lang,
            custom_base_url=custom_base_url,
            custom_api_key=custom_api_key,
            custom_model=custom_model
        )
        return Response(result)
