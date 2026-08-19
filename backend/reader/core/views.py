# Core app views
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection
from django.core.cache import cache


@api_view(['GET'])
def health(request):
    """Health check endpoint"""
    # Check database
    db_ok = False
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_ok = True
    except Exception:
        pass
    
    # Check cache
    cache_ok = False
    try:
        cache.set('health_check', 'ok', 10)
        cache_ok = cache.get('health_check') == 'ok'
    except Exception:
        pass
    
    return Response({
        'status': 'healthy' if db_ok and cache_ok else 'degraded',
        'database': 'ok' if db_ok else 'error',
        'cache': 'ok' if cache_ok else 'error',
    })