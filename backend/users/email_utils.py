import html
from concurrent.futures import ThreadPoolExecutor

from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.db import connections


# Pool de threads BORNÉ pour l'envoi d'emails. Un thread-par-envoi non borné
# pourrait épuiser la mémoire/les sockets sous un pic d'inscriptions (des milliers
# de threads simultanés). Ici, au plus N envois en parallèle ; le surplus est mis
# en file d'attente. max_workers configurable via EMAIL_THREAD_POOL_SIZE.
_email_pool = ThreadPoolExecutor(
    max_workers=getattr(settings, 'EMAIL_THREAD_POOL_SIZE', 4),
    thread_name_prefix='email',
)


def _deliver(msg):
    try:
        msg.send()
    except Exception:
        # Erreurs SMTP silencieuses (comportement attendu côté vues).
        pass
    finally:
        # Ferme les connexions DB éventuellement ouvertes par ce thread.
        connections.close_all()


def _send_async(msg):
    """Envoie un email via le pool de threads borné (fire-and-forget).

    Bénéfices :
    - Performance : la requête HTTP (ex. /register) n'attend plus la poignée de
      main SMTP vers Gmail (~300 ms–2 s) ; elle répond immédiatement.
    - Robustesse : le pool borné évite la création illimitée de threads sous charge.
    - Sécurité : égalise le temps de réponse entre compte existant/inexistant
      (atténue l'énumération par canal temporel sur les flux email).
    """
    _email_pool.submit(_deliver, msg)


def _build_verification_html(code: str, first_name: str) -> str:
    first_name = html.escape(first_name)
    code = html.escape(code)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérification de votre email — AUTOCONNECT</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <span style="font-size:30px;font-weight:900;color:#c9a96e;letter-spacing:0.08em;font-family:Georgia,serif;">AUTO</span><span style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:0.08em;font-family:Georgia,serif;">CONNECT</span>
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td style="background:#111113;border:1px solid #27272a;border-radius:24px;overflow:hidden;">

              <!-- Barre dorée -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#c9a96e,#e4c98a,#c9a96e);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <div style="padding:40px 40px 48px;">

                <!-- Icône -->
                <div style="text-align:center;margin-bottom:28px;">
                  <div style="display:inline-block;width:76px;height:76px;background:rgba(201,169,110,0.1);border:2px solid rgba(201,169,110,0.35);border-radius:50%;font-size:34px;line-height:76px;text-align:center;">
                    ✉️
                  </div>
                </div>

                <!-- Titre -->
                <h1 style="margin:0 0 10px;text-align:center;font-size:26px;font-weight:700;color:#ffffff;font-family:Georgia,serif;line-height:1.3;">
                  Vérifiez votre adresse email
                </h1>

                <!-- Sous-titre -->
                <p style="margin:0 0 32px;text-align:center;font-size:15px;color:#a1a1aa;line-height:1.7;">
                  Bonjour <strong style="color:#e4e4e7;">{first_name}</strong> !<br>
                  Bienvenue sur <strong style="color:#c9a96e;">AUTOCONNECT</strong>. Pour activer votre compte,<br>entrez le code ci-dessous sur la plateforme.
                </p>

                <!-- Bloc code -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e10;border:2px solid rgba(201,169,110,0.4);border-radius:16px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:28px;text-align:center;">
                      <div style="font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;font-family:Arial,sans-serif;">
                        Votre code de vérification
                      </div>
                      <div style="font-size:52px;font-weight:900;color:#c9a96e;letter-spacing:0.35em;font-family:Georgia,serif;line-height:1;">
                        {code}
                      </div>
                      <div style="font-size:13px;color:#52525b;margin-top:16px;font-family:Arial,sans-serif;">
                        Expire dans <strong style="color:#a1a1aa;">10 minutes</strong>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Avertissement sécurité -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,169,110,0.06);border:1px solid rgba(201,169,110,0.18);border-radius:12px;margin-bottom:36px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.65;font-family:Arial,sans-serif;">
                        🔒 <strong style="color:#c9a96e;">Sécurité :</strong> Si vous n'avez pas créé de compte sur AUTOCONNECT, ignorez cet email. Votre adresse ne sera pas enregistrée.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Séparateur -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="height:1px;background:#27272a;font-size:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Pied de carte -->
                <p style="margin:0;font-size:12px;color:#52525b;text-align:center;line-height:1.8;font-family:Arial,sans-serif;">
                  Cet email a été envoyé automatiquement par <strong style="color:#71717a;">AUTOCONNECT</strong>.<br>
                  Merci de ne pas répondre directement à ce message.
                </p>

              </div>
            </td>
          </tr>

          <!-- Copyright -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#3f3f46;font-family:Arial,sans-serif;">
                © 2026 AUTOCONNECT — Plateforme de vente automobile au Sénégal
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_verification_email(user, code: str) -> None:
    first_name = user.first_name or user.email.split('@')[0]
    subject = f'[AUTOCONNECT] Votre code de vérification : {code}'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Votre code de vérification AUTOCONNECT est : {code}\n\n"
        f"Ce code expire dans 10 minutes.\n\n"
        f"Si vous n'avez pas créé de compte, ignorez cet email.\n\n"
        f"— L'équipe AUTOCONNECT"
    )
    html_body = _build_verification_html(code, first_name)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    msg.attach_alternative(html_body, 'text/html')
    _send_async(msg)


