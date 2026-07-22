import type { Guide } from "../types";

// Privacy & Terms — authored for this platform (the old site had none to
// migrate). Grounded in what the app ACTUALLY does: local-first guest prefs,
// optional JIT accounts (email OTP / Google), no analytics, no ads, no data
// sales, equal ranking, and in-app account deletion (Account → Delete account).
//
// ANALYTICS IS DELIBERATELY NOT CLAIMED HERE. The sheet-sync spec proposes GA4
// "[confirm tool with Greg]", but it is NOT integrated and NOT confirmed, so the
// "no third-party analytics" statements below stay TRUE. When GA4 (or whatever
// tool) actually ships with a consent story, add the analytics paragraph AND name
// the real tool in the SAME commit — the policy must never describe unbuilt or
// unnamed behavior. Same rule for any new notification email or submission flow.
export const guide: Guide = {
  slug: "privacy",
  en: {
    name: "Privacy & Terms",
    title: "Privacy & Terms",
    intro:
      "Redmond Compass is a community hub, not a data business. This page explains in plain language what information the app touches, where it lives, and the ground rules for using the platform. Effective July 11, 2026.",
    sections: [
      {
        heading: "The short version",
        bullets: [
          "You can browse everything without an account, and we don't track you around the web.",
          "Your saves, follows, and interests live on your device until you choose to sign in.",
          "If you create an account, we store your email, optional name, and your preferences — that's it.",
          "No ads, no selling or sharing your data for marketing, no analytics trackers, no star ratings, no paid placement.",
        ],
      },
      {
        heading: "What stays on your device",
        body: "Browsing is local-first. These live in your browser's storage on your device, not on our servers, until you sign in:",
        bullets: [
          "Places you save or follow, events you save, and recently viewed listings.",
          "Your interests and notification preferences.",
          "Your language choice (English/Español).",
          "Your location, if you turn it on. It is used to sort results by distance and is never stored on our servers. It's optional, and you can turn it off any time in Account.",
        ],
      },
      {
        heading: "If you create an account",
        body: "Accounts are optional — the app only asks when you do something that needs one, like saving a place. If you sign in, we store:",
        bullets: [
          "Your email address, and your name if you choose to give it.",
          "If you use \"Continue with Google\": your name and email from your Google account. We never see your Google password.",
          "Your preferences (saves, follows, interests) — moved from your device to your profile so they follow you across devices. Nothing is lost and nothing else is copied.",
        ],
      },
      {
        heading: "What's public by design",
        bullets: [
          "Business listings, including everything an owner adds to their profile, bulletins, and events. Listing details are maintained by our team and kept up to date.",
          "Community events, including the submitter's name if provided. We do not publish submitter email addresses.",
          "Recommendations are counted, not displayed with your name — one per person per business, and they never change search ranking.",
          "Owner contact details used only for account management are not published unless you include them in your public listing.",
        ],
      },
      {
        heading: "What we don't do",
        bullets: [
          "We don't sell, rent, or share your personal information for marketing.",
          "We don't run ads or advertising trackers.",
          "We don't use third-party analytics that profile you.",
          "We don't offer paid placement — every listing ranks equally, so there's no incentive to mine your data.",
        ],
      },
      {
        heading: "Services we rely on",
        body: "A few trusted services make the app work. Each receives only what's needed to do its job:",
        items: [
          { title: "Supabase", body: "Hosts our database and sign-in. Your account data and public content live there, protected by access rules so only you (and the things you make public) are visible." },
          { title: "Google", body: "Sign-in with Google (only if you choose it) and the fonts the app uses, which are delivered from Google's servers. Links that open Google Maps for directions, or add an event to Google/Outlook calendars, take you to those services under their own policies." },
          { title: "Email delivery", body: "When you sign in with a code, an email provider delivers that message to you. That's the only email the app sends today." },
        ],
      },
      {
        heading: "Your choices and your data",
        bullets: [
          "Browse without an account — always available, never nagged.",
          "Clear guest data any time by clearing your browser or app storage.",
          "Sign out from Account whenever you like.",
          "Delete your account any time from Account → Delete account — it permanently removes your account, saved places, and follows. A business you own stays listed but is no longer linked to you. You can also email RedmondCompass@gmail.com from your account address; either way, we act within 30 days.",
        ],
      },
      {
        heading: "How long we keep it, and how it's kept",
        body: "We keep personal information only as long as we need it — an active account for as long as it's active, and technical logs for a limited period. Data lives with providers that use industry-standard encryption and access controls, and we deliberately hold as little personal data as possible. No system is perfectly secure, but keeping the amount small is our first line of defense.",
      },
      {
        heading: "Children",
        body: "Redmond Compass is a general-audience app about local businesses and community life. It is not directed at children under 13, and we don't knowingly collect personal information from them.",
      },
      {
        heading: "Terms of use, briefly",
        bullets: [
          "Be a good neighbor: submit accurate listings and events, and don't post anything unlawful, deceptive, or abusive.",
          "One Recommendation per person per business — they're positive-only and can't be gamed into a ranking.",
          "We may edit or remove content that is inaccurate, out of date, or violates these rules.",
          "The app and its guides are provided as-is: we work to keep information current, but always confirm details (hours, fees, services) with each business or provider.",
          "Redmond Compass is operated from Redmond, Oregon.",
        ],
      },
      {
        heading: "Changes to this page",
        body: "If our practices change — for example, if we ever add analytics or new notification emails — we'll update this page and change the effective date at the top before the change takes effect.",
      },
    ],
    contactEmail: "Questions about privacy, or want your data deleted? Email us and a human will answer.",
    reviewed: "Effective July 11, 2026",
    metaTitle: "Privacy & Terms | Redmond Compass",
    metaDescription:
      "How Redmond Compass handles your data: local-first browsing, optional accounts, no ads, no trackers, no data sales — and the ground rules for the platform.",
  },
  es: {
    name: "Privacidad y términos",
    title: "Privacidad y términos",
    intro:
      "Redmond Compass es un centro comunitario, no un negocio de datos. Esta página explica en lenguaje claro qué información toca la app, dónde vive y las reglas básicas para usar la plataforma. Vigente desde el 11 de julio de 2026.",
    sections: [
      {
        heading: "La versión corta",
        bullets: [
          "Puedes explorar todo sin cuenta, y no te rastreamos por la web.",
          "Tus guardados, seguidos e intereses viven en tu dispositivo hasta que decidas iniciar sesión.",
          "Si creas una cuenta, guardamos tu correo, tu nombre (opcional) y tus preferencias. Nada más.",
          "Sin anuncios, sin venta ni intercambio de tus datos para marketing, sin rastreadores de analítica, sin estrellas y sin publicidad pagada en los resultados.",
        ],
      },
      {
        heading: "Lo que se queda en tu dispositivo",
        body: "La app funciona primero en local. Esto vive en el almacenamiento de tu navegador, en tu dispositivo, no en nuestros servidores, hasta que inicies sesión:",
        bullets: [
          "Los lugares que guardas o sigues, los eventos que guardas y los listados vistos recientemente.",
          "Tus intereses y preferencias de notificaciones.",
          "Tu idioma (English/Español).",
          "Tu ubicación, si la activas. Se usa para ordenar los resultados por distancia y nunca se guarda en nuestros servidores. Es opcional y puedes apagarla cuando quieras en Cuenta.",
        ],
      },
      {
        heading: "Si creas una cuenta",
        body: "Las cuentas son opcionales: la app solo la pide cuando haces algo que la necesita, como guardar un lugar. Si inicias sesión, guardamos:",
        bullets: [
          "Tu correo electrónico, y tu nombre si decides darlo.",
          "Si usas \"Continuar con Google\": tu nombre y correo de tu cuenta de Google. Nunca vemos tu contraseña de Google.",
          "Tus preferencias (guardados, seguidos, intereses), que pasan de tu dispositivo a tu perfil para que te acompañen en todos tus dispositivos. No se pierde nada y no se copia nada más.",
        ],
      },
      {
        heading: "Lo que es público por diseño",
        bullets: [
          "Los listados de negocios, incluido todo lo que un dueño agrega a su perfil, sus avisos y eventos. Nuestro equipo mantiene los datos de los listados y los conserva al día.",
          "Los eventos comunitarios, incluido el nombre de quien los envía, si lo da. No publicamos correos electrónicos de quienes envían eventos.",
          "Las recomendaciones se cuentan, no se muestran con tu nombre: una por persona por negocio, y nunca cambian el orden de los resultados.",
          "Los datos de contacto del dueño que se usan solo para gestionar la cuenta no se publican, a menos que los incluyas en tu listado público.",
        ],
      },
      {
        heading: "Lo que no hacemos",
        bullets: [
          "No vendemos, rentamos ni compartimos tu información personal para marketing.",
          "No mostramos anuncios ni usamos rastreadores publicitarios.",
          "No usamos analítica de terceros que te perfile.",
          "No existe la publicidad pagada en los resultados: todos los listados aparecen en igualdad, así que no hay incentivo para explotar tus datos.",
        ],
      },
      {
        heading: "Servicios en los que nos apoyamos",
        body: "Unos pocos servicios confiables hacen funcionar la app. Cada uno recibe solo lo necesario para su trabajo:",
        items: [
          { title: "Supabase", body: "Aloja nuestra base de datos y el inicio de sesión. Tus datos de cuenta y el contenido público viven ahí, protegidos por reglas de acceso para que solo tú (y lo que haces público) sean visibles." },
          { title: "Google", body: "El inicio de sesión con Google (solo si lo eliges) y las tipografías de la app, que se entregan desde servidores de Google. Los enlaces que abren Google Maps para direcciones, o que agregan un evento a los calendarios de Google/Outlook, te llevan a esos servicios bajo sus propias políticas." },
          { title: "Entrega de correo", body: "Cuando inicias sesión con un código, un proveedor de correo te entrega ese mensaje. Es el único correo que la app envía hoy." },
        ],
      },
      {
        heading: "Tus opciones y tus datos",
        bullets: [
          "Explora sin cuenta: siempre disponible, sin insistencia.",
          "Borra los datos de invitado cuando quieras limpiando el almacenamiento de tu navegador o de la app.",
          "Cierra sesión desde Cuenta cuando gustes.",
          "Elimina tu cuenta cuando quieras desde Cuenta → Eliminar cuenta: borra de forma permanente tu cuenta, los lugares guardados y los seguidos. Un negocio que administres sigue en el directorio, pero deja de estar vinculado a ti. También puedes escribir a RedmondCompass@gmail.com desde el correo de tu cuenta; en cualquier caso, actuamos dentro de 30 días.",
        ],
      },
      {
        heading: "Cuánto tiempo lo guardamos y cómo lo protegemos",
        body: "Conservamos la información personal solo el tiempo que la necesitamos: una cuenta activa mientras siga activa, y los registros técnicos por un periodo limitado. Los datos viven con proveedores que usan cifrado y controles de acceso estándar de la industria, y a propósito guardamos la menor cantidad posible de datos personales. Ningún sistema es perfectamente seguro, pero mantener poca información es nuestra primera defensa.",
      },
      {
        heading: "Menores de edad",
        body: "Redmond Compass es una app de audiencia general sobre negocios locales y vida comunitaria. No está dirigida a menores de 13 años y no recopilamos a sabiendas su información personal.",
      },
      {
        heading: "Términos de uso, en breve",
        bullets: [
          "Sé buen vecino: envía listados y eventos precisos, y no publiques nada ilegal, engañoso o abusivo.",
          "Una recomendación por persona por negocio: son solo positivas y no pueden manipular el ranking.",
          "Podemos editar o retirar contenido inexacto, desactualizado o que viole estas reglas.",
          "La app y sus guías se ofrecen tal cual: trabajamos por mantener la información al día, pero confirma siempre los detalles (horarios, tarifas, servicios) con cada negocio o proveedor.",
          "Redmond Compass se opera desde Redmond, Oregon.",
        ],
      },
      {
        heading: "Cambios en esta página",
        body: "Si nuestras prácticas cambian —por ejemplo, si algún día agregamos analítica o nuevos correos de notificación— actualizaremos esta página y cambiaremos la fecha de vigencia antes de que el cambio entre en efecto.",
      },
    ],
    contactEmail: "¿Preguntas sobre privacidad, o quieres eliminar tus datos? Escríbenos y te responde una persona.",
    reviewed: "Vigente desde el 11 de julio de 2026",
    metaTitle: "Privacidad y términos | Redmond Compass",
    metaDescription:
      "Cómo maneja tus datos Redmond Compass: navegación local primero, cuentas opcionales, sin anuncios, sin rastreadores, sin venta de datos, y las reglas de la plataforma.",
  },
};
