import getpass

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    # `createsuperuser` donne accès à /admin/ (Django) mais ne met PAS
    # user_type='admin' : le tableau de bord admin de l'app React (qui se base
    # sur user_type, pas sur is_staff) reste alors inaccessible après connexion.
    # Cette commande crée un compte valable pour les deux à la fois.
    help = (
        "Crée (ou promeut) un compte administrateur complet : accès à /admin/ "
        "(Django) ET au tableau de bord admin de l'application."
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', help="Email de l'administrateur")
        parser.add_argument('--password', help="Mot de passe (sinon demandé de façon masquée)")
        parser.add_argument('--username', help="Nom d'utilisateur (par défaut : dérivé de l'email)")

    def handle(self, *args, **options):
        email = (options['email'] or input('Email : ')).strip()
        if not email:
            raise CommandError('Email requis.')

        password = options['password']
        if not password:
            password = getpass.getpass('Mot de passe : ')
            if password != getpass.getpass('Confirmer le mot de passe : '):
                raise CommandError('Les mots de passe ne correspondent pas.')
        if not password:
            raise CommandError('Mot de passe requis.')

        username = options['username'] or email.split('@')[0]

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': username},
        )
        user.set_password(password)
        user.user_type = User.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_verified = True
        user.save()

        action = 'créé' if created else 'promu administrateur'
        self.stdout.write(self.style.SUCCESS(
            f"Compte {action} : {email}\n"
            "→ Admin Django (gestion base de données) : /admin/\n"
            "→ Tableau de bord admin de l'app : connectez-vous normalement sur le "
            "site avec cet email, le bouton \"Tableau de bord admin\" apparaît "
            "dans le menu du haut."
        ))