def _build_reset_html(code: str, first_name: str) -> str:
    first_name = html.escape(first_name)
    code = html.escape(code)
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe — AUTOCONNECT</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <span style="font-size:30px;font-weight:900;color:#c9a96e;letter-spacing:0.08em;font-family:Georgia,serif;">AUTO</span><span style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:0.08em;font-family:Georgia,serif;">CONNECT</span>
            </td>
          </tr>
          <tr>
            <td style="background:#111113;border:1px solid #27272a;border-radius:24px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#c9a96e,#e4c98a,#c9a96e);font-size:0;">&nbsp;</td>
                </tr>
              </table>
              <div style="padding:40px 40px 48px;">
                <div style="text-align:center;margin-bottom:28px;">
                  <div style="display:inline-block;width:76px;height:76px;background:rgba(201,169,110,0.1);border:2px solid rgba(201,169,110,0.35);border-radius:50%;font-size:34px;line-height:76px;text-align:center;">
                    🔑
                  </div>
                </div>
                <h1 style="margin:0 0 10px;text-align:center;font-size:26px;font-weight:700;color:#ffffff;font-family:Georgia,serif;line-height:1.3;">
                  Réinitialisez votre mot de passe
                </h1>
                <p style="margin:0 0 32px;text-align:center;font-size:15px;color:#a1a1aa;line-height:1.7;">
                  Bonjour <strong style="color:#e4e4e7;">{first_name}</strong>,<br>
                  Vous avez demandé à réinitialiser votre mot de passe.<br>Entrez le code ci-dessous sur la plateforme.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e10;border:2px solid rgba(201,169,110,0.4);border-radius:16px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:28px;text-align:center;">
                      <div style="font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;font-family:Arial,sans-serif;">
                        Votre code de réinitialisation
                      </div>
                      <div style="font-size:52px;font-weight:900;color:#c9a96e;letter-spacing:0.35em;font-family:Georgia,serif;line-height:1;">
                        {code}
                      </div>
                      <div style="font-size:13px;color:#52525b;margin-top:16px;font-family:Arial,sans-serif;">
                        Expire dans <strong style="color:#a1a1aa;">10 minutes</strong>
                      </div>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(224,92,92,0.06);border:1px solid rgba(224,92,92,0.18);border-radius:12px;margin-bottom:36px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.65;font-family:Arial,sans-serif;">
                        🔒 <strong style="color:#e05c5c;">Sécurité :</strong> Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe restera inchangé. Ne communiquez ce code à personne.
                      </p>
                    </td>
                  </tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="height:1px;background:#27272a;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
                <p style="margin:0;font-size:12px;color:#52525b;text-align:center;line-height:1.8;font-family:Arial,sans-serif;">
                  Cet email a été envoyé automatiquement par <strong style="color:#71717a;">AUTOCONNECT</strong>.<br>
                  Merci de ne pas répondre directement à ce message.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#3f3f46;font-family:Arial,sans-serif;">
                © 2026 AUTOCONNECT — Plateforme de vente automobile au Sénégal
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_password_reset_email(user, code: str) -> None:
    first_name = user.first_name or user.email.split('@')[0]
    subject = f'[AUTOCONNECT] Code de réinitialisation : {code}'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Vous avez demandé à réinitialiser votre mot de passe AUTOCONNECT.\n"
        f"Votre code de réinitialisation est : {code}\n\n"
        f"Ce code expire dans 10 minutes.\n\n"
        f"Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — "
        f"votre mot de passe restera inchangé.\n\n"
        f"— L'équipe AUTOCONNECT"
    )
    html_body = _build_reset_html(code, first_name)

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    msg.attach_alternative(html_body, 'text/html')
    _send_async(msg)


