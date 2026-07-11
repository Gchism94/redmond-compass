import type { Guide } from "../types";

// Source: migration/content/for-business-owners.md, adapted to the platform's
// actual model: every listing is free AND complete (no locked profiles), claiming
// happens in-app, and reputation is the Recommend heart — there are no reviews or
// star ratings, and no paid placement. The old FAQ said otherwise; this is the truth.
export const guide: Guide = {
  slug: "for-business-owners",
  en: {
    name: "For Business Owners",
    kicker: "For business owners",
    title: "Grow your local business",
    intro: "Get discovered by thousands of Redmond residents looking for exactly what you offer.",
    sections: [
      {
        heading: "Business visibility tips",
        bullets: [
          "Add a high-quality logo or photo — listings with images get significantly more attention.",
          "Write a clear, descriptive summary of what makes your business unique.",
          "Keep your hours and contact info up to date so customers can reach you.",
          "Use relevant tags to help locals discover your business when searching.",
          "Share your profile link on social media to drive traffic to your listing.",
          "Add your specials or promotions to keep your profile fresh and engaging.",
        ],
      },
      {
        heading: "Frequently asked questions",
        items: [
          { title: "How do I get my business listed?", body: "Right here in the app: go to Account → Switch to Business, then claim your existing listing or create a new one. It takes a couple of minutes." },
          { title: "Is listing my business free?", body: "Yes. Listings on Redmond Compass are completely free for local businesses — and free listings are complete: your full profile, photos, hours, and contact info, nothing held back." },
          { title: "How does ranking work?", body: "Every business ranks equally. There is no paid placement, no featured spots, and no star ratings — neighbors can Recommend (♥) a business they love, and that count never reorders search results." },
          { title: "How do I update my business information?", body: "Sign in and open your owner dashboard to edit your listing, post bulletins, and submit events — or contact us and we'll help." },
          { title: "How long does it take to get listed?", body: "Creating or claiming a listing is immediate. The Verified badge is applied once we confirm you're the owner." },
        ],
      },
      {
        heading: "Ready to get started?",
        items: [
          { title: "List or claim your business", body: "Free, complete, and equally ranked — start here.", to: "/claim" },
          { title: "Questions first?", body: "We're happy to help you get set up.", to: "/contact" },
        ],
      },
    ],
    metaTitle: "For Business Owners | Redmond Compass",
    metaDescription:
      "List your Redmond business for free — complete profiles, equal ranking with no paid placement, owner dashboard for hours, bulletins, and events.",
  },
  es: {
    name: "Para negocios",
    kicker: "Para dueños de negocios",
    title: "Haz crecer tu negocio local",
    intro: "Deja que te descubran miles de vecinos de Redmond que buscan exactamente lo que ofreces.",
    sections: [
      {
        heading: "Consejos de visibilidad",
        bullets: [
          "Agrega un logo o una foto de buena calidad: los listados con imágenes reciben mucha más atención.",
          "Escribe un resumen claro y descriptivo de lo que hace único a tu negocio.",
          "Mantén tus horarios y datos de contacto al día para que los clientes te encuentren.",
          "Usa etiquetas relevantes para que los vecinos te descubran al buscar.",
          "Comparte el enlace de tu perfil en redes sociales para atraer visitas a tu listado.",
          "Publica tus promociones y ofertas para mantener tu perfil fresco y atractivo.",
        ],
      },
      {
        heading: "Preguntas frecuentes",
        items: [
          { title: "¿Cómo listo mi negocio?", body: "Aquí mismo en la app: ve a Cuenta → Cambiar a negocio, y luego reclama tu listado existente o crea uno nuevo. Toma un par de minutos." },
          { title: "¿Listar mi negocio es gratis?", body: "Sí. Los listados en Redmond Compass son completamente gratuitos para los negocios locales, y los listados gratuitos están completos: tu perfil entero, fotos, horarios y contacto, sin nada bloqueado." },
          { title: "¿Cómo funciona el ranking?", body: "Todos los negocios aparecen en igualdad de condiciones. No hay publicidad pagada, ni lugares destacados, ni estrellas: los vecinos pueden Recomendar (♥) un negocio que les encanta, y ese conteo nunca reordena los resultados." },
          { title: "¿Cómo actualizo la información de mi negocio?", body: "Inicia sesión y abre tu panel de dueño para editar tu listado, publicar avisos y enviar eventos, o contáctanos y te ayudamos." },
          { title: "¿Cuánto tarda en aparecer mi listado?", body: "Crear o reclamar un listado es inmediato. La insignia de Verificado se aplica cuando confirmamos que eres el dueño." },
        ],
      },
      {
        heading: "¿Listo para empezar?",
        items: [
          { title: "Lista o reclama tu negocio", body: "Gratis, completo y con ranking igualitario. Empieza aquí.", to: "/claim" },
          { title: "¿Prefieres preguntar primero?", body: "Con gusto te ayudamos a arrancar.", to: "/contact" },
        ],
      },
    ],
    metaTitle: "Para negocios | Redmond Compass",
    metaDescription:
      "Lista tu negocio de Redmond gratis: perfiles completos, ranking igualitario sin publicidad pagada y panel de dueño para horarios, avisos y eventos.",
  },
};
