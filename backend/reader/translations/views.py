# Translations views
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
            sentence, word, target_lang=target_lang, engine=engine,
            custom_base_url=custom_base_url, custom_api_key=custom_api_key, custom_model=custom_model
        )
        return Response(WordTranslationSerializer(translation).data)
    
    @action(detail=False, methods=['post'])
    def sentence(self, request):
        """Get full sentence translation via Google Translate or LLM / Custom AI Provider"""
        sentence_id = request.data.get('sentence_id')
        target_lang = request.data.get('target_lang', 'id')
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
            sentence, target_lang=target_lang, engine=engine,
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
