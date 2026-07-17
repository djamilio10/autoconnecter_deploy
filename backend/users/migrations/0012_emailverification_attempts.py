from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_cni_non_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='emailverification',
            name='attempts',
            field=models.PositiveSmallIntegerField(default=0),
        ),
    ]
