import type { Guide } from "../types";

// Source: migration/content/about.md (live site). The empty "What You'll Find
// Here" section is filled with the app's actual pillars; the business CTA now
// points at the in-app claim flow instead of an external intake form.
export const guide: Guide = {
  slug: "about",
  en: {
    name: "About",
    kicker: "About",
    title: "The Redmond Compass",
    intro:
      "Created with one simple goal: to help people discover, connect with, and support the businesses, organizations, events, and people that make Redmond such a special place to live.",
    sections: [
      {
        heading: "Welcome to The Redmond Compass",
        body: "As Redmond continues to grow, it can be difficult to keep up with everything happening around town. New businesses open, community events are announced, nonprofits need support, local organizations are making a difference, and residents are constantly searching for trusted local resources.\n\nThe Redmond Compass was built to bring all of those things together in one place.\n\nWhether you're a lifelong resident, new to the area, visiting Central Oregon, or a local business owner — we want this platform to help you find what you're looking for and discover things you didn't even know existed.",
      },
      {
        heading: "Why we created it",
        body: "The Redmond Compass was created because our community deserves a dedicated resource focused entirely on Redmond and the surrounding area. Our goal is to:",
        bullets: [
          "Support local businesses by helping residents discover and connect with them.",
          "Promote community events, fundraisers, festivals, and local activities.",
          "Highlight nonprofits, volunteer opportunities, and organizations making a positive impact.",
          "Share local resources that help residents navigate daily life.",
          "Celebrate the people, places, and stories that make Redmond unique.",
          "Strengthen community connections by creating a central hub for information and engagement.",
        ],
      },
      {
        heading: "Our mission",
        body: "To connect the people of Redmond with the businesses, organizations, events, and resources that strengthen our community — while encouraging local discovery, engagement, and support.\n\nWe believe local communities are strongest when information is accessible, businesses are supported, and people feel connected to where they live. Every listing here ranks equally — there is no paid placement.",
      },
      {
        heading: "What you'll find here",
        items: [
          { title: "Business Directory", body: "Local businesses across Redmond, Terrebonne, and Crooked River Ranch — searchable, complete, and equally ranked.", to: "/search" },
          { title: "Events", body: "Markets, live music, fundraisers, and community happenings, with an easy add-to-calendar.", to: "/events" },
          { title: "News & Community", body: "Local news and community updates in one feed.", to: "/community" },
          { title: "Resources", body: "Trusted contacts for emergencies, health, housing, schools, utilities, and more.", to: "/resources" },
          { title: "Guides", body: "Getting settled, seasonal safety, the outdoors, pets, seniors, and help essentials.", to: "/getting-settled" },
        ],
      },
      {
        heading: "Get involved",
        body: "The Redmond Compass is a community-driven platform, and we welcome your participation. If you know of a local business, event, nonprofit, community group, or resource that should be featured, we'd love to hear from you.\n\nTogether, we can create a resource that helps our community stay informed, connected, and engaged.",
        items: [
          { title: "Are you a local business?", body: "Claim or create your free listing in a couple of minutes.", to: "/claim" },
          { title: "Contact us", body: "Questions, feedback, or something we should add.", to: "/contact" },
        ],
      },
    ],
    footnote: "Discover · Connect · Live Local — thank you for being part of The Redmond Compass community.",
    metaTitle: "About | Redmond Compass",
    metaDescription:
      "Why Redmond Compass exists: a community hub to discover, connect with, and support the businesses, events, and people of Redmond, Oregon.",
  },
  es: {
    name: "Acerca de",
    kicker: "Acerca de",
    title: "The Redmond Compass",
    intro:
      "Creado con un objetivo simple: ayudar a la gente a descubrir, conectar y apoyar a los negocios, organizaciones, eventos y personas que hacen de Redmond un lugar tan especial para vivir.",
    sections: [
      {
        heading: "Bienvenido a The Redmond Compass",
        body: "A medida que Redmond crece, se vuelve difícil estar al tanto de todo lo que pasa en la ciudad. Abren negocios nuevos, se anuncian eventos comunitarios, las organizaciones sin fines de lucro necesitan apoyo y los vecinos buscan constantemente recursos locales confiables.\n\nThe Redmond Compass nació para reunir todo eso en un solo lugar.\n\nSeas residente de toda la vida, recién llegado, visitante de Central Oregon o dueño de un negocio local, queremos que esta plataforma te ayude a encontrar lo que buscas y a descubrir cosas que ni sabías que existían.",
      },
      {
        heading: "Por qué lo creamos",
        body: "The Redmond Compass existe porque nuestra comunidad merece un recurso dedicado por completo a Redmond y sus alrededores. Nuestro objetivo es:",
        bullets: [
          "Apoyar a los negocios locales ayudando a los vecinos a descubrirlos y conectar con ellos.",
          "Promover eventos comunitarios, colectas, festivales y actividades locales.",
          "Destacar organizaciones sin fines de lucro, voluntariados y grupos que generan un impacto positivo.",
          "Compartir recursos locales que faciliten la vida diaria.",
          "Celebrar a las personas, los lugares y las historias que hacen único a Redmond.",
          "Fortalecer los lazos comunitarios con un punto central de información y participación.",
        ],
      },
      {
        heading: "Nuestra misión",
        body: "Conectar a la gente de Redmond con los negocios, organizaciones, eventos y recursos que fortalecen nuestra comunidad, fomentando el descubrimiento, la participación y el apoyo local.\n\nCreemos que las comunidades son más fuertes cuando la información es accesible, los negocios reciben apoyo y la gente se siente conectada con el lugar donde vive. Aquí todos los listados aparecen en igualdad de condiciones: no existe la publicidad pagada en los resultados.",
      },
      {
        heading: "Qué vas a encontrar aquí",
        items: [
          { title: "Directorio de negocios", body: "Negocios locales de Redmond, Terrebonne y Crooked River Ranch: búsqueda completa y ranking igualitario.", to: "/search" },
          { title: "Eventos", body: "Mercados, música en vivo, colectas y actividades comunitarias, con opción de agregar al calendario.", to: "/events" },
          { title: "Noticias y comunidad", body: "Noticias locales y novedades de la comunidad en un solo lugar.", to: "/community" },
          { title: "Recursos", body: "Contactos confiables para emergencias, salud, vivienda, escuelas, servicios y más.", to: "/resources" },
          { title: "Guías", body: "Primeros pasos, seguridad estacional, aire libre, mascotas, adultos mayores y ayuda esencial.", to: "/getting-settled" },
        ],
      },
      {
        heading: "Participa",
        body: "The Redmond Compass es una plataforma impulsada por la comunidad y tu participación es bienvenida. Si conoces un negocio, evento, organización o recurso local que debería aparecer aquí, nos encantaría saberlo.\n\nJuntos podemos crear un recurso que mantenga a nuestra comunidad informada, conectada y participativa.",
        items: [
          { title: "¿Tienes un negocio local?", body: "Reclama o crea tu listado gratis en un par de minutos.", to: "/claim" },
          { title: "Contáctanos", body: "Preguntas, comentarios o algo que deberíamos agregar.", to: "/contact" },
        ],
      },
    ],
    footnote: "Descubre · Conecta · Vive local — gracias por ser parte de la comunidad de The Redmond Compass.",
    metaTitle: "Acerca de | Redmond Compass",
    metaDescription:
      "Por qué existe Redmond Compass: un centro comunitario para descubrir, conectar y apoyar a los negocios, eventos y personas de Redmond, Oregon.",
  },
};
