import type { Guide } from "../types";

// Source: migration/content/help-essentials.md. Crisis-adjacent content: Call
// buttons only carry numbers verified from the crawl, the imported resources
// table, or national standards (911/988/211/511) — everything else links out.
export const guide: Guide = {
  slug: "help-essentials",
  en: {
    name: "Help & Essentials",
    title: "Help & Essentials",
    intro:
      "Where to turn for food, housing, health, and crisis support across Redmond, Terrebonne, and Crooked River Ranch. Free and low-cost help from people in our community.",
    callout: {
      title: "Not sure where to begin? Dial 211.",
      body: "Oregon's free help line. Tell them what you need — food, rent, utilities, childcare, healthcare — and they connect you to local resources. Call 211, text your ZIP code to 898211, or visit 211info.org. Help is available in many languages.",
      phone: "211",
      url: "https://www.211info.org",
    },
    sections: [
      {
        heading: "Crisis & safety",
        kicker: "Available 24/7",
        items: [
          { title: "988 Suicide & Crisis Lifeline", body: "Free, confidential support any time, for anyone. Veterans press 1.", note: "Available 24 hours a day, 7 days a week.", phone: "988" },
          { title: "Deschutes County Crisis Line", body: "Mental health crisis support for all ages, regardless of ability to pay.", phone: "541-322-7500", note: "Choose extension 9." },
          { title: "Stabilization Center (walk-in)", body: "Walk in any time to see a therapist. No appointment, no cost, all ages.", url: "https://www.deschutes.org" },
          { title: "Saving Grace helpline", body: "Safety, shelter, and advocacy for survivors of domestic violence, sexual assault, and stalking.", note: "24-hour helpline, 365 days a year.", url: "https://saving-grace.org" },
          { title: "Alcohol & Drug Helpline", body: "Crisis support, treatment referrals, and substance-use information.", note: "Text 'RecoveryNow' to 839863." },
          { title: "Oregon YouthLine", body: "Teen-to-teen support. Trained teens answer 4 to 10 pm; adults answer all other hours.", note: "Text 'teen2teen' to 839863.", url: "https://www.theyouthline.org" },
        ],
      },
      {
        heading: "Food",
        kicker: "No one goes hungry",
        items: [
          { title: "NeighborImpact Food Program", body: "The hub for food pantries across Redmond and Central Oregon. They will point you to the nearest pantry.", url: "https://www.neighborimpact.org" },
          { title: "St. Vincent de Paul, Redmond", body: "Food pantry and emergency assistance for Redmond-area neighbors." },
          { title: "Shepherd's House Redmond Center", body: "Daily meals, open to anyone in need.", url: "https://shepherdshouseministries.org" },
          { title: "Meals for adults 60+", body: "Meals on Wheels and community dining through the Redmond Senior Center and Council on Aging.", to: "/senior-resources" },
        ],
      },
      {
        heading: "Housing & shelter",
        kicker: "A safe place to stay",
        items: [
          { title: "Shepherd's House Redmond Center", body: "24-hour shelter with meals, case management, showers, and laundry. The only Central Oregon shelter with walk-in family rooms.", url: "https://shepherdshouseministries.org" },
          { title: "Bethlehem Inn, Redmond", body: "Emergency shelter and basic needs. Walk-ins welcome.", url: "https://bethleheminn.org" },
          { title: "NeighborImpact housing help", body: "Rent assistance, eviction prevention, and homeless services as funds allow.", url: "https://www.neighborimpact.org" },
          { title: "Central Oregon shelter listing", body: "The current list of warming and emergency shelters across the region, kept up to date by the Homeless Leadership Coalition.", url: "https://www.cohomeless.org" },
        ],
      },
      {
        heading: "Help paying bills",
        kicker: "When money is tight",
        items: [
          { title: "Energy & heating assistance", body: "NeighborImpact helps with heating and utility bills and can stop a shut-off. Call the energy hotline.", url: "https://www.neighborimpact.org" },
          { title: "Rent & utility help", body: "NeighborImpact rental assistance, water and utility help, and referrals.", url: "https://www.neighborimpact.org" },
          { title: "St. Vincent de Paul, Redmond", body: "Help with utilities and other one-time emergencies." },
        ],
      },
      {
        heading: "Health & medical",
        kicker: "Care for everyone",
        items: [
          { title: "Mosaic Community Health, Redmond", body: "Medical, dental, behavioral health, and pharmacy on a sliding fee scale. All are welcome, whatever your insurance status.", phone: "541-383-3005", url: "https://mosaicch.org" },
          { title: "Deschutes County Public Health", body: "Immunizations, WIC, family planning, and screenings. Sliding fees available.", url: "https://www.deschutes.org" },
          { title: "Oregon Health Plan (OHP)", body: "Free or low-cost health coverage. Mosaic's enrollment team can help you apply.", url: "https://one.oregon.gov" },
        ],
      },
      {
        heading: "Mental health & recovery",
        kicker: "You are not alone",
        body: "In a crisis right now? You do not have to wait for an appointment — reach a trained person any time at 988 or the county crisis line above.",
        items: [
          { title: "Deschutes County Behavioral Health", body: "Counseling and treatment for mental health and substance use, all ages.", phone: "541-322-7500", url: "https://www.deschutes.org" },
          { title: "BestCare Treatment Services", body: "Substance use treatment and outpatient counseling, Redmond office.", url: "https://www.bestcaretreatment.org" },
          { title: "St. Charles Behavioral Health", body: "Behavioral health services connected to the regional hospital system.", phone: "541-548-8131", url: "https://www.stcharleshealthcare.org" },
        ],
      },
      {
        heading: "Older adults",
        kicker: "Adults 60 and over",
        items: [
          { title: "Council on Aging of Central Oregon", body: "The regional hub for aging services. Their Help Desk connects you to Meals on Wheels, free Medicare counseling, caregiver support, in-home help, and more.", note: "Monday through Friday, 8:00 am to 4:30 pm.", url: "https://www.councilonaging.org" },
          { title: "Redmond Senior Center", body: "The local hub for Redmond seniors: Meals on Wheels, community dining, social activities, and Passion for Pets for homebound clients.", note: "Monday through Friday, 9:00 am to 3:00 pm, closed weekends.", to: "/senior-resources" },
        ],
      },
      {
        heading: "Veterans",
        kicker: "For those who served",
        items: [
          { title: "Deschutes County Veterans' Services", body: "Free help with VA benefits and claims for veterans and their families. Redmond office by appointment on Thursdays.", url: "https://www.deschutes.org" },
          { title: "Veterans Crisis Line", body: "Confidential support from people who understand military life. Dial 988, then press 1.", note: "Text 838255. Available 24/7.", phone: "988", url: "https://www.veteranscrisisline.net" },
        ],
      },
      {
        heading: "Families & children",
        kicker: "For parents and kids",
        items: [
          { title: "Family Access Network (FAN)", body: "Advocates based in local schools connect families with food, clothing, housing, and other essentials.", note: "Contact your child's school office.", url: "https://familyaccessnetwork.org" },
          { title: "WIC Nutrition Program", body: "Food, nutrition support, and resources for pregnant people, new parents, and children under 5.", url: "https://www.deschutes.org" },
          { title: "Oregon YouthLine", body: "A safe place for young people to talk through anything, big or small.", note: "Text 'teen2teen' to 839863.", url: "https://www.theyouthline.org" },
        ],
      },
    ],
    related: [
      { label: "Community resources directory", to: "/resources" },
      { label: "Seasonal Safety", to: "/seasonal-safety" },
      { label: "Senior resources", to: "/senior-resources" },
    ],
    footnote:
      "We check this information regularly, but hours and services do change. Please call ahead before you visit. If a listing looks out of date, let us know and we will fix it.",
    reviewed: "Last reviewed June 2026",
    metaTitle: "Help & Essentials | Redmond Compass",
    metaDescription:
      "Free and low-cost help in Redmond, Oregon — crisis lines, food pantries, shelter, bill assistance, health care, recovery, veterans, and family support.",
  },
  es: {
    name: "Ayuda esencial",
    title: "Ayuda esencial",
    intro:
      "A dónde acudir por comida, vivienda, salud y apoyo en crisis en Redmond, Terrebonne y Crooked River Ranch. Ayuda gratuita y de bajo costo, de gente de nuestra comunidad.",
    callout: {
      title: "¿No sabes por dónde empezar? Marca 211.",
      body: "La línea de ayuda gratuita de Oregon. Diles qué necesitas —comida, renta, servicios, cuidado infantil, salud— y te conectan con recursos locales. Llama al 211, envía tu código postal por texto al 898211 o visita 211info.org. Hay ayuda en muchos idiomas, incluido el español.",
      phone: "211",
      url: "https://www.211info.org",
    },
    sections: [
      {
        heading: "Crisis y seguridad",
        kicker: "Disponible 24/7",
        items: [
          { title: "Línea 988 de Suicidio y Crisis", body: "Apoyo gratuito y confidencial a cualquier hora, para cualquier persona. Hay atención en español. Veteranos: presiona 1.", note: "Disponible las 24 horas, los 7 días.", phone: "988" },
          { title: "Línea de crisis del condado de Deschutes", body: "Apoyo en crisis de salud mental para todas las edades, sin importar tu capacidad de pago.", phone: "541-322-7500", note: "Elige la extensión 9." },
          { title: "Centro de estabilización (sin cita)", body: "Entra a cualquier hora para hablar con un terapeuta. Sin cita, sin costo, todas las edades.", url: "https://www.deschutes.org" },
          { title: "Línea de ayuda Saving Grace", body: "Seguridad, refugio y acompañamiento para sobrevivientes de violencia doméstica, agresión sexual y acoso.", note: "Línea de 24 horas, los 365 días del año.", url: "https://saving-grace.org" },
          { title: "Línea de alcohol y drogas", body: "Apoyo en crisis, referencias a tratamiento e información sobre consumo de sustancias.", note: "Envía 'RecoveryNow' por texto al 839863." },
          { title: "Oregon YouthLine", body: "Apoyo de adolescente a adolescente. Jóvenes capacitados responden de 4 a 10 pm; adultos el resto del día.", note: "Envía 'teen2teen' por texto al 839863.", url: "https://www.theyouthline.org" },
        ],
      },
      {
        heading: "Comida",
        kicker: "Que nadie pase hambre",
        items: [
          { title: "Programa de alimentos NeighborImpact", body: "El centro coordinador de las despensas de comida de Redmond y Central Oregon. Te indican la despensa más cercana.", url: "https://www.neighborimpact.org" },
          { title: "St. Vincent de Paul, Redmond", body: "Despensa de alimentos y asistencia de emergencia para vecinos del área de Redmond." },
          { title: "Shepherd's House, centro de Redmond", body: "Comidas diarias, abiertas a cualquier persona que lo necesite.", url: "https://shepherdshouseministries.org" },
          { title: "Comidas para adultos 60+", body: "Meals on Wheels y comedor comunitario a través del Redmond Senior Center y el Council on Aging.", to: "/senior-resources" },
        ],
      },
      {
        heading: "Vivienda y refugio",
        kicker: "Un lugar seguro donde quedarte",
        items: [
          { title: "Shepherd's House, centro de Redmond", body: "Refugio de 24 horas con comidas, gestión de casos, duchas y lavandería. El único refugio de Central Oregon con cuartos familiares sin cita.", url: "https://shepherdshouseministries.org" },
          { title: "Bethlehem Inn, Redmond", body: "Refugio de emergencia y necesidades básicas. Puedes llegar sin cita.", url: "https://bethleheminn.org" },
          { title: "Ayuda de vivienda de NeighborImpact", body: "Asistencia de renta, prevención de desalojos y servicios para personas sin hogar, según los fondos disponibles.", url: "https://www.neighborimpact.org" },
          { title: "Lista de refugios de Central Oregon", body: "La lista vigente de refugios de emergencia y centros de calor de la región, actualizada por la Homeless Leadership Coalition.", url: "https://www.cohomeless.org" },
        ],
      },
      {
        heading: "Ayuda para pagar cuentas",
        kicker: "Cuando el dinero no alcanza",
        items: [
          { title: "Asistencia de energía y calefacción", body: "NeighborImpact ayuda con cuentas de calefacción y servicios, y puede detener un corte. Llama a su línea de energía.", url: "https://www.neighborimpact.org" },
          { title: "Ayuda con renta y servicios", body: "Asistencia de renta de NeighborImpact, ayuda con agua y servicios, y referencias.", url: "https://www.neighborimpact.org" },
          { title: "St. Vincent de Paul, Redmond", body: "Ayuda con servicios y otras emergencias puntuales." },
        ],
      },
      {
        heading: "Salud y atención médica",
        kicker: "Atención para todos",
        items: [
          { title: "Mosaic Community Health, Redmond", body: "Atención médica, dental, de salud mental y farmacia con tarifas según tus ingresos. Todos son bienvenidos, tengas o no seguro.", phone: "541-383-3005", url: "https://mosaicch.org" },
          { title: "Salud Pública del condado de Deschutes", body: "Vacunas, WIC, planificación familiar y exámenes. Tarifas ajustadas disponibles.", url: "https://www.deschutes.org" },
          { title: "Oregon Health Plan (OHP)", body: "Cobertura de salud gratuita o de bajo costo. El equipo de inscripción de Mosaic te puede ayudar a solicitarla.", url: "https://one.oregon.gov" },
        ],
      },
      {
        heading: "Salud mental y recuperación",
        kicker: "No estás solo",
        body: "¿Estás en crisis ahora mismo? No tienes que esperar una cita: comunícate a cualquier hora al 988 o a la línea de crisis del condado.",
        items: [
          { title: "Salud Conductual del condado de Deschutes", body: "Consejería y tratamiento de salud mental y consumo de sustancias, todas las edades.", phone: "541-322-7500", url: "https://www.deschutes.org" },
          { title: "BestCare Treatment Services", body: "Tratamiento de consumo de sustancias y consejería ambulatoria, oficina de Redmond.", url: "https://www.bestcaretreatment.org" },
          { title: "St. Charles Behavioral Health", body: "Servicios de salud mental conectados con el sistema hospitalario regional.", phone: "541-548-8131", url: "https://www.stcharleshealthcare.org" },
        ],
      },
      {
        heading: "Adultos mayores",
        kicker: "Adultos de 60 años o más",
        items: [
          { title: "Council on Aging of Central Oregon", body: "El centro regional de servicios para adultos mayores. Su mesa de ayuda te conecta con Meals on Wheels, asesoría gratuita de Medicare, apoyo para cuidadores, ayuda en casa y más.", note: "Lunes a viernes, de 8:00 am a 4:30 pm.", url: "https://www.councilonaging.org" },
          { title: "Redmond Senior Center", body: "El centro local para los adultos mayores de Redmond: Meals on Wheels, comedor comunitario, actividades sociales y Passion for Pets para clientes que no pueden salir de casa.", note: "Lunes a viernes, de 9:00 am a 3:00 pm; cierra los fines de semana.", to: "/senior-resources" },
        ],
      },
      {
        heading: "Veteranos",
        kicker: "Para quienes sirvieron",
        items: [
          { title: "Servicios para Veteranos del condado de Deschutes", body: "Ayuda gratuita con beneficios y reclamos del VA para veteranos y sus familias. Oficina de Redmond con cita los jueves.", url: "https://www.deschutes.org" },
          { title: "Línea de crisis para veteranos", body: "Apoyo confidencial de personas que entienden la vida militar. Marca 988 y presiona 1.", note: "Texto al 838255. Disponible 24/7.", phone: "988", url: "https://www.veteranscrisisline.net" },
        ],
      },
      {
        heading: "Familias y niños",
        kicker: "Para padres e hijos",
        items: [
          { title: "Family Access Network (FAN)", body: "Personal en las escuelas locales conecta a las familias con comida, ropa, vivienda y otras necesidades básicas.", note: "Pregunta en la oficina de la escuela de tu hijo.", url: "https://familyaccessnetwork.org" },
          { title: "Programa de nutrición WIC", body: "Alimentos, apoyo nutricional y recursos para personas embarazadas, madres y padres recientes, y niños menores de 5 años.", url: "https://www.deschutes.org" },
          { title: "Oregon YouthLine", body: "Un espacio seguro para que los jóvenes hablen de lo que sea, grande o pequeño.", note: "Envía 'teen2teen' por texto al 839863.", url: "https://www.theyouthline.org" },
        ],
      },
    ],
    related: [
      { label: "Directorio de recursos comunitarios", to: "/resources" },
      { label: "Seguridad estacional", to: "/seasonal-safety" },
      { label: "Recursos para adultos mayores", to: "/senior-resources" },
    ],
    footnote:
      "Revisamos esta información con frecuencia, pero los horarios y servicios cambian. Llama antes de ir. Si algo se ve desactualizado, cuéntanos y lo corregimos.",
    reviewed: "Última revisión: junio de 2026",
    metaTitle: "Ayuda esencial | Redmond Compass",
    metaDescription:
      "Ayuda gratuita y de bajo costo en Redmond, Oregon: líneas de crisis, despensas de comida, refugio, ayuda con cuentas, salud, recuperación, veteranos y familias.",
  },
};
