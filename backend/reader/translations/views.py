# Translations views
import requests
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from reader.books.models import Sentence
from .models import WordTranslation, SentenceTranslation
from .serializers import WordTranslationSerializer, SentenceTranslationSerializer
from .services import translation_service


class TranslationViewSet(viewsets.ViewSet):
    """Translation endpoints for words and sentences"""
    
    @action(detail=False, methods=['post'])
    def word(self, request):
        """Get word translation via Google Translate (free & multi-meaning) or LLM / Custom AI Provider"""
        sentence_id = request.data.get('sentence_id')
        word = request.data.get('word')
        target_lang = request.data.get('target_lang', 'id')
        mother_lang = request.data.get('mother_lang', 'id')
        engine = request.data.get('engine', 'google')
        custom_base_url = request.data.get('custom_base_url')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')
        
        if not sentence_id or not word:
            return Response(
                {'error': 'sentence_id and word are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            sentence = Sentence.objects.get(id=sentence_id)
        except Sentence.DoesNotExist:
            return Response({'error': 'Sentence not found'}, status=404)
        
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
        custom_base_url = request.data.get('custom_base_url')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')
        
        if not sentence_id:
            return Response(
                {'error': 'sentence_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            sentence = Sentence.objects.get(id=sentence_id)
        except Sentence.DoesNotExist:
            return Response({'error': 'Sentence not found'}, status=404)
        
        translation = translation_service.translate_sentence(
            sentence, target_lang=target_lang, mother_lang=mother_lang, engine=engine,
            custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
        )
        return Response(SentenceTranslationSerializer(translation).data)
    
    @action(detail=False, methods=['post'])
    def batch_sentence(self, request):
        """Translate multiple sentences at once"""
        sentence_ids = request.data.get('sentence_ids', [])
        target_lang = request.data.get('target_lang', 'id')
        engine = request.data.get('engine', 'google')
        custom_base_url = request.data.get('custom_base_url')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')
        
        if not sentence_ids:
            return Response({'error': 'sentence_ids required'}, status=400)
        
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
    def tts(self, request):
        """High-Quality Natural Neural Audio TTS Proxy Endpoint"""
        text = request.query_params.get('text', '').strip()
        lang = request.query_params.get('lang', 'en').strip().lower()
        if not text:
            return Response({'error': 'text parameter is required'}, status=400)
            
        clean_text = text[:300]
        if lang in ['zh', 'zh-cn']:
            lang = 'zh-CN'
        elif lang == 'zh-tw':
            lang = 'zh-TW'
            
        url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl={lang}&client=tw-ob&q={requests.utils.quote(clean_text)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200 and len(res.content) > 100:
                response = HttpResponse(res.content, content_type="audio/mpeg")
                response["Access-Control-Allow-Origin"] = "*"
                response["Cache-Control"] = "public, max-age=86400"
                return response
        except Exception:
            pass
        return Response({'error': 'Failed to generate TTS audio'}, status=500)


    @action(detail=False, methods=['post'], url_path='explain-3d')
    def explain_3d(self, request):
        """Reading.help 3-Dimensional Assistance: Lexical, Grammar, and Comprehension Explanation"""
        sentence_text = request.data.get('sentence_text', '')
        sentence_id = request.data.get('sentence_id')
        selected_text = request.data.get('selected_text', '').strip()
        user_level = request.data.get('user_level', 'B2')
        target_lang = request.data.get('target_lang', 'id')
        custom_base_url = request.data.get('custom_base_url')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not sentence_text and sentence_id:
            try:
                sent = Sentence.objects.get(id=sentence_id)
                sentence_text = sent.text
            except Sentence.DoesNotExist:
                return Response({'error': 'Sentence not found'}, status=404)

        if not sentence_text or not selected_text:
            return Response({'error': 'sentence_text (or sentence_id) and selected_text are required'}, status=400)

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
        custom_base_url = request.data.get('custom_base_url')
        custom_api_key = request.data.get('custom_api_key')
        custom_model = request.data.get('custom_model')

        if not paragraph_text:
            return Response({'error': 'paragraph_text is required'}, status=400)

        result = translation_service.generate_paragraph_summary(
            paragraph_text=paragraph_text,
            detail_level=detail_level,
            target_lang=target_lang,
            custom_base_url=custom_base_url,
            custom_api_key=custom_api_key,
            custom_model=custom_model
        )
        return Response(result)
