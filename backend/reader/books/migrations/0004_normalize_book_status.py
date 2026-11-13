from django.db import migrations


def normalize_book_status(apps, schema_editor):
    """The code used to write 'completed', which is not in STATUS_CHOICES.

    'ready' is the canonical terminal state, so fold legacy rows into it.
    """
    Book = apps.get_model('books', 'Book')
    Book.objects.filter(status='completed').update(status='ready')


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0003_alter_book_format'),
    ]

    operations = [
        migrations.RunPython(normalize_book_status, migrations.RunPython.noop),
    ]
