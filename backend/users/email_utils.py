from django.core.mail import EmailMultiAlternatives
from django.conf import settings


def _build_verification_html(code: str, first_name: str) -> str:
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
    msg.send()