# ── Emails liés à l'abonnement Premium ────────────────────────────────────────

def _build_premium_html(*, first_name, icon, title, intro_html,
                        highlight_html=None, accent='#c9a96e',
                        cta_label=None, cta_url=None) -> str:
    """Construit un email Premium dans le gabarit doré d'AUTOCONNECT.
    `intro_html` / `highlight_html` sont du HTML déjà échappé/maîtrisé (pas d'entrée
    utilisateur brute hormis le prénom, échappé ci-dessous)."""
    first_name = html.escape(first_name)
    highlight_block = ''
    if highlight_html:
        highlight_block = f"""
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e10;border:1px solid {accent}40;border-radius:14px;margin-bottom:28px;">
                  <tr><td style="padding:22px 24px;font-size:14px;color:#e4e4e7;line-height:1.7;font-family:Arial,sans-serif;">
                    {highlight_html}
                  </td></tr>
                </table>"""
    cta_block = ''
    if cta_label and cta_url:
        cta_block = f"""
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                  <tr><td align="center">
                    <a href="{html.escape(cta_url)}" style="display:inline-block;padding:14px 32px;background:linear-gradient(90deg,#c9a96e,#e4c98a);color:#0a0a0b;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:Arial,sans-serif;">{html.escape(cta_label)}</a>
                  </td></tr>
                </table>"""
    return f"""<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{html.escape(title)} — AUTOCONNECT</title></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;"><tr><td align="center" style="padding:48px 20px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding-bottom:36px;">
        <span style="font-size:30px;font-weight:900;color:#c9a96e;letter-spacing:0.08em;font-family:Georgia,serif;">AUTO</span><span style="font-size:30px;font-weight:900;color:#ffffff;letter-spacing:0.08em;font-family:Georgia,serif;">CONNECT</span>
      </td></tr>
      <tr><td style="background:#111113;border:1px solid #27272a;border-radius:24px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:4px;background:linear-gradient(90deg,#c9a96e,#e4c98a,#c9a96e);font-size:0;">&nbsp;</td></tr></table>
        <div style="padding:40px 40px 48px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="display:inline-block;width:76px;height:76px;background:{accent}1a;border:2px solid {accent}59;border-radius:50%;font-size:34px;line-height:76px;text-align:center;">{icon}</div>
          </div>
          <h1 style="margin:0 0 18px;text-align:center;font-size:25px;font-weight:700;color:#ffffff;font-family:Georgia,serif;line-height:1.3;">{html.escape(title)}</h1>
          <p style="margin:0 0 28px;text-align:center;font-size:15px;color:#a1a1aa;line-height:1.7;">
            Bonjour <strong style="color:#e4e4e7;">{first_name}</strong>,<br>{intro_html}
          </p>
          {highlight_block}
          {cta_block}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td style="height:1px;background:#27272a;font-size:0;">&nbsp;</td></tr></table>
          <p style="margin:0;font-size:12px;color:#52525b;text-align:center;line-height:1.8;font-family:Arial,sans-serif;">
            Cet email a été envoyé automatiquement par <strong style="color:#71717a;">AUTOCONNECT</strong>.<br>Merci de ne pas répondre directement à ce message.
          </p>
        </div>
      </td></tr>
      <tr><td style="padding:28px 0 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#3f3f46;font-family:Arial,sans-serif;">© 2026 AUTOCONNECT — Plateforme de vente automobile au Sénégal</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""


def _premium_user(seller):
    """Retrouve l'utilisateur (et son prénom + email) lié à un vendeur."""
    user = getattr(seller, 'user', None)
    email = user.email if user else None
    first_name = (user.first_name if user and user.first_name else
                  (email.split('@')[0] if email else seller.name))
    return user, email, first_name


def _send_premium(seller, subject, text_body, html_body):
    user, email, _ = _premium_user(seller)
    if not email:
        return
    msg = EmailMultiAlternatives(
        subject=subject, body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL, to=[email],
    )
    msg.attach_alternative(html_body, 'text/html')
    _send_async(msg)


def _fmt_date(dt):
    from django.utils import timezone
    if not dt:
        return ''
    local = timezone.localtime(dt)
    return local.strftime('%d/%m/%Y')


