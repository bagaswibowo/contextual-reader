# Generated manually to align schema with target_lang, engine, and notes
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('translations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='wordtranslation',
            name='target_lang',
            field=models.CharField(default='id', max_length=10),
        ),
        migrations.AddField(
            model_name='wordtranslation',
            name='engine',
            field=models.CharField(default='google', max_length=20),
        ),
        migrations.AddField(
            model_name='sentencetranslation',
            name='target_lang',
            field=models.CharField(default='id', max_length=10),
        ),
        migrations.AddField(
            model_name='sentencetranslation',
            name='engine',
            field=models.CharField(default='google', max_length=20),
        ),
        migrations.AddField(
            model_name='sentencetranslation',
            name='notes',
            field=models.TextField(blank=True, default=''),
        ),
    ]
