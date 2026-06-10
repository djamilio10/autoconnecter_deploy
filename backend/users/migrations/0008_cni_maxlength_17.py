from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_add_notification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='id_card_number',
            field=models.CharField(
                max_length=17,
                unique=True,
                null=True,
                blank=False,
                verbose_name='Numero CNI',
                validators=[
                    django.core.validators.RegexValidator(
                        regex=r'^[12]\d{12}$|^[12]\d{16}$',
                        message='CNI invalide : 13 ou 17 chiffres, commencant par 1 (homme) ou 2 (femme).',
                    )
                ],
            ),
        ),
    ]
