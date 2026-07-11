import type { Guide } from "../types";

// Source: migration/content/new-to-the-area.md — bilingual resources for
// Spanish-speaking neighbors, in partnership with the Latino Community Association.
export const guide: Guide = {
  slug: "new-to-the-area",
  en: {
    name: "New to the Area",
    kicker: "New to the area",
    title: "New to Central Oregon? We're glad you're here.",
    intro:
      "Moving to a new place is hard, especially when you're also navigating a new language and unfamiliar systems. Redmond Compass wants every neighbor, no matter what language you speak, to be able to find the people and resources that can help you get settled. Below are trusted, Spanish-speaking resources serving Redmond and the wider Central Oregon area.",
    sections: [
      {
        heading: "Latino Community Association (LCA)",
        body: "LCA has served Central Oregon's Latino community since 1994, with a Redmond office now open. Their bilingual staff help with immigration and legal questions, healthcare enrollment, English classes, citizenship prep, and job connections — all free of charge. Their website has its own English/Spanish toggle.",
        items: [
          { title: "Latino Community Association", body: "Free bilingual help for Central Oregon families.", url: "https://latinocommunityassociation.org" },
        ],
      },
      {
        heading: "Quick resource links",
        items: [
          { title: "Know Your Rights", body: "Immigration rights information in plain language.", url: "https://latinocommunityassociation.org" },
          { title: "Healthcare assistance", body: "Help enrolling in the Oregon Health Plan and finding a doctor.", url: "https://latinocommunityassociation.org" },
          { title: "Learning English", body: "Free English classes for adults.", url: "https://latinocommunityassociation.org" },
          { title: "Job listings", body: "Local job openings and workforce support.", url: "https://latinocommunityassociation.org" },
        ],
      },
    ],
    related: [
      { label: "Getting Settled guide", to: "/getting-settled" },
      { label: "Emergency and safety info", to: "/help-essentials" },
      { label: "Business directory", to: "/search" },
    ],
    contactEmail: "This page will keep growing. If you know of a bilingual resource that should be here, let us know.",
    metaTitle: "New to the Area | Redmond Compass",
    metaDescription:
      "Trusted Spanish-speaking resources for new neighbors in Redmond and Central Oregon — immigration help, healthcare enrollment, English classes, and jobs.",
  },
  es: {
    name: "Recién llegados",
    kicker: "Recién llegados",
    title: "¿Nuevo en Central Oregon? Qué bueno que estás aquí.",
    intro:
      "Mudarse a un lugar nuevo es difícil, sobre todo cuando además hay que manejarse en otro idioma y con sistemas desconocidos. En Redmond Compass queremos que cada vecino, hable el idioma que hable, pueda encontrar a las personas y los recursos que le ayuden a instalarse. Aquí tienes recursos confiables en español que atienden a Redmond y a toda la región de Central Oregon.",
    sections: [
      {
        heading: "Latino Community Association (LCA)",
        body: "LCA sirve a la comunidad latina de Central Oregon desde 1994 y ya cuenta con una oficina en Redmond. Su equipo bilingüe ayuda con preguntas de inmigración y asuntos legales, inscripción en seguros de salud, clases de inglés, preparación para la ciudadanía y conexiones de empleo, todo sin costo. Su sitio web también tiene selector de inglés/español.",
        items: [
          { title: "Latino Community Association", body: "Ayuda bilingüe gratuita para las familias de Central Oregon.", url: "https://latinocommunityassociation.org" },
        ],
      },
      {
        heading: "Enlaces rápidos",
        items: [
          { title: "Conoce tus derechos", body: "Información sobre derechos de inmigración en lenguaje claro.", url: "https://latinocommunityassociation.org" },
          { title: "Ayuda con la salud", body: "Apoyo para inscribirte en el Oregon Health Plan y encontrar doctor.", url: "https://latinocommunityassociation.org" },
          { title: "Aprender inglés", body: "Clases de inglés gratuitas para adultos.", url: "https://latinocommunityassociation.org" },
          { title: "Bolsa de trabajo", body: "Empleos locales y apoyo laboral.", url: "https://latinocommunityassociation.org" },
        ],
      },
    ],
    related: [
      { label: "Guía de primeros pasos", to: "/getting-settled" },
      { label: "Emergencias y seguridad", to: "/help-essentials" },
      { label: "Directorio de negocios", to: "/search" },
    ],
    contactEmail: "Esta página seguirá creciendo. Si conoces un recurso bilingüe que debería estar aquí, cuéntanos.",
    metaTitle: "Recién llegados | Redmond Compass",
    metaDescription:
      "Recursos confiables en español para vecinos nuevos en Redmond y Central Oregon: ayuda con inmigración, inscripción de salud, clases de inglés y empleo.",
  },
};
