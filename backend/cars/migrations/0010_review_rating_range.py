from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cars', '0009_rentalrequest_remove_review_unique_reviewer_seller_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='review',
            name='rating',
            field=models.IntegerField(
                default=5,
                validators=[MinValueValidator(1), MaxValueValidator(5)],
            ),
        ),
    ]
