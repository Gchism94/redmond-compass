# Auth email templates — hosted mirror (owner/console packet)

The app signs users in with a **6-digit code** typed back into the in-app sheet
(`verifyOtp`). The emails are **code-only** — the old `{{ .ConfirmationURL }}` magic link
was removed (audit finding #2): under PKCE the link can't complete cross-device and only
ever pointed at whatever **Site URL** was set (localhost pre-cutover), so it was pure
failure surface.

## ⚠️ This is the step that actually reaches users

`supabase/config.toml` configures only the **local** dev stack. The **hosted** project does
**not** read these files. **Until you paste the blocks below into the hosted dashboard, real
users keep getting the OLD link-bearing email.** Do this once, on the hosted project.

### How to mirror (2 minutes)

Supabase dashboard → **Authentication → Email Templates**. For **each** template below:

1. Select the template (**Magic Link**, then **Confirm signup**).
2. Set **Subject** to: `Your Redmond Compass sign-in code`
3. Replace the **message body** with the matching HTML block, verbatim.
4. Save.

Set only these **two** templates. Leave **Reset Password / Invite / Change Email /
Reauthentication** at their defaults — the app has no password, invite, email-change, or
reauth flow, so those emails are never sent. Don't author templates for flows we don't have.

> Both templates are intentionally **identical in shape** (only the heading differs:
> "Your sign-in code" vs "Welcome aboard"), so whichever path Supabase routes a given
> sign-in through, the user sees the same code-first email. Keep them in sync with the
> `.html` files in this folder if you ever edit one.

---

### 1) Magic Link  (returning users)

Subject: `Your Redmond Compass sign-in code`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background-color:#FAF8F5">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #ece7df;border-radius:12px">
        <tr>
          <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
            <p style="margin:0 0 22px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#082954">Redmond Compass</p>
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#082954">Your sign-in code</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#333333">Enter this code to finish signing in:</p>
            <p style="margin:0 0 18px;font-size:40px;font-weight:700;letter-spacing:8px;color:#082954;line-height:1.1">{{ .Token }}</p>
            <p style="margin:0 0 26px;font-size:14px;line-height:1.5;color:#555555">This code expires in 1 hour. Type it into the app to continue.</p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#999999">If you didn't request this, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
      <p style="max-width:480px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#999999;text-align:center">Redmond Compass &middot; Redmond, Terrebonne &amp; Crooked River Ranch</p>
    </td>
  </tr>
</table>
```

### 2) Confirm signup  (first-time users)

Subject: `Your Redmond Compass sign-in code`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background-color:#FAF8F5">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #ece7df;border-radius:12px">
        <tr>
          <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
            <p style="margin:0 0 22px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#082954">Redmond Compass</p>
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#082954">Welcome aboard</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#333333">Enter this code to finish signing in:</p>
            <p style="margin:0 0 18px;font-size:40px;font-weight:700;letter-spacing:8px;color:#082954;line-height:1.1">{{ .Token }}</p>
            <p style="margin:0 0 26px;font-size:14px;line-height:1.5;color:#555555">This code expires in 1 hour. Type it into the app to continue.</p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#999999">If you didn't request this, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
      <p style="max-width:480px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#999999;text-align:center">Redmond Compass &middot; Redmond, Terrebonne &amp; Crooked River Ranch</p>
    </td>
  </tr>
</table>
```

---

## Notes

- **No plain-text part.** Supabase's template format is a single HTML body per type (no
  separate text template), so a distinct text/plain fallback isn't supported. The HTML is
  kept linear/semantic and the code is real text (not an image), so it reads fine when styles
  are stripped and to screen readers.
- **Branding is text-only, on purpose.** No remote `<img>` logo yet: `app.redmondcompass.com`
  isn't serving over its own domain until DNS cutover, so a self-hosted logo URL would 404 in
  the email today. Once the app domain is live, you may add this single line just under the
  navy wordmark `<p>` in both templates (self-hosted at the app's own origin, absolute https,
  never hotlinked from the old platform's media CDN, never an attachment):

  ```html
  <img src="https://app.redmondcompass.com/apple-touch-icon.png" width="44" height="44" alt="Redmond Compass" style="display:block;margin:0 0 16px;border-radius:8px">
  ```

  The email must still read correctly if this image is blocked (many clients block by
  default) — which it does, because the code and all text stand on their own.
