from django.urls import path
from .views import TranslationViewSet

urlpatterns = [
    path('word/', TranslationViewSet.as_view({'post': 'word'}), name='word-translation'),
    path('sentence/', TranslationViewSet.as_view({'post': 'sentence'}), name='sentence-translation'),
    path('batch-sentence/', TranslationViewSet.as_view({'post': 'batch_sentence'}), name='batch-sentence-translation'),
]