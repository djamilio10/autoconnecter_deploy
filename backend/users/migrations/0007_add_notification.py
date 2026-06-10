from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_add_platform_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[
                    ('appointment_new', 'Nouveau rendez-vous'),
                    ('appointment_confirmed', 'Rendez-vous confirmé'),
                    ('appointment_cancelled', 'Rendez-vous annulé'),
                    ('appointment_completed', 'Rendez-vous terminé'),
                    ('new_review', 'Nouvel avis'),
                    ('new_message', 'Nouveau message'),
                ], max_length=30)),
                ('message', models.TextField()),
                ('data', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'notifications',
                'ordering': ['-created_at'],
            },
        ),
    ]
