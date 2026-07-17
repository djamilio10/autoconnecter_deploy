# Fait vérifier les certificats TLS de Python contre le magasin de certificats du
# système d'exploitation (et non le bundle figé de `certifi`). Indispensable quand
# un antivirus/proxy intercepte le TLS et re-signe les certificats avec une autorité
# locale présente dans le magasin de l'OS (cas fréquent en dev sur Windows) : sans
# cela, les appels sortants (PayTech, SMTP…) échouent en CERTIFICATE_VERIFY_FAILED.
# Sécurisé : la vérification reste active, simplement adossée au trust store de l'OS.
try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    # truststore absent → on garde le comportement par défaut (certifi).
    pass
