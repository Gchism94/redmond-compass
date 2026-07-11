import type { Guide } from "../types";

// Source: migration/content/contact.md. The old page embedded a Base44 message
// form; here the email button is the message channel (no form backend yet).
export const guide: Guide = {
  slug: "contact",
  en: {
    name: "Contact",
    kicker: "Get in touch",
    title: "Contact Redmond Compass",
    intro:
      "Have a question, a business to list, an event to promote, or feedback to share? We'd love to hear from you.",
    sections: [
      {
        heading: "Reach us directly",
        items: [
          { title: "Email", body: "RedmondCompass@gmail.com — the fastest way to reach us.", url: "mailto:RedmondCompass@gmail.com" },
          { title: "Phone", body: "541-640-3800", phone: "541-640-3800" },
          { title: "Location", body: "Redmond, Oregon" },
        ],
      },
      {
        heading: "Are you a local business?",
        body: "Claim or create your business listing quickly and easily — free listings, complete profiles, equal ranking.",
        items: [{ title: "List your business", body: "Takes a couple of minutes.", to: "/claim" }],
      },
    ],
    contactEmail: "Send us a message anytime — we read everything.",
    metaTitle: "Contact | Redmond Compass",
    metaDescription: "Contact Redmond Compass — questions, business listings, events, and feedback for Redmond, Oregon's community hub.",
  },
  es: {
    name: "Contacto",
    kicker: "Escríbenos",
    title: "Contacta a Redmond Compass",
    intro:
      "¿Tienes una pregunta, un negocio para listar, un evento para promover o algún comentario? Nos encantaría saber de ti.",
    sections: [
      {
        heading: "Contacto directo",
        items: [
          { title: "Correo electrónico", body: "RedmondCompass@gmail.com — la forma más rápida de comunicarte.", url: "mailto:RedmondCompass@gmail.com" },
          { title: "Teléfono", body: "541-640-3800", phone: "541-640-3800" },
          { title: "Ubicación", body: "Redmond, Oregon" },
        ],
      },
      {
        heading: "¿Tienes un negocio local?",
        body: "Reclama o crea tu listado rápido y fácil: listados gratuitos, perfiles completos y ranking igualitario.",
        items: [{ title: "Lista tu negocio", body: "Toma solo un par de minutos.", to: "/claim" }],
      },
    ],
    contactEmail: "Envíanos un mensaje cuando quieras: leemos todo.",
    metaTitle: "Contacto | Redmond Compass",
    metaDescription: "Contacta a Redmond Compass: preguntas, listados de negocios, eventos y comentarios para el centro comunitario de Redmond, Oregon.",
  },
};
