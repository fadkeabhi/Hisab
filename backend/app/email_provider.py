"""Email delivery for owner registration, recovery and identity changes."""

import smtplib
import ssl
from email.message import EmailMessage

from .i18n import translate


def send_email(settings, recipient, code, language="en"):
    if settings.email_provider == "dev":
        if settings.app_env not in {"development", "test"}:
            raise RuntimeError("Development email is disabled")
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message["Subject"] = translate("Your Hishob verification code", language)
    message.set_content(
        translate(
            "Your Hishob code is {code}. It expires in {minutes} minutes. If you did not request this, ignore this email. Never share this code.",
            language,
            code=code,
            minutes=settings.otp_expire_seconds // 60,
        )
    )
    connection = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
    options = {"context": ssl.create_default_context()} if settings.smtp_ssl else {}
    with connection(settings.smtp_host, settings.smtp_port, timeout=15, **options) as smtp:
        if not settings.smtp_ssl:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
