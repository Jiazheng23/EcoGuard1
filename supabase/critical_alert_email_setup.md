# Critical alert email setup (Gmail API)

The `critical-alert-email` Edge Function sends one email when a new critical
row is inserted into `early_warning_alerts`. Repeated sensor updates at the same
severity update the active alert instead of inserting another row, so they do
not repeatedly email the recipient.

## 1. Configure Google OAuth

Enable Gmail API, create a Web OAuth client and obtain an offline refresh token
with the `https://www.googleapis.com/auth/gmail.send` scope.

```powershell
supabase secrets set GMAIL_CLIENT_ID="...apps.googleusercontent.com"
supabase secrets set GMAIL_CLIENT_SECRET="..."
supabase secrets set GMAIL_REFRESH_TOKEN="..."
supabase secrets set GMAIL_FROM="your-sender@gmail.com"
```

## 2. Deploy the function

First run `supabase/critical_alert_email_deliveries.sql` in the Supabase SQL
Editor. It ensures that multiple critical categories from one sensor cycle are
combined into only one email.

```powershell
supabase functions deploy critical-alert-email
```

Keep JWT verification enabled. The database webhook must send the project's
legacy anon JWT in its `Authorization` header. The function also looks up the
alert ID in the database and only sends for a real critical alert.

## 3. Add the database webhook

In Supabase Dashboard, open **Database > Webhooks > Create a new hook**:

- Name: `critical-alert-email`
- Table: `public.early_warning_alerts`
- Event: `INSERT`
- Type: Supabase Edge Function
- Function: `critical-alert-email`
- HTTP header: `Authorization` = `Bearer <legacy anon JWT>`

The function ignores non-critical alerts even if the webhook calls it.

## 4. Configure each recipient

In EcoGuard's Crowd Thresholds screen, enable **Auto alerts** and set the
notification email for the location. That address receives critical crowd,
waste, AQI, water-quality, and temperature alerts for the location.
