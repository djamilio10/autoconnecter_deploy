"""Cycle de vie des abonnements Premium.

À lancer une fois par jour (cron / tâche planifiée) :

    python manage.py process_premium_subscriptions

Trois étapes idempotentes :
  1. Rappel J-1 : prévient le vendeur que son abonnement se termine demain.
  2. Avis de grâce : à l'échéance dépassée, prévient qu'il reste N jours de grâce.
  3. Désactivation : à la fin du délai de grâce, repasse le compte en Gratuit.

Comme PayTech ne permet aucun prélèvement automatique, le renouvellement est
toujours une action volontaire du vendeur ; cette commande ne fait qu'envoyer les
relances et désactiver le Premium en l'absence de paiement.
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from cars.models import Seller
from users.models import AuditLog
from users.email_utils import (
    send_premium_renewal_reminder,
    send_premium_grace_notice,
    send_premium_downgraded,
)


class Command(BaseCommand):
    help = "Envoie les relances de renouvellement Premium et désactive les abonnements expirés."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Affiche les actions sans envoyer d'email ni modifier la base.",
        )

    def handle(self, *args, **options):
        dry = options['dry_run']
        now = timezone.now()
        grace = timedelta(days=settings.PREMIUM_GRACE_DAYS)
        reminder_window = timedelta(days=settings.PREMIUM_REMINDER_DAYS_BEFORE)

        reminded = grace_notified = downgraded = 0

        # On ne considère que les vendeurs actuellement marqués Premium avec une échéance.
        sellers = Seller.objects.filter(is_premium=True, premium_until__isnull=False)

        for seller in sellers:
            expiry = seller.premium_until
            grace_end = seller.premium_grace_end  # expiry + grace

            # 3. Fin du délai de grâce → désactivation.
            if grace_end <= now:
                downgraded += 1
                self.stdout.write(f"  ↓ Désactivation Premium : {seller} (expiré le {expiry:%d/%m/%Y})")
                if not dry:
                    seller.is_premium = False
                    seller.premium_requested = False
                    seller.premium_renewal_reminded_at = None
                    seller.premium_expiry_notified_at = None
                    seller.save(update_fields=[
                        'is_premium', 'premium_requested',
                        'premium_renewal_reminded_at', 'premium_expiry_notified_at',
                    ])
                    AuditLog.objects.create(
                        admin=None, action='premium_expired',
                        target_type='seller', target_id=seller.pk, target_repr=seller.name,
                        note=f"Désactivation auto (non renouvelé, expiré le {expiry:%d/%m/%Y})",
                    )
                    send_premium_downgraded(seller)
                continue

            # 2. Échéance dépassée mais dans le délai de grâce → avis de grâce (une fois).
            if expiry <= now < grace_end:
                if seller.premium_expiry_notified_at is None:
                    grace_notified += 1
                    self.stdout.write(f"  ⚠ Avis de grâce : {seller} (grâce jusqu'au {grace_end:%d/%m/%Y})")
                    if not dry:
                        seller.premium_expiry_notified_at = now
                        seller.save(update_fields=['premium_expiry_notified_at'])
                        send_premium_grace_notice(seller, grace_end)
                continue

            # 1. Échéance imminente (dans la fenêtre de rappel) → rappel J-1 (une fois).
            if now < expiry <= now + reminder_window:
                if seller.premium_renewal_reminded_at is None:
                    reminded += 1
                    self.stdout.write(f"  ⏳ Rappel J-1 : {seller} (échéance {expiry:%d/%m/%Y})")
                    if not dry:
                        seller.premium_renewal_reminded_at = now
                        seller.save(update_fields=['premium_renewal_reminded_at'])
                        send_premium_renewal_reminder(seller, expiry)
                continue

        prefix = '[dry-run] ' if dry else ''
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}Terminé : {reminded} rappel(s), {grace_notified} avis de grâce, "
            f"{downgraded} désactivation(s)."
        ))
