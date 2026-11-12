# Vocabulary views
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import VocabularyEntry, ReviewSession
from .serializers import VocabularyEntrySerializer, VocabularyCreateSerializer, ReviewSessionSerializer
from reader.books.models import Book
from reader.translations.models import WordTranslation


class VocabularyViewSet(viewsets.ModelViewSet):
    serializer_class = VocabularyEntrySerializer
    
    def get_queryset(self):
        user_id = self.request.query_params.get('user_id', 'default')
        return VocabularyEntry.objects.filter(user_id=user_id).select_related(
            'word_translation', 'sentence', 'sentence__chapter', 'book'
        )
    
    def get_serializer_class(self):
        if self.action == 'create':
            return VocabularyCreateSerializer
        return VocabularyEntrySerializer
    
    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user_id', 'default')
        word_translation_id = request.data.get('word_translation')
        
        if not word_translation_id:
            return Response({'error': 'word_translation required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            word_translation = WordTranslation.objects.select_related(
                'sentence', 'sentence__chapter', 'sentence__chapter__book'
            ).get(id=word_translation_id)
        except (WordTranslation.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Word translation not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if already exists
        entry, created = VocabularyEntry.objects.get_or_create(
            user_id=user_id,
            word_translation=word_translation,
            defaults={
                'book': word_translation.sentence.chapter.book,
                'sentence': word_translation.sentence,
                'status': 'learning',
                'next_review': timezone.now(),
            }
        )
        
        serializer = self.get_serializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def by_book(self, request):
        user_id = request.query_params.get('user_id', 'default')
        book_id = request.query_params.get('book_id')
        
        queryset = self.get_queryset()
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        
        # Group by book
        from django.db.models import Count
        books = queryset.values('book__id', 'book__title').annotate(count=Count('id'))
        
        result = {}
        for book in books:
            book_entries = queryset.filter(book_id=book['book__id'])
            result[book['book__id']] = {
                'book_id': book['book__id'],
                'book_title': book['book__title'],
                'count': book['count'],
                'entries': VocabularyEntrySerializer(book_entries, many=True).data
            }
        
        return Response(list(result.values()))
    
    @action(detail=False, methods=['get'])
    def due_for_review(self, request):
        user_id = request.query_params.get('user_id', 'default')
        now = timezone.now()
        
        # NULL next_review is treated as due so legacy rows are not stranded.
        entries = VocabularyEntry.objects.filter(
            Q(next_review__lte=now) | Q(next_review__isnull=True),
            user_id=user_id,
            status__in=['learning', 'known'],
        ).select_related('word_translation', 'sentence', 'sentence__chapter', 'book')[:20]
        
        return Response(VocabularyEntrySerializer(entries, many=True).data)
    
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """SM-2 spaced repetition algorithm"""
        entry = self.get_object()
        quality = request.data.get('quality')  # 0-5 scale

        # Reject non-integer input (for example the string "4") with a 400
        # instead of raising a TypeError deep inside the SM-2 maths.
        if isinstance(quality, bool) or not isinstance(quality, int):
            return Response(
                {'error': 'quality must be an integer between 0 and 5'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (0 <= quality <= 5):
            return Response({'error': 'quality (0-5) required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # SM-2 algorithm
        if quality >= 3:
            if entry.review_count == 0:
                entry.interval = 1
            elif entry.review_count == 1:
                entry.interval = 6
            else:
                entry.interval = round(entry.interval * entry.ease_factor)
            
            # Update ease factor
            entry.ease_factor = max(1.3, entry.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
            entry.review_count += 1
            entry.correct_count += 1
            
            if entry.review_count >= 3 and entry.ease_factor > 2.5:
                entry.status = 'mastered'
            elif entry.review_count >= 1:
                entry.status = 'known'
        else:
            # Failed - reset
            entry.interval = 1
            entry.review_count = 0
            entry.ease_factor = max(1.3, entry.ease_factor - 0.2)
            entry.status = 'learning'
        
        entry.last_reviewed = timezone.now()
        entry.next_review = timezone.now() + timezone.timedelta(days=entry.interval)
        entry.save()
        
        return Response(VocabularyEntrySerializer(entry).data)
    
    @action(detail=False, methods=['post'])
    def start_session(self, request):
        user_id = request.data.get('user_id', 'default')
        book_id = request.data.get('book_id')

        if not book_id:
            return Response(
                {'error': 'book_id is required to start a review session'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        book = Book.objects.filter(pk=book_id).first()
        if book is None:
            return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)

        session = ReviewSession.objects.create(
            user_id=user_id,
            book=book,
        )
        return Response(ReviewSessionSerializer(session).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def end_session(self, request, pk=None):
        try:
            session = ReviewSession.objects.get(pk=pk)
        except (ReviewSession.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Review session not found'}, status=status.HTTP_404_NOT_FOUND)
        session.ended_at = timezone.now()
        session.cards_reviewed = request.data.get('cards_reviewed', 0)
        session.cards_correct = request.data.get('cards_correct', 0)
        session.save()
        return Response(ReviewSessionSerializer(session).data)
