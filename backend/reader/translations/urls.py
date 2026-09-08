from django.urls import path
from .views import TranslationViewSet

urlpatterns = [
    path('word/', TranslationViewSet.as_view({'post': 'word'}), name='word-translation'),
    path('sentence/', TranslationViewSet.as_view({'post': 'sentence'}), name='sentence-translation'),
    path('batch-sentence/', TranslationViewSet.as_view({'post': 'batch_sentence'}), name='batch-sentence-translation'),
    path('tts/', TranslationViewSet.as_view({'get': 'tts'}), name='tts-audio'),
    path('explain-3d/', TranslationViewSet.as_view({'post': 'explain_3d'}), name='explain-3d'),
    path('paragraph-summary/', TranslationViewSet.as_view({'post': 'paragraph_summary'}), name='paragraph-summary'),
]