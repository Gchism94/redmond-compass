import type { Guide } from "../types";

// Source: migration/content/getting-settled.md. Phones/URLs cross-checked against
// the imported resources table (City of Redmond, CEC, Pacific Power, library,
// CET, school district, DMV) — only verified contacts get buttons.
export const guide: Guide = {
  slug: "getting-settled",
  en: {
    name: "Getting Settled",
    kicker: "New to the area",
    title: "Getting Settled",
    intro:
      "Your guide to the practical basics across Redmond, Terrebonne, and Crooked River Ranch: utilities, your library card, getting around, schools, and more.",
    callout: {
      title: "New to the Area / Recién llegados",
      body: "Bilingual resources for our Spanish-speaking neighbors, in partnership with the Latino Community Association.",
    },
    sections: [
      {
        heading: "Your first-week checklist",
        bullets: [
          "Set up water, sewer, and garbage service with the City of Redmond.",
          "Set up your electricity and natural gas.",
          "Get your free library card.",
          "Transfer your driver's license and register your vehicle (you have a limited window as a new Oregon resident).",
          "Register to vote. Oregon votes by mail, so your ballot comes to you.",
        ],
      },
      {
        heading: "Utilities",
        items: [
          {
            title: "Water, sewer & stormwater",
            body: "Provided by the City of Redmond if you live inside city limits. Start, stop, or transfer service online, or call Utility Billing. A one-time service fee applies for new accounts. If you live outside city limits, your water may come from a private company such as Avion Water, or from a well.",
            note: "Office open Monday to Friday, 8 am to 5 pm.",
            phone: "541-923-7710",
            url: "https://www.redmondoregon.gov",
          },
          {
            title: "Garbage & recycling",
            body: "Curbside garbage and recycling is handled by Republic Services and is required inside Redmond city limits. They also serve Terrebonne.",
            url: "https://www.republicservices.com",
          },
          {
            title: "Electricity",
            body: "Your provider is either Pacific Power or Central Electric Cooperative, depending on your exact address. Look up your address on Central Electric's service map at cec.coop to see which one serves you.",
          },
          { title: "Pacific Power", body: "Electricity provider for parts of the Redmond area.", phone: "888-221-7070", url: "https://www.pacificpower.net" },
          { title: "Central Electric Cooperative", body: "Electricity provider for parts of the Redmond area. Check their service map to confirm if they serve your address.", phone: "541-548-2144", url: "https://www.cec.coop" },
          { title: "Natural gas", body: "Provided by Cascade Natural Gas across Central Oregon.", url: "https://www.cngc.com" },
        ],
      },
      {
        heading: "Books, WiFi, and more",
        items: [
          {
            title: "Redmond Library",
            body: "Part of Deschutes Public Library. A free library card gets you books, e-books and audiobooks (through the Libby app), free WiFi, a MakerSpace, meeting rooms, and programs for all ages. A card is free for Deschutes County residents — apply online or in person. An Oregon driver's license with your current Deschutes County address is all you need to prove residency.",
            phone: "541-312-1050",
            url: "https://www.deschuteslibrary.org",
          },
        ],
      },
      {
        heading: "Buses and roads",
        items: [
          {
            title: "Cascades East Transit (CET)",
            body: "Local bus service with in-town routes, on-demand rides within Redmond city limits, and regional Community Connector routes to Bend and other nearby towns. Routes and times change periodically, so check the website for the latest.",
            phone: "541-385-8680",
            url: "https://cascadeseasttransit.com",
          },
          {
            title: "Roads & winter driving",
            body: "For real-time road conditions and winter passes, see TripCheck at tripcheck.com or dial 511. There is more on staying safe through winter weather on our Seasonal Safety page.",
            url: "https://tripcheck.com",
          },
        ],
      },
      {
        heading: "Enrolling your kids",
        items: [
          {
            title: "Redmond School District 2J",
            body: "Serves Redmond, Terrebonne, Crooked River Ranch, Tumalo, Eagle Crest, and Alfalfa. New students enroll online through the ParentVUE portal, then register at their assigned neighborhood school. Not sure which school that is? Use the address lookup or bus route tool on the district website. Redmond Proficiency Academy is a separate public charter option, with its own enrollment.",
            phone: "541-923-5437",
            url: "https://www.redmondschools.org",
          },
        ],
      },
      {
        heading: "Make it official",
        items: [
          {
            title: "Oregon DMV, Redmond",
            body: "New to Oregon? Transfer your out-of-state driver's license and title and register your vehicle soon after you move. Many tasks can be done online at DMV2U without a trip to the office.",
            note: "Open Monday to Friday, 8 am to 5 pm.",
            phone: "541-548-0140",
            url: "https://dmv2u.oregon.gov",
          },
          {
            title: "Register to vote",
            body: "Oregon votes entirely by mail, so once you are registered your ballot is mailed to you. Register or update your address online at the Oregon Secretary of State. You can also register when you get your Oregon license, or through the Deschutes County Clerk. Register at least 21 days before an election.",
            url: "https://sos.oregon.gov/voting",
          },
        ],
      },
      {
        heading: "Get involved",
        items: [
          { title: "Redmond Area Parks & Recreation District (RAPRD)", body: "Classes, youth and adult sports, an activity center, and community events.", url: "https://raprd.org" },
          { title: "City of Redmond", body: "Find city services, report a problem, look up city council meetings, and get connected to your local government.", phone: "541-923-7710", url: "https://www.redmondoregon.gov" },
        ],
      },
    ],
    related: [
      { label: "New to the Area (bilingual resources)", to: "/new-to-the-area" },
      { label: "Help & Essentials", to: "/help-essentials" },
      { label: "Seasonal Safety", to: "/seasonal-safety" },
    ],
    footnote:
      "Fees, hours, and providers can change. We keep this guide current, but it is always worth confirming details with each provider when you set up service. New here and something is missing? Let us know and we will add it.",
    reviewed: "Last reviewed June 2026",
    metaTitle: "Getting Settled | Redmond Compass",
    metaDescription:
      "The practical basics for new residents of Redmond, Terrebonne, and Crooked River Ranch — utilities, library card, transit, schools, DMV, and voting.",
  },
  es: {
    name: "Primeros pasos",
    kicker: "Recién llegados",
    title: "Primeros pasos",
    intro:
      "Tu guía práctica para instalarte en Redmond, Terrebonne y Crooked River Ranch: servicios básicos, tarjeta de biblioteca, transporte, escuelas y más.",
    callout: {
      title: "Recién llegados / New to the Area",
      body: "Recursos bilingües para nuestros vecinos hispanohablantes, en colaboración con la Latino Community Association.",
    },
    sections: [
      {
        heading: "Tu lista para la primera semana",
        bullets: [
          "Contrata agua, alcantarillado y basura con la Ciudad de Redmond.",
          "Contrata la electricidad y el gas natural.",
          "Saca tu tarjeta de biblioteca gratuita.",
          "Transfiere tu licencia de conducir y registra tu vehículo (como nuevo residente de Oregon tienes un plazo limitado).",
          "Regístrate para votar. En Oregon se vota por correo, así que la boleta te llega a casa.",
        ],
      },
      {
        heading: "Servicios básicos",
        items: [
          {
            title: "Agua, alcantarillado y drenaje",
            body: "Los provee la Ciudad de Redmond si vives dentro de los límites de la ciudad. Inicia, cancela o transfiere el servicio en línea, o llama a Utility Billing. Las cuentas nuevas pagan un cargo único por conexión. Si vives fuera de los límites de la ciudad, tu agua puede venir de una compañía privada como Avion Water o de un pozo.",
            note: "Oficina abierta de lunes a viernes, de 8 am a 5 pm.",
            phone: "541-923-7710",
            url: "https://www.redmondoregon.gov",
          },
          {
            title: "Basura y reciclaje",
            body: "La recolección de basura y reciclaje está a cargo de Republic Services y es obligatoria dentro de los límites de la ciudad de Redmond. También atienden Terrebonne.",
            url: "https://www.republicservices.com",
          },
          {
            title: "Electricidad",
            body: "Tu proveedor es Pacific Power o Central Electric Cooperative, según tu dirección exacta. Busca tu dirección en el mapa de cobertura de Central Electric en cec.coop para saber cuál te corresponde.",
          },
          { title: "Pacific Power", body: "Proveedor de electricidad en parte del área de Redmond.", phone: "888-221-7070", url: "https://www.pacificpower.net" },
          { title: "Central Electric Cooperative", body: "Proveedor de electricidad en parte del área de Redmond. Consulta su mapa de cobertura para confirmar si atienden tu dirección.", phone: "541-548-2144", url: "https://www.cec.coop" },
          { title: "Gas natural", body: "Lo provee Cascade Natural Gas en todo Central Oregon.", url: "https://www.cngc.com" },
        ],
      },
      {
        heading: "Libros, WiFi y más",
        items: [
          {
            title: "Biblioteca de Redmond",
            body: "Parte de Deschutes Public Library. Con la tarjeta gratuita tienes libros, e-books y audiolibros (con la app Libby), WiFi gratis, un MakerSpace, salas de reuniones y programas para todas las edades. La tarjeta es gratis para residentes del condado de Deschutes: solicítala en línea o en persona. Solo necesitas una licencia de Oregon con tu dirección actual del condado para comprobar residencia.",
            phone: "541-312-1050",
            url: "https://www.deschuteslibrary.org",
          },
        ],
      },
      {
        heading: "Autobuses y carreteras",
        items: [
          {
            title: "Cascades East Transit (CET)",
            body: "Servicio de autobús local con rutas dentro de la ciudad, viajes a pedido dentro de Redmond y rutas regionales Community Connector a Bend y otros pueblos cercanos. Las rutas y horarios cambian de vez en cuando; revisa el sitio web para lo más reciente.",
            phone: "541-385-8680",
            url: "https://cascadeseasttransit.com",
          },
          {
            title: "Carreteras y manejo en invierno",
            body: "Para el estado de las carreteras en tiempo real y los pasos de montaña en invierno, consulta TripCheck en tripcheck.com o marca 511. Hay más sobre cómo pasar el invierno con seguridad en nuestra página de Seguridad estacional.",
            url: "https://tripcheck.com",
          },
        ],
      },
      {
        heading: "Inscribir a tus hijos",
        items: [
          {
            title: "Distrito Escolar Redmond 2J",
            body: "Atiende Redmond, Terrebonne, Crooked River Ranch, Tumalo, Eagle Crest y Alfalfa. Los estudiantes nuevos se inscriben en línea por el portal ParentVUE y luego se registran en la escuela de su vecindario. ¿No sabes cuál te toca? Usa el buscador por dirección o la herramienta de rutas de autobús en el sitio del distrito. Redmond Proficiency Academy es una opción charter pública aparte, con su propia inscripción.",
            phone: "541-923-5437",
            url: "https://www.redmondschools.org",
          },
        ],
      },
      {
        heading: "Hazlo oficial",
        items: [
          {
            title: "DMV de Oregon, Redmond",
            body: "¿Recién llegado a Oregon? Transfiere tu licencia de otro estado, el título y el registro de tu vehículo poco después de mudarte. Muchos trámites se hacen en línea en DMV2U sin ir a la oficina.",
            note: "Abierto de lunes a viernes, de 8 am a 5 pm.",
            phone: "541-548-0140",
            url: "https://dmv2u.oregon.gov",
          },
          {
            title: "Regístrate para votar",
            body: "En Oregon se vota completamente por correo: una vez registrado, la boleta te llega a casa. Regístrate o actualiza tu dirección en línea con el Secretario de Estado de Oregon. También puedes registrarte al sacar tu licencia de Oregon o con el Secretario del Condado de Deschutes. Hazlo al menos 21 días antes de una elección.",
            url: "https://sos.oregon.gov/voting",
          },
        ],
      },
      {
        heading: "Participa",
        items: [
          { title: "Redmond Area Parks & Recreation District (RAPRD)", body: "Clases, deportes para niños y adultos, un centro de actividades y eventos comunitarios.", url: "https://raprd.org" },
          { title: "Ciudad de Redmond", body: "Encuentra servicios municipales, reporta problemas, consulta las reuniones del concejo y conéctate con tu gobierno local.", phone: "541-923-7710", url: "https://www.redmondoregon.gov" },
        ],
      },
    ],
    related: [
      { label: "Recién llegados (recursos bilingües)", to: "/new-to-the-area" },
      { label: "Ayuda esencial", to: "/help-essentials" },
      { label: "Seguridad estacional", to: "/seasonal-safety" },
    ],
    footnote:
      "Las tarifas, horarios y proveedores pueden cambiar. Mantenemos esta guía al día, pero siempre conviene confirmar los detalles con cada proveedor al contratar el servicio. ¿Recién llegado y falta algo? Cuéntanos y lo agregamos.",
    reviewed: "Última revisión: junio de 2026",
    metaTitle: "Primeros pasos | Redmond Compass",
    metaDescription:
      "Lo básico y práctico para nuevos residentes de Redmond, Terrebonne y Crooked River Ranch: servicios, biblioteca, transporte, escuelas, DMV y votación.",
  },
};