def send_premium_payment_confirmation(seller, premium_until) -> None:
    """Paiement reçu → Premium activé/prolongé."""
    _, _, first_name = _premium_user(seller)
    until = _fmt_date(premium_until)
    subject = '[AUTOCONNECT] Votre abonnement Premium est actif ⭐'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Votre paiement a bien été reçu. Votre abonnement Premium est actif "
        f"jusqu'au {until}.\n\nMerci de votre confiance.\n\n— L'équipe AUTOCONNECT"
    )
    html_body = _build_premium_html(
        first_name=first_name, icon='⭐', title='Abonnement Premium activé',
        intro_html='votre paiement a bien été reçu. Vos avantages Premium sont désormais actifs.',
        highlight_html=f'✅ <strong style="color:#c9a96e;">Premium actif jusqu\'au {until}</strong><br>'
                       f'Annonces illimitées, badge ⭐, priorité dans le catalogue et support prioritaire.',
    )
    _send_premium(seller, subject, text_body, html_body)


def send_premium_renewal_reminder(seller, premium_until) -> None:
    """Rappel J-1 avant l'échéance."""
    _, _, first_name = _premium_user(seller)
    until = _fmt_date(premium_until)
    subject = '[AUTOCONNECT] Votre abonnement Premium se termine demain'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Votre abonnement Premium arrive à échéance le {until}. Pensez à le renouveler "
        f"pour conserver vos avantages (annonces illimitées, badge ⭐, priorité catalogue).\n"
        f"Sans renouvellement, votre compte repassera en formule Gratuite après un court "
        f"délai de grâce.\n\n— L'équipe AUTOCONNECT"
    )
    html_body = _build_premium_html(
        first_name=first_name, icon='⏳', title='Votre Premium se termine demain',
        intro_html=f'votre abonnement Premium arrive à échéance le <strong style="color:#e4e4e7;">{until}</strong>.',
        highlight_html='Renouvelez dès maintenant pour conserver vos annonces illimitées, '
                       'votre badge ⭐ et votre priorité dans le catalogue. Sans renouvellement, '
                       'votre compte repassera en formule Gratuite après le délai de grâce.',
        cta_label='Renouveler mon abonnement', cta_url=settings.FRONTEND_URL,
    )
    _send_premium(seller, subject, text_body, html_body)


def send_premium_grace_notice(seller, grace_end) -> None:
    """Échéance dépassée, période de grâce en cours."""
    _, _, first_name = _premium_user(seller)
    until = _fmt_date(grace_end)
    subject = '[AUTOCONNECT] Action requise : renouvelez votre Premium'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Votre abonnement Premium a expiré. Vous disposez d'un délai de grâce jusqu'au "
        f"{until} pour le renouveler. Passé ce délai, votre compte repassera "
        f"automatiquement en formule Gratuite et perdra ses avantages Premium.\n\n"
        f"— L'équipe AUTOCONNECT"
    )
    html_body = _build_premium_html(
        first_name=first_name, icon='⚠️', title='Renouvelez votre Premium', accent='#e0a05c',
        intro_html='votre abonnement Premium a expiré, mais vos avantages sont encore actifs '
                   'pendant un court délai de grâce.',
        highlight_html=f'⏰ <strong style="color:#e0a05c;">Délai jusqu\'au {until}</strong><br>'
                       f'Sans renouvellement avant cette date, votre compte repassera en formule '
                       f'Gratuite (limité à 3 annonces actives) et perdra ses avantages Premium.',
        cta_label='Renouveler maintenant', cta_url=settings.FRONTEND_URL,
    )
    _send_premium(seller, subject, text_body, html_body)


def send_premium_downgraded(seller) -> None:
    """Premium désactivé après expiration du délai de grâce."""
    _, _, first_name = _premium_user(seller)
    subject = '[AUTOCONNECT] Votre abonnement Premium a pris fin'
    text_body = (
        f"Bonjour {first_name},\n\n"
        f"Faute de renouvellement, votre abonnement Premium a pris fin et votre compte "
        f"est repassé en formule Gratuite (limité à 3 annonces actives). Vous pouvez "
        f"réactiver le Premium à tout moment depuis votre tableau de bord.\n\n"
        f"— L'équipe AUTOCONNECT"
    )
    html_body = _build_premium_html(
        first_name=first_name, icon='🔓', title='Votre Premium a pris fin', accent='#71717a',
        intro_html='faute de renouvellement, votre abonnement Premium a pris fin et votre '
                   'compte est repassé en formule Gratuite.',
        highlight_html='Votre compte est désormais limité à <strong>3 annonces actives</strong>. '
                       'Vos annonces existantes restent visibles, mais vous ne pourrez en publier '
                       'de nouvelles qu\'après être repassé sous la limite ou avoir réactivé le Premium.',
        cta_label='Réactiver le Premium', cta_url=settings.FRONTEND_URL,
    )
    _send_premium(seller, subject, text_body, html_body)
